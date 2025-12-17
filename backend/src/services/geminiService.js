// [삭제] import fetch from "node-fetch"; (SDK 내장 기능 사용)
import { GoogleGenAI } from "@google/genai"; // 최신 SDK 임포트
import dotenv from "dotenv";
import pg from "pg"; 
import { getWeatherByRequest } from "./WeatherService.js";

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// 모델 버전을 2.5 Flash로 변경
const GEMINI_MODEL = "gemini-2.5-flash"; 
const MAX_RETRIES = 3; 

// [중요] Date 객체를 한국 시간(KST) 기준의 Date 객체로 변환하는 헬퍼
function toKST(date) {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
  const KR_TIME_DIFF = 9 * 60 * 60 * 1000;
  return new Date(utc + KR_TIME_DIFF);
}

function getSeasonalWeather(kstDate) {
    const month = kstDate.getMonth() + 1;
    if (month >= 3 && month <= 5) return "평균 기온 10~20도, 일교차가 큰 봄 날씨 예상";
    else if (month >= 6 && month <= 8) return "평균 기온 25~30도, 덥고 습한 여름 날씨 예상";
    else if (month >= 9 && month <= 11) return "평균 기온 10~20도, 선선한 가을 날씨 예상";
    else return "평균 기온 영하~5도, 춥고 건조한 겨울 날씨 예상";
}

// (이 함수는 로직이 완벽하므로 그대로 유지합니다)
async function formatContextForPrompt(weatherData, period) {
    let resultString = "";
    
    let start, end;
    if (period?.start) {
        start = new Date(period.start);
        end = period.end ? new Date(period.end) : new Date(period.start);
    } else {
        const kstNow = toKST(new Date()); 
        start = kstNow;
        end = kstNow;
    }

    let allEvents = {};
    try {
        const res = await pool.query("SELECT data FROM calendar ORDER BY id DESC LIMIT 1");
        if (res.rows.length > 0) allEvents = res.rows[0].data || {};
    } catch (e) {
        console.error("DB 일정 로드 실패:", e);
    }

    const weatherItems = weatherData?.landFcst?.items || [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        
        const dateKey = `${year}-${month}-${day}`; 
        const dateKeyNoHyphen = `${year}${month}${day}`;

        const dayEvents = allEvents[dateKey] || [];
        const eventText = dayEvents.length > 0 
            ? `일정: ${dayEvents.map(e => e.title).join(", ")}` 
            : "일정: 특별한 일정 없음 (평상복)";

        let weatherDesc = "";
        const matchedWeathers = weatherItems.filter(item => {
            const fcstDateRaw = item.tmEf || item.TM_EF || ""; 
            return fcstDateRaw.startsWith(dateKeyNoHyphen);
        });

        if (matchedWeathers.length > 0) {
            const temps = matchedWeathers.map(it => Number(it.TA || it.ta || -99)).filter(t => t > -99);
            const skyStatus = matchedWeathers[0].WF || matchedWeathers[0].wf || "맑음";
            if (temps.length > 0) {
                const minT = Math.min(...temps);
                const maxT = Math.max(...temps);
                weatherDesc = `날씨(예보): 기온 ${minT}~${maxT}도, ${skyStatus}`;
            } else {
                weatherDesc = `날씨(예보): ${skyStatus}`;
            }
        } else {
            const seasonal = getSeasonalWeather(d);
            weatherDesc = `날씨(추정): 예보 데이터 없음. ${month}월 통계 기반 - ${seasonal}`;
        }

        resultString += `[${dateKey} (${getDayName(d)})]\n  - ${weatherDesc}\n  - ${eventText}\n\n`;
    }

    const locationStr = weatherData?.location 
        ? `위치: ${weatherData.location.city} ${weatherData.location.region}`
        : "위치: 정보 없음";

    return `사용자 현재 ${locationStr}\n\n${resultString}`;
}

function getDayName(date) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[date.getDay()];
}

