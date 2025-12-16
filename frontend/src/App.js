import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./App.css";
// [핵심] API 설정 파일 임포트
import { API_BASE_URL } from "./apiConfig";

// ────────────────────────────────────────────────────────────────
// 좌표 변환 함수
function dfs_xy_conv(code, v1, v2) {
  const RE = 6371.00877; 
  const GRID = 5.0; 
  const SLAT1 = 30.0; 
  const SLAT2 = 60.0; 
  const OLON = 126.0; 
  const OLAT = 38.0; 
  const XO = 43; 
  const YO = 136; 

  const DEGRAD = Math.PI / 180.0;

  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  const rs = {};
  if (code === "toXY") {
    rs["lat"] = v1;
    rs["lng"] = v2;
    let ra = Math.tan(Math.PI * 0.25 + v1 * DEGRAD * 0.5);
    ra = (re * sf) / Math.pow(ra, sn);
    let theta = v2 * DEGRAD - olon;
    if (theta > Math.PI) theta -= 2.0 * Math.PI;
    if (theta < -Math.PI) theta += 2.0 * Math.PI;
    theta *= sn;
    rs["x"] = Math.floor(ra * Math.sin(theta) + XO + 0.5);
    rs["y"] = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
  }
  return rs;
}
// ────────────────────────────────────────────────────────────────

// 헬퍼 함수들
function normalizeItem(raw, idx = 0) {
  const id = String(raw?.id ?? Date.now() + "-" + idx);
  const brand = String(raw?.brand ?? "").trim();
  const nameRaw = (raw?.name ?? "").trim();
  const name = nameRaw || "이름 없음";
  
  let imageUrl = raw?.imageUrl;
  if (!imageUrl || imageUrl.trim?.() === "" || imageUrl === "null") {
      imageUrl = "/images/placeholder.png";
  }

  return { id, name, brand, imageUrl };
}

