// src/App.js
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./App.css";

function normalizeItem(raw, idx = 0) {
  const id = String(raw?.id ?? Date.now() + "-" + idx);
  const brand = String(raw?.brand ?? "").trim();
  const nameRaw = (raw?.name ?? "").trim();
  const name = nameRaw || "이름 없음";
  
  let imageUrl = raw?.imageUrl;
  if (!imageUrl || imageUrl.trim?.() === "" || imageUrl === "null") {
      imageUrl = "/images/placeholder.png";
  }

  return {
      id,
      name,
      brand,
      imageUrl,
  };
}

// 숫자 두 자리
function pad2(n) {
  return n < 10 ? "0" + n : String(n);
}

// 요일 이름
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

// KMA 시각 포맷 변환 (TM_FC: yyyymmddHHmm)
function formatKmaTime(value) {
  if (value === null || value === undefined) return "";
  const s = String(value).trim();
  if (s.length !== 12) return s;

  const y = s.slice(0, 4);
  const m = s.slice(4, 6);
  const d = s.slice(6, 8);
  const h = s.slice(8, 10);
  const min = s.slice(10, 12);
  return `${y}-${m}-${d} ${h}:${min}`;
}

// KMA 날짜 문자열 → Date
function parseKmaDate(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (s.length !== 12 && s.length !== 10 && s.length !== 8) return null;

  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6)) - 1;
  const d = Number(s.slice(6, 8));
  const h = s.length >= 10 ? Number(s.slice(8, 10)) : 0;

  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  return new Date(y, m, d, h);
}

// MM/DD(요일) 포맷
function formatShortKoreanDate(date) {
  if (!date) return "";
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const w = DAY_NAMES[date.getDay()];
  return `${mm}/${dd}(${w})`;
}

// 날씨 코드/문장 → 이모지
function getWeatherEmoji(skyCode, summaryText = "") {
  const code = String(skyCode || "");
  const text = String(summaryText || "");

  if (code.includes("DB") || code.includes("RA") || text.includes("비")) return "🌧️";
  if (code.includes("SN") || text.includes("눈")) return "❄️";
  if (code === "1" || text.includes("맑")) return "☀️";
  if (code === "2" || text.includes("구름")) return "⛅";
  return "🌤️";
}

// 아이템에서 날짜키 추출 yyyymmdd
function getDateKeyFromItem(it) {
  const raw =
    it.TM_EF ||
    it.tmEf ||
    it.tmEfDateTime ||
    it.TM_FC ||
    it.tmFc ||
    "";
  const s = String(raw).trim();
  if (s.length < 8) return null;
  return s.slice(0, 8);
}

