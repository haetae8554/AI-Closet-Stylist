import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./App.css";
import { API_BASE_URL } from "./apiConfig";

// 좌표 변환 및 헬퍼 함수들
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

function getWeatherEmoji(skyCode, summaryText = "") {
  const code = String(skyCode || "");
  const text = String(summaryText || "");
  if (code.includes("DB") || code.includes("RA") || text.includes("비")) return "🌧️";
  if (code.includes("SN") || text.includes("눈")) return "❄️";
  if (code === "1" || text.includes("맑")) return "☀️";
  if (code === "2" || text.includes("구름")) return "⛅";
  return "🌤️";
}

function formatShortDate(date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = DAY_NAMES[date.getDay()];
  return `${m}/${d}(${w})`;
}

export default function App() {
  const navigate = useNavigate();

  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState("");
  const [randomClothes, setRandomClothes] = useState([]);
  
  const [viewDate, setViewDate] = useState(new Date()); 
  const [events, setEvents] = useState({});

  const [aiResult, setAiResult] = useState([]);
  const [allClothes, setAllClothes] = useState([]);

  // 캘린더 조회
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/calendar`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setEvents(data))
      .catch(e => console.error("일정 로드 실패", e));
  }, []);

  const getDateKey = (year, month, day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const changeMonth = (offset) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setViewDate(newDate);
  };

  const handleDateClick = () => navigate("/calendar");

  const renderCalendarGrid = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="day-cell1 empty"></div>);
    }

    for (let day = 1; day <= lastDate; day++) {
      const currentDate = new Date(year, month, day);
      const isSun = currentDate.getDay() === 0;
      const isSat = currentDate.getDay() === 6;
      const dateKey = getDateKey(year, month, day);
      const dayEvents = events[dateKey] || [];

      let className = "day-cell1";
      if (isSun) className += " sun";
      if (isSat) className += " sat";

      days.push(
        <div key={day} className={className} onClick={handleDateClick}>
          <span className="day-number">{day}</span>
          <div className="main-cal-events">
            {dayEvents.slice(0, 3).map((evt) => (
                <div key={evt.id} className="main-event-text">{evt.title}</div>
            ))}
            {dayEvents.length > 3 && <div className="main-event-more">+</div>}
          </div>
        </div>
      );
    }
    return days;
  };

  // 날씨 API 호출
  useEffect(() => {
    const fetchWeather = async (lat, lon) => {
      try {
        setWeatherLoading(true);
        setWeatherError("");

        let url = `${API_BASE_URL}/api/weather/current`;
        if (lat && lon) {
          url += `?lat=${lat}&lon=${lon}`;
        }
        
        console.log(`[Client] 날씨 데이터 요청: ${url}`);

        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`서버 응답 오류: ${res.status}`);
        }

        const data = await res.json();
        console.log("[Client] 날씨 응답:", data);
        setWeather(data);

      } catch (e) {
        console.error("[Client] 날씨 요청 실패:", e);
        setWeatherError("날씨를 불러올 수 없습니다.");
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          console.log("위치 권한 허용:", pos.coords);
          fetchWeather(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => console.warn("위치 정보 차단:", err)
      );
    }
  }, []);

  // 옷 목록 및 AI 결과
  useEffect(() => {
    async function fetchData() {
      try {
        const clothesRes = await fetch(`${API_BASE_URL}/api/clothes`);
        if (clothesRes.ok) {
            const data = await clothesRes.json();
            const normalized = (Array.isArray(data) ? data : []).map(normalizeItem);
            setAllClothes(normalized);

            const shuffled = [...normalized].sort(() => 0.5 - Math.random());
            setRandomClothes(shuffled.slice(0, 8));
        }

        const recRes = await fetch(`${API_BASE_URL}/api/recommend/result`);
        if (recRes.ok) {
            const recData = await recRes.json();
            if (Array.isArray(recData) && recData.length > 0) {
                // 날짜 가까운 순 정렬
                const sorted = recData.sort((a, b) => {
                   if (!a.date) return 1;
                   if (!b.date) return -1;
                   const today = new Date().getTime();
                   const dateA = new Date(a.date).getTime();
                   const dateB = new Date(b.date).getTime();
                   return Math.abs(dateA - today) - Math.abs(dateB - today);
                });
                setAiResult(sorted);
            }
        }
      } catch (e) {
        console.error("데이터 로드 실패", e);
      }
    }
    fetchData();
  }, []);

  const findClothById = (id) => {
    if (!id) return null;
    return allClothes.find(item => item.id === String(id));
  };

  const goToCloset = () => navigate("/closet");
  const goToAI = () => navigate("/AI");
  const goToDetail = (item) => navigate(`/closet/detail?id=${encodeURIComponent(item.id)}`, { state: { item, from: "home" } });

  const renderWeather = () => {
    if (weatherLoading) return <p className="weather-message">날씨 정보 로딩 중...</p>;
    if (weatherError) return <p className="weather-message">{weatherError}</p>;
    if (!weather) return <p className="weather-message">날씨 정보 없음</p>;

    const loc = weather.location || {};
    const regionName = weather.regionName || loc.city || "내 위치";
    
    let temp = weather.temp || weather.T1H; 
    let summary = weather.wf || weather.summary || weather.skyStr;
    let skyCode = weather.sky || weather.SKY;
    let pop = weather.prob || weather.pop || (weather.landFcst?.items?.[0]?.POP) || "0";

    // 강수확률 이모지 조건 처리 (30% 이상일 때만 우산)
    const popVal = parseInt(pop, 10);
    const popEmoji = popVal >= 30 ? "☔" : "💧";

    if (!temp && weather.landFcst?.items?.[0]) {
      const main = weather.landFcst.items[0];
      temp = main.TA;
      summary = main.WF;
      skyCode = main.SKY;
    }

    const items = weather.landFcst?.items || [];
    const today = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(today); dayAfter.setDate(today.getDate() + 2);
    const getYMD = (d) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;

    const targetDays = [tomorrow, dayAfter];
    const forecastList = targetDays.map(date => {
      const dateStr = getYMD(date);
      const found = items.find(it => it.TM_EF?.startsWith(dateStr) && it.TM_EF?.endsWith("1200")) 
                 || items.find(it => it.TM_EF?.startsWith(dateStr));
      return { date, data: found };
    }).filter(item => item.data);

    return (
        <div className="weather-card">
            <div className="weather-icon">{getWeatherEmoji(skyCode, summary)}</div>
            <div className="weather-temp">{Number(temp) > -99 ? `${temp}℃` : "--℃"}</div>
            
            <div className="weather-detail-row">
                {summary && <span className="weather-detail-badge">{summary}</span>}
                <span className="weather-detail-badge">{popEmoji} 강수확률 {pop}%</span>
            </div>

            <div className="weather-location-main">📍 {regionName}</div>
            
            {forecastList.length > 0 && (
              <div className="weather-forecast-list">
                {forecastList.map((fv, idx) => (
                  <div key={idx} className="forecast-item">
                    <div className="forecast-left">
                      <span className="forecast-label">{formatShortDate(fv.date)}</span>
                      {/* 내일/모레 상세 날씨 텍스트 추가 */}
                      <span className="forecast-desc">{fv.data.WF}</span>
                    </div>
                    <div className="forecast-right">
                      <span className="forecast-emoji">{getWeatherEmoji(fv.data.SKY, fv.data.WF)}</span>
                      <span className="forecast-temp">{fv.data.TA}℃</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
    );
  };

  const renderAiResult = () => {
    if (aiResult.length === 0) {
      return (
        <div className="empty-state">
          <p>버튼을 누르면 AI 추천 페이지로 이동합니다.<br />추천 결과가 있으면 이곳에 표시됩니다.</p>
        </div>
      );
    }

    const heroItem = aiResult[0];
    const subItems = aiResult.slice(1);

    const getVisuals = (combo) => {
        const parts = ["outer", "top", "bottom", "shoes"];
        return parts.map(key => findClothById(combo[key]))
                    .filter(item => item !== null && item !== undefined);
    };

    const heroVisuals = getVisuals(heroItem);

    return (
        <>
            <div className="hero-outfit-container">
                <div className="hero-outfit-card">
                    {/* 사진 영역: 가로 꽉 채움 */}
                    <div className="hero-visuals">
                        {heroVisuals.length > 0 ? heroVisuals.map((item, i) => (
                            <div key={i} className="visual-item">
                                <div className="img-frame">
                                    <img src={item.imageUrl || "/images/placeholder.png"} alt={item.name} />
                                </div>
                                <span className="item-label">{item.name}</span>
                            </div>
                        )) : <p>이미지 정보 없음</p>}
                    </div>
                    {/* 설명 영역: 사진 아래로 배치 */}
                    <div className="hero-info">
                        <span className="hero-badge">BEST LOOK</span>
                        <div className="hero-description-box">
                            <div className="hero-comment">
                                {heroItem.reason}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {subItems.length > 0 && (
                <div className="sub-outfit-grid">
                    {subItems.map((combo, idx) => {
                        const visuals = getVisuals(combo);
                        return (
                            <div key={idx} className="outfit-card">
                                <div className="outfit-header">
                                    <span className="outfit-badge">LOOK {idx + 2}</span>
                                </div>
                                <div className="outfit-visuals">
                                    {visuals.map((item, i) => (
                                        <div key={i} className="visual-item">
                                            <div className="img-frame">
                                                <img src={item.imageUrl} alt={item.name} />
                                            </div>
                                            <span className="item-label">{item.name}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="outfit-comment-box">
                                    <p className="comment-text">{combo.reason}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
  };

  return (
    <>
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

        <div className="main-dashboard">
          <section className="random-clothes-section">
            <h3>내 옷장 아이템</h3>
            {randomClothes.length > 0 ? (
              <div className="dashboard-grid">
                {randomClothes.map((item) => (
                  <div key={item.id} className="mini-card" onClick={() => goToDetail(item)}>
                    <div className="mini-thumb">
                      <img src={item.imageUrl} alt={item.name} />
                    </div>
                    <div className="mini-info">
                      <span className="mini-brand">{item.brand}</span>
                      <span className="mini-name">{item.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="placeholder-content"><p>옷을 불러오는 중...</p></div>
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
        </section>

        <section className="ai-section">
          <button className="ai-recommend-btn" onClick={goToAI}>✨ AI 추천 받기</button>
          
          <div className={`ai-recommend-display ${aiResult.length > 0 ? 'active' : ''}`}>
            {renderAiResult()}
          </div>
        </section>
      </main>
    </>
  );
}