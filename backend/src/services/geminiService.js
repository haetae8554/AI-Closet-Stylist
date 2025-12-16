import fetch from "node-fetch";
import dotenv from "dotenv";
import { getWeatherByRequest } from "./WeatherService.js";
import { getCalendarEvents } from "./CalendarService.js";

dotenv.config();

// ==========================================
// [설정] Gemini 모델명 및 재시도 설정
// ==========================================
const GEMINI_MODEL = "gemma-3-12b-it"; 
const MAX_RETRIES = 3; // 최대 재시도 횟수

/**
 * [Fallback] API 데이터 부재 시 계절별 평균 날씨 반환
 */
function getSeasonalWeather(date) {
    const month = date.getMonth() + 1;
    
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

/**
 * 날씨(API)와 일정(JSON)을 결합하여 컨텍스트 텍스트 생성
 */
async function formatContextForPrompt(weatherData, period) {
    let resultString = "";
    
    const start = period?.start ? new Date(period.start) : new Date();
    const end = period?.end ? new Date(period.end) : new Date();
    
    // 캘린더 일정 로드
    let allEvents = {};
    try {
        allEvents = await getCalendarEvents();
    } catch (e) {
        console.error("일정 로드 실패:", e);
    }

    const weatherItems = weatherData?.landFcst?.items || [];

    // 날짜 순회
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`; 
        const dateKeyNoHyphen = `${year}${month}${day}`;

        // (A) 일정
        const dayEvents = allEvents[dateKey] || [];
        const eventText = dayEvents.length > 0 
            ? `일정: ${dayEvents.map(e => e.title).join(", ")}` 
            : "일정: 특별한 일정 없음 (평상복)";

        // (B) 날씨
        let weatherDesc = "";
        const matchedWeathers = weatherItems.filter(item => {
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
            const seasonal = getSeasonalWeather(d);
            weatherDesc = `날씨(추정): 예보 데이터 없음. ${month}월 통계 기반 - ${seasonal}`;
        }

        resultString += `[${month}/${day} (${getDayName(d)})]\n  - ${weatherDesc}\n  - ${eventText}\n\n`;
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

/**
 * 옷 추천 메인 함수
 */
export async function getRecommendations(req, selected, clothes, period) {
    const API_KEY = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`;

    // 1. 날씨 정보 로드 (실패 시 null 처리하여 추정 로직 사용)
    let weatherData = null;
    try {
        weatherData = await getWeatherByRequest(req);
    } catch (error) {
        console.error("WeatherService Error:", error);
    }

    // 2. 컨텍스트 생성
    const contextString = await formatContextForPrompt(weatherData, period);

    // 3. 단일 날짜 여부 판단 (날짜 포맷 비교)
    const startDate = period?.start ? new Date(period.start) : new Date();
    const endDate = period?.end ? new Date(period.end) : new Date();
    const isSingleDay = startDate.toDateString() === endDate.toDateString();

    // 4. 프롬프트 생성 (요청 사항 반영)
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

[사용자 고정 아이템 (이건 무조건 포함, null이면 자유)]
${JSON.stringify(selected, null, 2)}
========================================

[필수 규칙]
1. 응답은 반드시 **JSON 배열** 형식이어야 합니다.
2. **수량 규칙**: ${countInstruction}
3. JSON 객체 구조:
   {
     "outer": "옷ID (없으면 null, 가을/겨울엔 필수)",
     "top": "옷ID",
     "bottom": "옷ID",
     "shoes": "옷ID",
     "reason": "추천 이유 (날씨와 일정을 구체적으로 언급하여 한국어로 작성)"
   }
4. **가장 중요**: 
   - 날씨 예보가 있으면 그에 맞추고, 예보가 없어서 '추정'된 날씨라면 계절감을 따르세요.
   - **일정(TPO)**이 있다면 그 일정에 맞는 무드(결혼식=정장/단정, 운동=편안함)를 최우선으로 하세요.
5. 고정된 아이템이 있다면 절대 바꾸지 마세요.
6. 없는 카테고리는 null 대신 다른 적절한 아이템을 찾으려고 노력하세요.

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

    // 5. Gemini 요청 (재시도 로직 포함)
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
        try {
            console.log(`[Gemini] ${GEMINI_MODEL} 코디 생성 요청... (시도 ${attempt + 1}/${MAX_RETRIES})`);
            
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            // 503 Service Unavailable 등 에러 처리
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                console.warn(`[Gemini] API Error Status: ${res.status}`, errorData);
                
                // 5xx 에러거나 429(Too Many Requests)인 경우 재시도 대상
                if (res.status >= 500 || res.status === 429) {
                    throw new Error(`Server Error ${res.status}`);
                }
                // 그 외(400 Bad Request 등)는 재시도 없이 즉시 종료
                return [];
            }

            const data = await res.json();
            
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
            const jsonStart = text.indexOf("[");
            const jsonEnd = text.lastIndexOf("]");

            if (jsonStart === -1 || jsonEnd === -1) {
                 console.error("Gemini 응답이 JSON 형식이 아닙니다:", text);
                 // JSON 형식이 아니면 재시도 해볼 가치가 있을 수도 있으나, 보통은 프롬프트 문제일 수 있음.
                 // 여기서는 실패로 처리하고 루프 계속(혹은 종료 선택 가능)
                 throw new Error("Invalid JSON format");
            }

            const jsonPart = text.slice(jsonStart, jsonEnd + 1);
            return JSON.parse(jsonPart); // 성공 시 반환

        } catch (error) {
            attempt++;
            console.error(`[Gemini] 통신/파싱 오류 (시도 ${attempt}):`, error.message);

            if (attempt >= MAX_RETRIES) {
                console.error("[Gemini] 최대 재시도 횟수 초과. 빈 배열 반환.");
                return [];
            }
            
            // 재시도 전 지수 백오프 (1초, 2초, 3초...)
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
}