function pad2(n) { return n < 10 ? "0" + n : String(n); }
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function formatKmaTime(value) {
  if (value === null || value === undefined) return "";
  const s = String(value).trim();
  if (s.length !== 12) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)} ${s.slice(8, 10)}:${s.slice(10, 12)}`;
}

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

function formatShortKoreanDate(date) {
  if (!date) return "";
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const w = DAY_NAMES[date.getDay()];
  return `${mm}/${dd}(${w})`;
}

function getWeatherEmoji(skyCode, summaryText = "") {
  const code = String(skyCode || "");
  const text = String(summaryText || "");
  if (code.includes("DB") || code.includes("RA") || text.includes("비")) return "🌧️";
  if (code.includes("SN") || text.includes("눈")) return "❄️";
  if (code === "1" || text.includes("맑")) return "☀️";
  if (code === "2" || text.includes("구름")) return "⛅";
  return "🌤️";
}

function getDateKeyFromItem(it) {
  const raw = it.TM_EF || it.tmEf || it.tmEfDateTime || it.TM_FC || it.tmFc || "";
  const s = String(raw).trim();
  if (s.length < 8) return null;
  return s.slice(0, 8);
}

export default function App() {
  const navigate = useNavigate();

  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");
  const [randomClothes, setRandomClothes] = useState([]);
  
  const [viewDate, setViewDate] = useState(new Date()); 
  const [events, setEvents] = useState({});

  // 캘린더 데이터 조회
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/calendar`)
      .then(res => {
        if(!res.ok) throw new Error("네트워크 응답 실패");
        return res.json();
      })
      .then(data => setEvents(data))
      .catch(e => console.error("일정 불러오기 실패", e));
  }, []);

  const getDateKey = (year, month, day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const changeMonth = (offset) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setViewDate(newDate);
  };

  const handleDateClick = () => {
    navigate("/calendar");
  };

  const renderCalendarGrid = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="day-cell empty"></div>);
    }

    for (let day = 1; day <= lastDate; day++) {
      const currentDate = new Date(year, month, day);
      const isSun = currentDate.getDay() === 0;
      const isSat = currentDate.getDay() === 6;
      
      const dateKey = getDateKey(year, month, day);
      const dayEvents = events[dateKey] || [];

      let className = "day-cell";
      if (isSun) className += " sun";
      if (isSat) className += " sat";

      days.push(
        <div 
          key={day} 
          className={className} 
          onClick={handleDateClick} 
          title="클릭하여 상세 일정 관리" 
          style={{ position: "relative", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "stretch", padding: "2px" }}
        >
          <span className="day-number" style={{ alignSelf: "flex-start", fontSize: "0.8rem", marginBottom: "2px" }}>{day}</span>
          
          <div className="main-cal-events">
            {dayEvents.slice(0, 3).map((evt) => (
                <div key={evt.id} className="main-event-text">
                    {evt.title}
                </div>
            ))}
            {dayEvents.length > 3 && <div className="main-event-more">+</div>}
          </div>
        </div>
      );
    }
    return days;
  };

  // 날씨 조회 로직
  useEffect(() => {
    const fetchWeather = async (lat, lon) => {
      try {
        if (!weather) setWeatherLoading(true);
        setWeatherError("");
        
        let url = `${API_BASE_URL}/api/weather/current`;
        if (lat && lon) {
           url += `?lat=${lat}&lon=${lon}`;
        }
        
        console.log("📡 날씨 요청 URL:", url);

        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setWeather(data);
      } catch (e) {
        console.error("[FRONT] 날씨 조회 오류:", e);
        setWeatherError(e.message || "날씨 조회 실패");
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather(null, null);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          console.log(`📍 사용자 위치 확보: ${lat}, ${lon} -> 날씨 업데이트 시도`);
          fetchWeather(lat, lon);
        },
        (error) => {
          console.warn("⚠️ 위치 정보 권한 거부 또는 에러 (기본 서울 날씨 유지)", error);
        }
      );
    }
  }, []);

  // 옷 목록 조회
  useEffect(() => {
    async function fetchClothes() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/clothes`);
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
    navigate(`/closet/detail?id=${encodeURIComponent(item.id)}`, {
        state: { 
            item,
            from: "home"
        },
    });
  };

  const renderWeather = () => {
    if (weatherLoading) return <p className="weather-message">날씨 정보를 불러오는 중입니다...</p>;
    if (weatherError) return <p className="weather-message">날씨 정보를 가져오지 못했습니다.</p>;
    if (!weather) return <p className="weather-message">날씨 정보가 없습니다.</p>;

    const loc = weather.location || {};
    const regionName = weather.regionName || (weather.region && weather.region.name) || loc.city || loc.region || "";
    const land = weather.landFcst || {};
    const items = Array.isArray(land.items) ? land.items : [];
    const main = items[1] || items[0] || null;

    if (!main) return <p className="weather-message">예보 데이터가 없습니다.</p>;

    const tmFc = main.TM_FC || main.tmFc || main.tmFcDateTime || main.announceTime || null;
    const baseDate = parseKmaDate(main.TM_EF || main.TM_FC || main.tmEf || main.tmFc) || new Date();
    const todayKey = baseDate && `${baseDate.getFullYear()}${pad2(baseDate.getMonth() + 1)}${pad2(baseDate.getDate())}`;

    let temp = null;
    {
      const cand = [main.TA, main.ta, main.temp, main.tmn, main.tmx];
      const found = cand.find((v) => v !== undefined && v !== null && String(v).trim() !== "");
      if (found !== undefined) {
        const n = Number(found);
        temp = Number.isNaN(n) ? found : n;
      }
    }

    const summary = main.WF || main.wf || main.wfSv || main.wfTxt || "예보 요약 없음";
    const skyCode = main.SKY || main.sky || main.wfCd || "";
    const rainProb = main.rnSt ?? main.RN_ST ?? main.ST ?? null;
    const wind1 = main.wd1 || main.WD1 || "";
    const wind2 = main.wd2 || main.WD2 || "";
    const windText = wind1 && wind2 ? `${wind1} → ${wind2}` : wind1 || wind2 || "";
    const todayEmoji = getWeatherEmoji(skyCode, summary);

    const groupsMap = {};
    for (const it of items) {
      const key = getDateKeyFromItem(it);
      if (!key) continue;
      if (!groupsMap[key]) {
        groupsMap[key] = { key, date: parseKmaDate(key + "0000"), items: [] };
      }
      groupsMap[key].items.push(it);
    }

    const allGroups = Object.values(groupsMap).sort((a, b) => a.key.localeCompare(b.key));
    const dayMs = 24 * 60 * 60 * 1000;
    const baseDay = allGroups.find((g) => g.key === todayKey)?.date || baseDate;

    const futureGroups = [];
    for (const g of allGroups) {
      if (!g.date || !baseDay) continue;
      const diffDays = Math.round((g.date.getTime() - baseDay.getTime()) / dayMs);
      if (diffDays <= 0 || diffDays > 2) continue;
      futureGroups.push({ ...g, diffDays });
      if (futureGroups.length >= 2) break;
    }

    const getDayLabel = (diff) => (diff === 1 ? "내일" : diff === 2 ? "모레" : `${diff}일 후`);

    const forecastList = futureGroups.map((g, idx) => {
      let minT = null, maxT = null, maxRain = null;
      const temps = [], rains = [];
      let sumText = "", code = "";

      for (const it of g.items) {
        const t = [it.TA, it.ta, it.temp, it.tmn, it.tmx].find(v => v != null && String(v).trim() !== "");
        if (t !== undefined && Number(t) > -99) temps.push(Number(t));
        
        const r = [it.rnSt, it.RN_ST, it.ST].find(v => v != null && String(v).trim() !== "");
        if (r !== undefined && Number(r) >= 0) rains.push(Number(r));

        if (it.wf || it.WF) sumText = it.wf || it.WF;
        code = it.wfCd || it.WFCD || it.SKY || it.sky || code;
      }

      if (temps.length) { minT = Math.min(...temps); maxT = Math.max(...temps); }
      if (rains.length) maxRain = Math.max(...rains);

      const emoji = getWeatherEmoji(code, sumText || summary);
      const dateLabel = g.date ? formatShortKoreanDate(g.date) : "";
      
      let tempText = "--℃";
      if (minT !== null && maxT !== null) tempText = minT === maxT ? `${maxT}℃` : `${minT}~${maxT}℃`;

      return (
        <div className="forecast-item" key={idx}>
          <div className="forecast-left">
            <div className="forecast-emoji">{emoji}</div>
            <div className="forecast-label">{getDayLabel(g.diffDays)} {dateLabel}</div>
          </div>
          <div className="forecast-right">
            <div className="forecast-temp">{tempText}</div>
            <div className="forecast-sub">
              <span>{sumText || "예보 없음"}</span>
              {maxRain !== null && <span className="forecast-rain">· 강수 {maxRain}%</span>}
            </div>
          </div>
        </div>
      );
    });

    return (
      <div className="weather-card">
        <div className="weather-icon">{todayEmoji}</div>
        <div className="weather-temp">{temp !== null ? `${temp}℃` : "--℃"}</div>
        <div className="weather-summary">{summary}</div>
        <div className="weather-location-main">📍 {regionName || loc.city || loc.region || "위치 확인 중..."}</div>
        <div className="weather-info-list">
          {rainProb !== null && <div className="info-row"><span className="label">강수확률</span><span className="value">{rainProb}%</span></div>}
          {windText && <div className="info-row"><span className="label">바람</span><span className="value">{windText}</span></div>}
        </div>
        {forecastList.length > 0 && <div className="weather-forecast-list">{forecastList}</div>}
        {tmFc && <div className="weather-basetime">기준시각 {formatKmaTime(tmFc)}</div>}
      </div>
    );
  };

  return (
    <>
      <style>{`
          .main-cal-events {
              display: flex;
              flex-direction: column;
              gap: 2px;
              margin-top: 2px;
              overflow: hidden;
              width: 100%;
          }
          .main-event-text {
              font-size: 0.65rem;
              background-color: #ebf5ff;
              color: #1e40af;
              padding: 1px 3px;
              border-radius: 3px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              text-align: left;
          }
          .main-event-more {
              font-size: 0.6rem;
              color: #999;
              text-align: center;
              line-height: 1;
          }
          .calendar-grid .day-cell {
              min-height: 60px;
          }
      `}</style>

      {/* [수정] 5개 메뉴 Navbar */}
      <nav id="nav3">
        <Link to="/" className="logo">AI Closet</Link>
        <ul>
            <li><Link to="/" className="active">메인</Link></li>
            <li><Link to="/closet">옷장</Link></li>
            <li><Link to="/AI">AI 추천</Link></li>
            <li><Link to="/calendar">캘린더</Link></li>
            <li><Link to="/AI/result">추천 결과</Link></li>
        </ul>
        <button className="nav-upload-btn" onClick={() => navigate("/closet/upload")}>옷 등록하기</button>
      </nav>

      <main className="clothes-area">
        <h2>My Closet</h2>
        <button className="registration-btn" onClick={goToCloset}>옷장으로 이동</button>

        <div className="main-dashboard">
          <section className="random-clothes-section">
            <h3>오늘의 추천 코디 (랜덤)</h3>
            {randomClothes.length > 0 ? (
              <div className="dashboard-grid">
                {randomClothes.map((item) => (
                  <div key={item.id} className="mini-card" onClick={() => goToDetail(item)}>
                    <div className="mini-thumb">
                      <img src={item.imageUrl} alt={item.name} onError={(e) => { e.target.onerror = null; e.target.src = "/images/placeholder.png"; }} />
                    </div>
                    <div className="mini-info">
                      <span className="mini-brand">{item.brand}</span>
                      <span className="mini-name">{item.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="placeholder-content"><p>옷을 불러오는 중이거나<br />등록된 옷이 없습니다.</p></div>
            )}
          </section>

          <aside className="weather-section">
            <h3>오늘의 날씨</h3>
            <div className="placeholder-content-weather">{renderWeather()}</div>
          </aside>
        </div>
        
        <section className="calendar-section">
          <h3>📅 내 일정 관리</h3>
          <div className="calendar-container">
            <div className="calendar-header">
              <button onClick={() => changeMonth(-1)}>◀</button>
              <h4>{viewDate.getFullYear()}년 {viewDate.getMonth() + 1}월</h4>
              <button onClick={() => changeMonth(1)}>▶</button>
            </div>
            <div className="calendar-days-header">
              {["일","월","화","수","목","금","토"].map(d=><div key={d} className={`day-name ${d==='일'?'sun':d==='토'?'sat':''}`}>{d}</div>)}
            </div>
            <div className="calendar-grid">{renderCalendarGrid()}</div>
          </div>
          <div className="selected-range-info" style={{background:"transparent", color:"#666", marginTop:"10px", textAlign:"center"}}>
              👆 날짜를 클릭하여 상세 일정을 확인하고 추가하세요.
          </div>
        </section>

        <section className="ai-section">
          <button className="ai-recommend-btn" onClick={goToAI}>✨ AI 추천 받기</button>
          <div className="ai-recommend-display"><p>버튼을 누르면 이곳에<br />AI가 추천하는 옷이 표시됩니다.</p></div>
        </section>
      </main>
    </>
  );
}