function App() {
  const navigate = useNavigate();

  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");
  const [randomClothes, setRandomClothes] = useState([]);
  const [viewDate, setViewDate] = useState(new Date()); // 현재 보고 있는 달
  const [startDate, setStartDate] = useState(null); // 기간 시작일
  const [endDate, setEndDate] = useState(null);     // 기간 종료일

  // [캘린더] 월 이동 함수
  const changeMonth = (offset) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setViewDate(newDate);
  };

  // [캘린더] 날짜 클릭 핸들러 (기간 선택 로직)
  const handleDateClick = (day) => {
    const clickedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);

    // 1. 아무것도 선택 안된 경우 -> 시작일 설정
    if (!startDate || (startDate && endDate)) {
      setStartDate(clickedDate);
      setEndDate(null);
    } 
    // 2. 시작일만 있는 경우 -> 종료일 설정 (단, 시작일보다 앞서면 시작일을 변경)
    else if (startDate && !endDate) {
      if (clickedDate < startDate) {
        setStartDate(clickedDate);
      } else {
        setEndDate(clickedDate);
      }
    }
  };

  // [캘린더] 날짜 렌더링 헬퍼
  const renderCalendarGrid = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // 이번 달의 첫 날 요일 (0:일, 1:월 ...)
    const firstDay = new Date(year, month, 1).getDay();
    // 이번 달의 마지막 날짜
    const lastDate = new Date(year, month + 1, 0).getDate();

    const days = [];

    // 빈 칸 채우기 (첫 주)
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="day-cell empty"></div>);
    }

    // 날짜 채우기
    for (let day = 1; day <= lastDate; day++) {
      const currentDate = new Date(year, month, day);
      
      // 스타일 결정을 위한 조건 확인
      const isSun = currentDate.getDay() === 0;
      const isSat = currentDate.getDay() === 6;
      
      // 선택 상태 확인
      let className = "day-cell";
      if (isSun) className += " sun";
      if (isSat) className += " sat";

      if (startDate && currentDate.getTime() === startDate.getTime()) className += " range-start";
      else if (endDate && currentDate.getTime() === endDate.getTime()) className += " range-end";
      else if (startDate && endDate && currentDate > startDate && currentDate < endDate) className += " in-range";

      days.push(
        <div 
          key={day} 
          className={className} 
          onClick={() => handleDateClick(day)}
        >
          <span className="day-number">{day}</span>
        </div>
      );
    }
    return days;
  };

  // [캘린더] 선택된 기간 텍스트
  const getPeriodText = () => {
    if (!startDate) return "AI 추천을 받을 기간을 선택해주세요.";
    const startStr = `${startDate.getMonth()+1}/${startDate.getDate()}`;
    if (!endDate) return `${startStr} ~ (종료일 선택)`;
    const endStr = `${endDate.getMonth()+1}/${endDate.getDate()}`;
    return `📅 선택된 기간: ${startStr} ~ ${endStr}`;
  };

  useEffect(() => {
    async function fetchWeather() {
      try {
        setWeatherLoading(true);
        setWeatherError("");

        // proxy 설정을 사용하므로 절대경로 대신 상대경로 사용
        const res = await fetch(`/api/weather/current`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        setWeather(data);
      } catch (e) {
        console.error("[FRONT] 날씨 조회 오류:", e);
        setWeatherError(e.message || "날씨 조회 실패");
      } finally {
        setWeatherLoading(false);
      }
    }

    fetchWeather();
  }, []);

  useEffect(() => {
    async function fetchClothes() {
      try {
        const res = await fetch("http://localhost:3001/api/clothes");
        if (!res.ok) return;
        const data = await res.json();
        const normalized = (Array.isArray(data) ? data : []).map(normalizeItem);
        const shuffled = [...normalized].sort(() => 0.5 - Math.random());
        setRandomClothes(shuffled.slice(0, 8));
        } catch (e) {
        console.error("옷 데이터 로드 실패", e);
      }
    }
    fetchClothes();
  }, []);

  const goToCloset = () => navigate("/closet");
  const goToAI = () => navigate("/AI");

  const goToDetail = (item) => {
    navigate(`/closet_detail?id=${encodeURIComponent(item.id)}`, {
        state: { item },
    });
  };

  const renderWeather = () => {
    if (weatherLoading) {
      return <p className="weather-message">날씨 정보를 불러오는 중입니다.</p>;
    }
    if (weatherError) {
      return <p className="weather-message">날씨 정보를 가져오지 못했습니다.</p>;
    }
    if (!weather) {
      return <p className="weather-message">날씨 정보가 없습니다.</p>;
    }

    const loc = weather.location || {};
    const regionName =
      weather.regionName ||
      (weather.region && weather.region.name) ||
      loc.city ||
      loc.region ||
      "";

    const land = weather.landFcst || {};
    const items = Array.isArray(land.items) ? land.items : [];
    const main = items[1] || items[0] || null;

    if (!main) {
      return <p className="weather-message">예보 데이터가 없습니다.</p>;
    }

    const tmFc =
      main.TM_FC ||
      main.tmFc ||
      main.tmFcDateTime ||
      main.announceTime ||
      null;

    const baseDate =
      parseKmaDate(main.TM_EF || main.TM_FC || main.tmEf || main.tmFc) ||
      new Date();
    const todayKey =
      baseDate &&
      `${baseDate.getFullYear()}${pad2(baseDate.getMonth() + 1)}${pad2(
        baseDate.getDate()
      )}`;

    let temp = null;
    {
      const cand = [main.TA, main.ta, main.temp, main.tmn, main.tmx];
      const found = cand.find(
        (v) => v !== undefined && v !== null && String(v).trim() !== ""
      );
      if (found !== undefined) {
        const n = Number(found);
        temp = Number.isNaN(n) ? found : n;
      }
    }

    const summary =
      main.WF || main.wf || main.wfSv || main.wfTxt || "예보 요약 없음";
    const skyCode = main.SKY || main.sky || main.wfCd || "";
    const rainProb = main.rnSt ?? main.RN_ST ?? main.ST ?? null;

    const wind1 = main.wd1 || main.WD1 || "";
    const wind2 = main.wd2 || main.WD2 || "";
    const windText =
      wind1 && wind2 ? `${wind1} → ${wind2}` : wind1 || wind2 || "";

    const todayEmoji = getWeatherEmoji(skyCode, summary);

    // 날짜별 그룹화
    const groupsMap = {};
    for (const it of items) {
      const key = getDateKeyFromItem(it);
      if (!key) continue;
      if (!groupsMap[key]) {
        groupsMap[key] = {
          key,
          date: parseKmaDate(key + "0000"),
          items: [],
        };
      }
      groupsMap[key].items.push(it);
    }

    const allGroups = Object.values(groupsMap).sort((a, b) =>
      a.key.localeCompare(b.key)
    );

    const dayMs = 24 * 60 * 60 * 1000;
    const baseDay = allGroups.find((g) => g.key === todayKey)?.date || baseDate;

    const futureGroups = [];
    for (const g of allGroups) {
      if (!g.date || !baseDay) continue;
      const diffDays = Math.round((g.date.getTime() - baseDay.getTime()) / dayMs);
      if (diffDays <= 0) continue;
      if (diffDays > 2) continue;
      futureGroups.push({ ...g, diffDays });
      if (futureGroups.length >= 2) break;
    }

    const getDayLabel = (diff) => {
      if (diff === 1) return "내일";
      if (diff === 2) return "모레";
      return `${diff}일 후`;
    };

    const forecastList = futureGroups.map((g, idx) => {
      const temps = [];
      const rains = [];
      let sumText = "";
      let code = "";

      for (const it of g.items) {
        const candT = [it.TA, it.ta, it.temp, it.tmn, it.tmx];
        const foundT = candT.find(
          (v) => v !== undefined && v !== null && String(v).trim() !== ""
        );
        if (foundT !== undefined) {
          const n = Number(foundT);
          if (!Number.isNaN(n) && n > -99) temps.push(n);
        }

        const candR = [it.rnSt, it.RN_ST, it.ST];
        const foundR = candR.find(
          (v) => v !== undefined && v !== null && String(v).trim() !== ""
        );
        if (foundR !== undefined) {
          const n = Number(foundR);
          if (!Number.isNaN(n) && n >= 0) rains.push(n);
        }

        const s = it.wf || it.WF || "";
        if (s) sumText = s;
        code = it.wfCd || it.WFCD || it.SKY || it.sky || code || "";
      }

      const minT = temps.length ? Math.min(...temps) : null;
      const maxT = temps.length ? Math.max(...temps) : null;
      const maxRain = rains.length ? Math.max(...rains) : null;

      const emoji = getWeatherEmoji(code, sumText || summary);
      const dateLabel = g.date ? formatShortKoreanDate(g.date) : "";
      const labelText = `${getDayLabel(g.diffDays)}${dateLabel ? " " + dateLabel : ""
        }`;

      let tempText = "--℃";
      if (minT !== null && maxT !== null) {
        if (minT === maxT) tempText = `${maxT}℃`;
        else tempText = `${minT}~${maxT}℃`;
      }

      return (
        <div className="forecast-item" key={idx}>
          <div className="forecast-left">
            <div className="forecast-emoji">{emoji}</div>
            <div className="forecast-label">{labelText}</div>
          </div>
          <div className="forecast-right">
            <div className="forecast-temp">{tempText}</div>
            <div className="forecast-sub">
              <span className="forecast-summary">
                {sumText || "예보 없음"}
              </span>
              {maxRain !== null && (
                <span className="forecast-rain">· 강수 {maxRain}%</span>
              )}
            </div>
          </div>
        </div>
      );
    });

    return (
      <div className="weather-card">
        <div className="weather-icon">{todayEmoji}</div>

        <div className="weather-temp">
          {temp !== null && temp !== undefined ? `${temp}℃` : "--℃"}
        </div>

        <div className="weather-summary">{summary}</div>

        <div className="weather-location-main">
          {regionName || loc.city || loc.region || "-"}
        </div>

        <div className="weather-info-list">
          {rainProb !== null && (
            <div className="info-row">
              <span className="label">강수확률</span>
              <span className="value">{rainProb}%</span>
            </div>
          )}
          {windText && (
            <div className="info-row">
              <span className="label">바람</span>
              <span className="value">{windText}</span>
            </div>
          )}
        </div>

        {forecastList.length > 0 && (
          <div className="weather-forecast-list">{forecastList}</div>
        )}

        {tmFc && (
          <div className="weather-basetime">
            기준시각 {formatKmaTime(tmFc)}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <nav id="nav3">
        <a href="/" className="logo">AI Closet</a>
        <ul>
            <li><Link to="/closet">옷장</Link></li>
            <li><Link to="/AI">AI 추천</Link></li>
            <li><Link to="/calendar">캘린더</Link></li>
            <li><a href="#!">menu4</a></li>
            <li><a href="#!">menu5</a></li>
        </ul>
        <button 
          className="nav-upload-btn" 
          onClick={() => navigate("/closet/upload")}
        >
          옷 등록하기
        </button>
      </nav>

      <main className="clothes-area">
        <h2>My Closet</h2>

        <button className="registration-btn" onClick={goToCloset}>
          옷장으로 이동
        </button>

        <div className="main-dashboard">
          
          <section className="random-clothes-section">
            <h3>오늘의 추천 코디 (랜덤)</h3>
            
            {randomClothes.length > 0 ? (
              <div className="dashboard-grid">
                {randomClothes.map((item) => (
                  <div 
                    key={item.id} 
                    className="mini-card"
                    onClick={() => goToDetail(item)}
                  >
                    <div className="mini-thumb">
                      <img 
                        src={item.imageUrl} 
                        alt={item.name}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "/images/placeholder.png";
                        }}
                      />
                    </div>
                    <div className="mini-info">
                      <span className="mini-brand">{item.brand}</span>
                      <span className="mini-name">{item.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="placeholder-content">
                <p>옷을 불러오는 중이거나<br />등록된 옷이 없습니다.</p>
              </div>
            )}
          </section>

          <aside className="weather-section">
            <h3>오늘의 날씨</h3>
            <div className="placeholder-content-weather">
               {renderWeather()} 
            </div>
          </aside>
        </div>
        {/* ─────────────── [추가] 캘린더 섹션 ─────────────── */}
        <section className="calendar-section">
          <h3>📅 AI 코디 캘린더 (기간 설정)</h3>

          <div className="calendar-container">
            {/* 1. 헤더: 년/월 이동 */}
            <div className="calendar-header">
              <button onClick={() => changeMonth(-1)}>◀ 이전 달</button>
              <h4>{viewDate.getFullYear()}년 {viewDate.getMonth() + 1}월</h4>
              <button onClick={() => changeMonth(1)}>다음 달 ▶</button>
            </div>

            {/* 2. 요일 헤더 */}
            <div className="calendar-days-header">
              <div className="day-name sun">일</div>
              <div className="day-name">월</div>
              <div className="day-name">화</div>
              <div className="day-name">수</div>
              <div className="day-name">목</div>
              <div className="day-name">금</div>
              <div className="day-name sat">토</div>
            </div>

            {/* 3. 날짜 그리드 */}
            <div className="calendar-grid">
              {renderCalendarGrid()}
            </div>
          </div>

          <div className="selected-range-info">
            {getPeriodText()}
          </div>
        </section>
        {/* ──────────────────────────────────────────────── */}

        <section className="ai-section">
          <button className="ai-recommend-btn" onClick={goToAI}>
            ✨ AI 추천 받기
          </button>
          <div className="ai-recommend-display">
            <p>버튼을 누르면 이곳에<br />AI가 추천하는 옷이 표시됩니다.</p>
          </div>
        </section>
      </main>
    </>
  );
}

export default App;
