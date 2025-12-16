import fetch from "node-fetch"; 
import dotenv from "dotenv";
import pg from "pg"; 
import { getWeatherByRequest } from "./WeatherService.js";

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const GEMINI_MODEL = "gemma-3-12b-it"; 
const MAX_RETRIES = 3; 

// [중요] Date 객체를 한국 시간(KST) 기준의 Date 객체로 변환하는 헬퍼
// 이 함수는 'UTC 시간'을 'KST 시간값'을 가진 Date 객체로 '이동'시킵니다.
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
    
    // [수정] 기간이 없으면(null), 서버 시간이 아닌 "한국 시간 기준 오늘"을 사용
    let start, end;
    if (period?.start) {
        start = new Date(period.start);
        end = period.end ? new Date(period.end) : new Date(period.start);
    } else {
        // period가 없으면 현재 서버 시간(UTC)을 한국 시간으로 변환하여 기준 잡음
        // 주의: 여기서 toKST를 쓰면 시각이 9시간 밀리므로, 날짜 계산 시 이 '밀린 시간'을 기준으로 해야 함
        const kstNow = toKST(new Date()); 
        start = kstNow;
        end = kstNow;
    }

    // 캘린더 가져오기
    let allEvents = {};
    try {
        const res = await pool.query("SELECT data FROM calendar ORDER BY id DESC LIMIT 1");
        if (res.rows.length > 0) allEvents = res.rows[0].data || {};
    } catch (e) {
        console.error("DB 일정 로드 실패:", e);
    }

    const weatherItems = weatherData?.landFcst?.items || [];

    // 날짜 반복 (start와 end가 이미 KST로 보정된 시간이거나, UTC 00:00(한국 09:00)이므로 그대로 루프)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        
        // d가 이미 KST로 조정된 시간이거나, 날짜만 있는 UTC 00:00이라면
        // getFullYear() 등이 한국 날짜와 일치하게 됩니다.
        // 다만, 안전을 위해 루프 내부에서도 한 번 더 KST 변환(혹은 유지)을 고려해야 하는데,
        // 위에서 start/end를 이미 처리했으므로 여기선 d를 그대로 씁니다.
        // (단, period가 문자열로 들어온 경우 Node는 UTC 00시로 인식 -> 한국 09시. 날짜 일치함)
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        
        const dateKey = `${year}-${month}-${day}`; 
        const dateKeyNoHyphen = `${year}${month}${day}`;

        // 일정
        const dayEvents = allEvents[dateKey] || [];
        const eventText = dayEvents.length > 0 
            ? `일정: ${dayEvents.map(e => e.title).join(", ")}` 
            : "일정: 특별한 일정 없음 (평상복)";

        // 날씨 매칭
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

    // 컨텍스트 생성
    const contextString = await formatContextForPrompt(weatherData, period);

    // [수정] start/end 계산 시에도 KST 고려 (단일 날짜 여부 판단용)
    let startDate, endDate;
    if (period?.start) {
        startDate = new Date(period.start);
        endDate = period.end ? new Date(period.end) : new Date(period.start);
    } else {
        const kstNow = toKST(new Date());
        startDate = kstNow;
        endDate = kstNow;
    }
    
    // toDateString()으로 비교 (날짜만 비교)
    const isSingleDay = startDate.toDateString() === endDate.toDateString();

    const countInstruction = isSingleDay 
        ? "현재 '단일 날짜' 요청입니다. 해당 날짜의 날씨와 TPO에 맞춰 **서로 다른 무드의 코디 조합을 3가지** 제안하세요."
        : "현재 '여러 날짜' 요청입니다. **각 날짜별로 최적의 코디를 1개씩** 제안하세요.";

    // [수정] 프롬프트: JSON 출력 시 'date' 필드를 반드시 포함하도록 강력 지시
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
3. JSON 객체 구조 (반드시 준수):
   {
     "date": "YYYY-MM-DD (해당 코디가 추천된 날짜를 정확히 기입)",
     "outer": "옷ID (없으면 null)",
     "top": "옷ID",
     "bottom": "옷ID",
     "shoes": "옷ID",
     "reason": "추천 이유 (날씨와 일정을 구체적으로 언급하여 한국어로 작성)"
   }
4. 날씨와 TPO(일정)를 최우선으로 고려하세요.
5. 고정된 아이템이 있다면 절대 바꾸지 마세요.
6. [날짜별 상황]에 명시된 날짜를 "date" 필드에 정확히 매핑해야 합니다.

출력 예시:
[
  {
    "date": "2023-12-23",
    "outer": "coat-123",
    "top": "knit-55",
    "bottom": "jean-22",
    "shoes": "boots-01",
    "reason": "..."
  }
]
`;

    const body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
    };

    let attempt = 0;
    while (attempt < MAX_RETRIES) {
        try {
            const currentKey = apiKeys[attempt]; 
            if (!currentKey) throw new Error(`API Key not found for attempt ${attempt + 1}`);

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${currentKey}`;
            console.log(`[Gemini] 요청 시도 ${attempt + 1}`);
            
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                if (res.status === 429 || res.status >= 500) throw new Error(`Retryable Error: ${res.status}`);
                console.error(`[Gemini] 요청 실패: ${res.status}`);
                return []; 
            }

            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
            const jsonStart = text.indexOf("[");
            const jsonEnd = text.lastIndexOf("]");

            if (jsonStart === -1 || jsonEnd === -1) throw new Error("Invalid JSON format");

            const jsonPart = text.slice(jsonStart, jsonEnd + 1);
            return JSON.parse(jsonPart);

        } catch (error) {
            console.error(`[Gemini] 오류 발생 (시도 ${attempt + 1}):`, error.message);
            attempt++; 
            if (attempt >= MAX_RETRIES) return [];
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
}