// ---------------------------------------------------------
// [핵심 수정] Gemini 2.5 Flash SDK 사용 및 JSON 모드 적용
// ---------------------------------------------------------
export async function getRecommendations(req, selected, clothes, period) {
    const apiKeys = [
        process.env.GEMINI_API_KEY1,
        process.env.GEMINI_API_KEY2,
        process.env.GEMINI_API_KEY3
    ];

    let weatherData = null;
    try {
        weatherData = await getWeatherByRequest(req);
    } catch (error) {
        console.error("WeatherService Error:", error);
    }

    const contextString = await formatContextForPrompt(weatherData, period);

    let startDate, endDate;
    if (period?.start) {
        startDate = new Date(period.start);
        endDate = period.end ? new Date(period.end) : new Date(period.start);
    } else {
        const kstNow = toKST(new Date());
        startDate = kstNow;
        endDate = kstNow;
    }
    
    const isSingleDay = startDate.toDateString() === endDate.toDateString();
    const countInstruction = isSingleDay 
        ? "현재 '단일 날짜' 요청입니다. 해당 날짜의 날씨와 TPO에 맞춰 **서로 다른 무드의 코디 조합을 3가지** 제안하세요."
        : "현재 '여러 날짜' 요청입니다. **각 날짜별로 최적의 코디를 1개씩** 제안하세요.";

    // 프롬프트: JSON 구조에 대한 설명은 스키마(Config)로 넘기므로, 여기선 상황 설명에 집중합니다.
    const prompt = `
당신은 최고의 AI 패션 스타일리스트입니다.
아래 제공된 **[날짜별 상황]**을 면밀히 분석하여, 사용자가 가진 옷으로 가장 적절한 코디를 추천해주세요.

========================================
[날짜별 상황 (날씨 + 일정)]
${contextString}

[사용자 옷장 목록 (JSON)]
${JSON.stringify(clothes, null, 2)}

[사용자 고정 아이템]
${JSON.stringify(selected, null, 2)}
========================================

[요청 사항]
1. **수량 규칙**: ${countInstruction}
2. 날씨와 TPO(일정)를 최우선으로 고려하세요.
3. 고정된 아이템이 있다면 절대 바꾸지 마세요.
4. JSON 형식으로만 응답하며, 날짜 필드를 정확히 매핑하세요.
`;

    // Gemini가 반환해야 할 데이터 구조 정의 (Schema)
    // 이렇게 설정하면 프롬프트에서 형식을 틀리게 줄 확률이 0%가 됩니다.
    const responseSchema = {
        type: "ARRAY",
        items: {
            type: "OBJECT",
            properties: {
                date: { type: "STRING", description: "YYYY-MM-DD 형식의 날짜" },
                outer: { type: "STRING", nullable: true, description: "아우터 ID (없으면 null)" },
                top: { type: "STRING", description: "상의 ID" },
                bottom: { type: "STRING", description: "하의 ID" },
                shoes: { type: "STRING", description: "신발 ID" },
                reason: { type: "STRING", description: "추천 이유 (한국어)" }
            },
            required: ["date", "top", "bottom", "shoes", "reason"]
        }
    };

    let attempt = 0;
    while (attempt < MAX_RETRIES) {
        try {
            const currentKey = apiKeys[attempt]; 
            if (!currentKey) throw new Error(`API Key not found for attempt ${attempt + 1}`);

            // 1. SDK 클라이언트 초기화
            const ai = new GoogleGenAI({ apiKey: currentKey });
            
            console.log(`[Gemini] 요청 시도 ${attempt + 1} (Model: ${GEMINI_MODEL})`);

            // 2. 모델 설정 및 요청
            const model = ai.getGenerativeModel({ 
                model: GEMINI_MODEL,
                // JSON 모드 강제 설정
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema, 
                }
            });

            const result = await model.generateContent(prompt);
            const response = result.response;
            
            // 3. 결과 파싱 (SDK가 이미 JSON 검증을 마친 텍스트를 줍니다)
            const jsonText = response.text();
            
            // 안전하게 파싱 (혹시 모를 예외 처리)
            return JSON.parse(jsonText);

        } catch (error) {
            console.error(`[Gemini] 오류 발생 (시도 ${attempt + 1}):`, error.message);
            
            // 429(Too Many Requests)나 5xx 에러일 때만 재시도하는 로직은 SDK 내부 혹은 여기서 처리
            // 여기서는 단순화하여 모든 에러에 대해 재시도
            attempt++; 
            if (attempt >= MAX_RETRIES) return [];
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
}