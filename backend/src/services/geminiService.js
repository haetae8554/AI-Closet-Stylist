
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import dotenv from "dotenv";
import pg from "pg";
import { getWeatherByRequest } from "./WeatherService.js";

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

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
// [핵심 로직] 모델 로드 밸런싱 및 Fallback
// ---------------------------------------------------------
export async function getRecommendations(req, selected, clothes, period) {
    // 1. 사용할 API 키 목록
    const availableKeys = [
        process.env.GEMINI_API_KEY1,
        process.env.GEMINI_API_KEY2,
        process.env.GEMINI_API_KEY3
    ].filter(key => key !== undefined && key !== ""); 

    if (availableKeys.length === 0) {
        console.error("❌ [Error] 사용 가능한 API 키가 없습니다.");
        return [];
    }

    const MAIN_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
    const SAFETY_MODEL = "gemma-3-12b-it";

    // 2. 시도할 큐(Queue) 생성
    let attemptQueue = [];
    availableKeys.forEach(key => {
        MAIN_MODELS.forEach(modelName => {
            attemptQueue.push({ key: key, model: modelName });
        });
    });

    // 3. 랜덤 셔플 (로드 밸런싱)
    attemptQueue.sort(() => Math.random() - 0.5);

    // 4. 마지막 안전장치 추가
    attemptQueue.push({ key: availableKeys[0], model: SAFETY_MODEL });

    // --- 데이터 준비 ---
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
4. 반드시 JSON 형식으로만 응답해야 합니다.
`;

    // 표준 SDK용 스키마 정의
    const responseSchema = {
        type: SchemaType.ARRAY,
        items: {
            type: SchemaType.OBJECT,
            properties: {
                date: { type: SchemaType.STRING },
                outer: { type: SchemaType.STRING, nullable: true },
                top: { type: SchemaType.STRING },
                bottom: { type: SchemaType.STRING },
                shoes: { type: SchemaType.STRING },
                reason: { type: SchemaType.STRING }
            },
            required: ["date", "top", "bottom", "shoes", "reason"]
        }
    };

    // --- 실행 루프 ---
    for (let i = 0; i < attemptQueue.length; i++) {
        const { key, model: currentModelName } = attemptQueue[i];
        
        try {
            console.log(`[Gemini] 시도 ${i + 1}/${attemptQueue.length} - Model: ${currentModelName}`);

            // [수정됨] 표준 SDK 문법 사용 (GoogleGenerativeAI + getGenerativeModel)
            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({
                model: currentModelName,
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                }
            });

            const result = await model.generateContent(prompt);
            const response = await result.response; // await 필요
            const text = response.text();

            return JSON.parse(text);

        } catch (error) {
            console.error(`❌ [Gemini] 실패 (${currentModelName}):`, error.message);
            
            if (i === attemptQueue.length - 1) {
                console.error("모든 모델 및 키 시도 실패. 빈 결과를 반환합니다.");
                return [];
            }
            await new Promise(r => setTimeout(r, 500));
        }
    }
}