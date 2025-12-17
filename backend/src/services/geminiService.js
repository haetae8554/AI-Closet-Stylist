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

// 공식 문서를 기반으로 실제 호출 가능한 모델명으로 구성
// 1. gemini-2.0-flash
// 2. gemini-1.5-flash
// 3. gemini-1.5-pro
const RETRY_STRATEGY = [
  { model: "gemini-2.0-flash", key: process.env.GEMINI_API_KEY1 },
  { model: "gemini-1.5-flash", key: process.env.GEMINI_API_KEY2 }, 
  { model: "gemini-1.5-pro",   key: process.env.GEMINI_API_KEY3 },
];

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

// [토큰 최적화] 옷 데이터에서 불필요한 필드 제거 (TPM 절약 핵심)
function optimizeClothesData(clothes) {
    if (!Array.isArray(clothes)) return [];
    return clothes.map(item => ({
        id: item.id,
        category: item.category,
        sub_category: item.sub_category,
        color: item.color,
        season: item.season, 
        thickness: item.thickness 
        // 이미지 URL, 등록일 등 코디 추천에 불필요한 데이터는 전송하지 않음
    }));
}

export async function getRecommendations(req, selected, clothes, period) {
    let weatherData = null;
    try {
        weatherData = await getWeatherByRequest(req);
    } catch (error) {
        console.error("WeatherService Error:", error);
    }

    const contextString = await formatContextForPrompt(weatherData, period);
    
    // 토큰 최적화 적용
    const optimizedClothes = optimizeClothesData(clothes);
    const optimizedSelected = {};
    
    // selected 객체 경량화
    for (const [key, val] of Object.entries(selected || {})) {
        if (val) optimizedSelected[key] = { id: val.id, category: val.category };
    }

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
    
    // 프롬프트: AI에게 명확한 역할과 포맷 부여
    const countInstruction = isSingleDay 
        ? "단일 날짜입니다. **서로 다른 스타일 3가지**를 제안하세요."
        : "여러 날짜입니다. **날짜별 최적 코디 1개씩** 제안하세요.";

    const prompt = `
당신은 AI 스타일리스트입니다. [날짜별 상황]에 맞춰 사용자의 [옷장]에서 옷을 골라주세요.

[상황]
${contextString}

[옷장 목록 (ID필수)]
${JSON.stringify(optimizedClothes)}

[사용자 고정 아이템 (절대 변경 금지)]
${JSON.stringify(optimizedSelected)}
위 고정 아이템이 있다면, 해당 카테고리는 반드시 제공된 ID를 사용해야 합니다.

[규칙]
1. 응답은 오직 **JSON 배열**만 출력하세요. (마크다운 없이)
2. ${countInstruction}
3. JSON 형식 예시:
   [
     {
       "date": "YYYY-MM-DD",
       "outer": "ID or null",
       "top": "ID",
       "bottom": "ID",
       "shoes": "ID",
       "reason": "한국어 추천 사유"
     }
   ]
`;

    const body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
    };

    // [핵심 로직] 모델 로테이션 (Retry Strategy)
    for (let attempt = 0; attempt < RETRY_STRATEGY.length; attempt++) {
        const strategy = RETRY_STRATEGY[attempt];
        
        try {
            if (!strategy.key) {
                console.warn(`[Gemini] API Key missing for strategy ${attempt + 1}`);
                continue; 
            }

            console.log(`[Gemini] 시도 ${attempt + 1}: 모델 ${strategy.model} 사용 중...`);
            
            // 모델마다 URL이 다르므로 동적으로 생성
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${strategy.model}:generateContent?key=${strategy.key}`;
            
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                // 429(Too Many Requests)나 5xx 에러는 다음 모델로 넘어감
                if (res.status === 429 || res.status >= 500) {
                    console.error(`[Gemini] ${strategy.model} 실패 (${res.status}) -> 다음 모델 전환`);
                    // 에러 던져서 catch 블록으로 이동 후 다음 루프 진행
                    throw new Error(`Server/Rate Limit Error ${res.status}`);
                }
                // 400 등 요청 자체의 문제는 즉시 종료
                const errText = await res.text();
                throw new Error(`Fatal API Error: ${res.status} - ${errText}`);
            }

            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
            
            // JSON 파싱
            const jsonStart = text.indexOf("[");
            const jsonEnd = text.lastIndexOf("]");
            if (jsonStart === -1 || jsonEnd === -1) throw new Error("Invalid JSON format");
            
            let result = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

            // [안전 장치] AI 응답 후, 고정 아이템이 있다면 강제로 덮어씌움 (100% 보장)
            if (selected && Object.keys(selected).length > 0) {
                result = result.map(outfit => {
                    const fixedOutfit = { ...outfit };
                    // 사용자가 선택한 아이템이 있다면 AI 결과를 무시하고 덮어씀
                    if (selected.outer) fixedOutfit.outer = selected.outer.id;
                    if (selected.top) fixedOutfit.top = selected.top.id;
                    if (selected.bottom) fixedOutfit.bottom = selected.bottom.id;
                    if (selected.shoes) fixedOutfit.shoes = selected.shoes.id;
                    return fixedOutfit;
                });
            }

            console.log(`[Gemini] 성공 (모델: ${strategy.model})`);
            return result; // 성공하면 즉시 리턴

        } catch (error) {
            console.error(`[Gemini] 시도 ${attempt + 1} 에러:`, error.message);
            
            // 마지막 시도였다면 빈 배열 반환
            if (attempt === RETRY_STRATEGY.length - 1) return [];
            
            // 재시도 전 잠시 대기
            await new Promise(r => setTimeout(r, 1000));
        }
    }
    
    return [];
}