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

// [헬퍼 함수] 시간 변환 (구버전 로직 유지)
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

// =========================================================
// [핵심 수정] 구버전의 '잘 되던 로직' + 신버전의 '안정성' 결합
// =========================================================
export async function getRecommendations(req, selected, clothes, period) {
    // 1. API 키 확인
    const availableKeys = [
        process.env.GEMINI_API_KEY1,
        process.env.GEMINI_API_KEY2,
        process.env.GEMINI_API_KEY3
    ].filter(k => k);

    if (availableKeys.length === 0) {
        console.error("❌ [Error] API 키가 없습니다.");
        return [];
    }

    // 2. 모델 설정 (로드 밸런싱)
    const MAIN_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
    const SAFETY_MODEL = "gemma-3-12b-it";

    let attemptQueue = [];
    availableKeys.forEach(key => {
        MAIN_MODELS.forEach(model => attemptQueue.push({ key, model }));
    });
    attemptQueue.sort(() => Math.random() - 0.5); // 셔플
    attemptQueue.push({ key: availableKeys[0], model: SAFETY_MODEL }); // 마지막 안전장치

    // 3. 데이터 준비
    let weatherData = null;
    try {
        weatherData = await getWeatherByRequest(req);
    } catch (e) { console.error(e); }

    const contextString = await formatContextForPrompt(weatherData, period);

    // 날짜 계산 (구버전 로직 유지)
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

    // 4. 프롬프트 (구버전 내용 완벽 복원 + ID 사용 강조)
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

[필수 규칙]
1. 응답은 반드시 **JSON 배열** 형식이어야 합니다.
2. **수량 규칙**: ${countInstruction}
3. **[중요]** 'outer', 'top', 'bottom', 'shoes' 필드에는 옷의 이름이 아니라 **반드시 [사용자 옷장 목록]에 있는 'id' 값**을 정확히 넣어야 합니다.
4. 해당 카테고리에 추천할 옷이 없거나 필요 없는 경우(예: 여름이라 아우터 불필요)에는 null을 넣으세요.
5. 날씨와 TPO(일정)를 최우선으로 고려하세요.
6. 고정된 아이템이 있다면 절대 바꾸지 마세요.
`;

    // 5. JSON 스키마 (프론트엔드가 원하는 형식을 강제함)
    const responseSchema = {
        type: SchemaType.ARRAY,
        items: {
            type: SchemaType.OBJECT,
            properties: {
                date: { type: SchemaType.STRING, description: "YYYY-MM-DD" },
                // [중요] null 허용 (nullable: true)
                outer: { type: SchemaType.STRING, nullable: true, description: "옷의 ID 값 (없으면 null)" },
                top: { type: SchemaType.STRING, description: "옷의 ID 값" },
                bottom: { type: SchemaType.STRING, description: "옷의 ID 값" },
                shoes: { type: SchemaType.STRING, description: "옷의 ID 값" },
                reason: { type: SchemaType.STRING, description: "추천 이유" }
            },
            required: ["date", "top", "bottom", "shoes", "reason"]
        }
    };

    // 6. 실행 루프
    for (let i = 0; i < attemptQueue.length; i++) {
        const { key, model: currentModelName } = attemptQueue[i];
        
        try {
            console.log(`[Gemini] 시도 ${i+1}/${attemptQueue.length} - ${currentModelName}`);
            
            const genAI = new GoogleGenerativeAI(key);
            const model = genAI.getGenerativeModel({
                model: currentModelName,
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                }
            });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            
            // JSON 파싱해서 반환
            return JSON.parse(response.text());

        } catch (error) {
            console.error(`❌ 실패 (${currentModelName}):`, error.message);
            if (i === attemptQueue.length - 1) return []; // 모두 실패시 빈배열
            await new Promise(r => setTimeout(r, 500));
        }
    }
}