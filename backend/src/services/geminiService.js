import fetch from "node-fetch"; 
import dotenv from "dotenv";
import pg from "pg"; 
import { getWeatherByRequest } from "./WeatherService.js";

dotenv.config();
const { Pool } = pg;

// 2. DB 연결 설정
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Gemini 모델 및 설정
const GEMINI_MODEL = "gemma-3-12b-it"; 
const MAX_RETRIES = 3; 

// [추가] Date 객체를 한국 시간(KST) 기준의 Date 객체로 변환하는 헬퍼
function toKST(date) {
  // 현재 Date 객체의 타임스탬프(ms)
  const utc = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
  const KR_TIME_DIFF = 9 * 60 * 60 * 1000;
  return new Date(utc + KR_TIME_DIFF);
}

// API 데이터 부재 시 추정 날씨 반환 (KST 기준 월 사용)
function getSeasonalWeather(kstDate) {
    const month = kstDate.getMonth() + 1;
    
    if (month >= 3 && month <= 5) {
        return "평균 기온 10~20도, 일교차가 큰 봄 날씨 예상";
    } else if (month >= 6 && month <= 8) {
        return "평균 기온 25~30도, 덥고 습한 여름 날씨 예상";
    } else if (month >= 9 && month <= 11) {
        return "평균 기온 10~20도, 선선한 가을 날씨 예상";
    } else {
        return "평균 기온 영하~5도, 춥고 건조한 겨울 날씨 예상";
    }
}

// 컨텍스트 텍스트 생성
async function formatContextForPrompt(weatherData, period) {
    let resultString = "";
    
    // 기간 설정 (입력이 없으면 현재 시간 사용)
    // start/end가 문자열로 들어오더라도 new Date()로 처리하되, 
    // 반복문 내부에서 KST 변환을 수행하여 날짜 키를 맞춥니다.
    const start = period?.start ? new Date(period.start) : new Date();
    const end = period?.end ? new Date(period.end) : new Date();
    
    // 3. DB에서 캘린더 일정 가져오기
    let allEvents = {};
    try {
        const res = await pool.query("SELECT data FROM calendar ORDER BY id DESC LIMIT 1");
        if (res.rows.length > 0) {
            allEvents = res.rows[0].data || {};
        }
    } catch (e) {
        console.error("DB 일정 로드 실패:", e);
    }

    const weatherItems = weatherData?.landFcst?.items || [];

    // 날짜 반복
    // 주의: d는 루프 제어용 변수이고, 실제 날짜 문자열(YYYY-MM-DD) 생성은 kstDate를 사용
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        
        // [수정] 서버 시간이 아닌 KST 기준으로 연/월/일 추출
        const kstDate = toKST(d);
        
        const year = kstDate.getFullYear();
        const month = String(kstDate.getMonth() + 1).padStart(2, '0');
        const day = String(kstDate.getDate()).padStart(2, '0');
        
        // DB나 API 매칭을 위한 Key 생성 (한국 시간 기준)
        const dateKey = `${year}-${month}-${day}`; 
        const dateKeyNoHyphen = `${year}${month}${day}`;

        // 일정 처리
        const dayEvents = allEvents[dateKey] || [];
        const eventText = dayEvents.length > 0 
            ? `일정: ${dayEvents.map(e => e.title).join(", ")}` 
            : "일정: 특별한 일정 없음 (평상복)";

        // 날씨 처리
        let weatherDesc = "";
        const matchedWeathers = weatherItems.filter(item => {
            // 기상청 데이터(TM_EF) 형식: YYYYMMDDHHmm
            const fcstDateRaw = item.tmEf || item.TM_EF || ""; 
            return fcstDateRaw.startsWith(dateKeyNoHyphen);
        });

        if (matchedWeathers.length > 0) {
            const temps = matchedWeathers
                .map(it => Number(it.TA || it.ta || -99))
                .filter(t => t > -99);
            
            const skyStatus = matchedWeathers[0].WF || matchedWeathers[0].wf || "맑음";
            
            if (temps.length > 0) {
                const minT = Math.min(...temps);
                const maxT = Math.max(...temps);
                weatherDesc = `날씨(예보): 기온 ${minT}~${maxT}도, ${skyStatus}`;
            } else {
                weatherDesc = `날씨(예보): ${skyStatus}`;
            }
        } else {
            // 추정 날씨도 KST 기준 날짜 객체 전달
            const seasonal = getSeasonalWeather(kstDate);
            weatherDesc = `날씨(추정): 예보 데이터 없음. ${month}월 통계 기반 - ${seasonal}`;
        }

        // 요일도 KST 기준으로 구함
        resultString += `[${month}/${day} (${getDayName(kstDate)})]\n  - ${weatherDesc}\n  - ${eventText}\n\n`;
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

// 옷 추천 메인 함수
export async function getRecommendations(req, selected, clothes, period) {
    // API 키 배열 생성 (순서대로 1, 2, 3)
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

    // 시작/종료일 비교 시에도 KST 기준을 고려하거나, 
    // 단순 문자열 비교를 위해 입력받은 원본 period 객체 활용이 안전할 수 있음.
    // 여기서는 간단히 toDateString 비교 유지 (큰 차이 없음)
    const startDate = period?.start ? new Date(period.start) : new Date();
    const endDate = period?.end ? new Date(period.end) : new Date();
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

[필수 규칙]
1. 응답은 반드시 **JSON 배열** 형식이어야 합니다.
2. **수량 규칙**: ${countInstruction}
3. JSON 객체 구조:
   {
     "outer": "옷ID (없으면 null)",
     "top": "옷ID",
     "bottom": "옷ID",
     "shoes": "옷ID",
     "reason": "추천 이유 (날씨와 일정을 구체적으로 언급하여 한국어로 작성)"
   }
4. 날씨와 TPO(일정)를 최우선으로 고려하세요.
5. 고정된 아이템이 있다면 절대 바꾸지 마세요.

출력 예시:
[
  {
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
            
            if (!currentKey) {
                throw new Error(`API Key not found for attempt ${attempt + 1}`);
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${currentKey}`;
            
            console.log(`[Gemini] 요청 시도 ${attempt + 1} (API Key ${attempt + 1} 사용)`);
            
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                if (res.status === 429 || res.status >= 500) {
                    throw new Error(`Retryable Error: ${res.status}`);
                }
                console.error(`[Gemini] 요청 실패: ${res.status}`);
                return []; 
            }

            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
            const jsonStart = text.indexOf("[");
            const jsonEnd = text.lastIndexOf("]");

            if (jsonStart === -1 || jsonEnd === -1) {
                 throw new Error("Invalid JSON format");
            }

            const jsonPart = text.slice(jsonStart, jsonEnd + 1);
            return JSON.parse(jsonPart);

        } catch (error) {
            console.error(`[Gemini] 오류 발생 (시도 ${attempt + 1}):`, error.message);
            
            attempt++; 

            if (attempt >= MAX_RETRIES) {
                console.error("[Gemini] 모든 API 키 시도 실패");
                return [];
            }
            
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
}