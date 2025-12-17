import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./App.css"; 
import "./AIRecommend.css"; 
import { API_BASE_URL } from "./apiConfig";

export default function AIRecommend() {
    const navigate = useNavigate();

    const [viewDate, setViewDate] = useState(new Date());
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [events, setEvents] = useState({});
  
    // [기존] 로딩(스피너) 팝업 상태
    const [showLoadingPopup, setShowLoadingPopup] = useState(false);
    
    // [추가] 페이지 진입 시 안내 팝업 상태
    const [showGuidePopup, setShowGuidePopup] = useState(false);

    // 1. 페이지 진입 시 안내 팝업 띄우기
    useEffect(() => {
        // 페이지에 들어오면 무조건 안내 팝업을 띄웁니다.
        // (만약 세션당 1번만 띄우고 싶다면 sessionStorage 로직 추가 가능)
        setShowGuidePopup(true);
    }, []);

    const closeGuidePopup = () => {
        setShowGuidePopup(false);
    };

    // 2. 달력 일정 데이터 로드
    useEffect(() => {
        fetch(`${API_BASE_URL}/api/calendar`)
            .then((res) => {
                if (!res.ok) throw new Error("네트워크 응답 실패");
                return res.json();
            })
            .then((data) => {
                setEvents(data);
            })
            .catch((err) => {
                console.error("일정 불러오기 실패:", err);
            });
    }, []);

    const getDateKey = (year, month, day) => {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const changeMonth = (offset) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setViewDate(newDate);
    };

    const handleDateClick = (day) => {
        const clickedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);

        if (!startDate || (startDate && endDate)) {
            setStartDate(clickedDate);
            setEndDate(null);
        } else if (startDate && !endDate) {
            if (clickedDate < startDate) {
                setStartDate(clickedDate);
            } else {
                setEndDate(clickedDate);
            }
        }
    };

    const getPeriodText = () => {
        if (!startDate) {
            return "👆 달력에서 AI 추천을 받을 시작일을 선택해주세요.";
        }
        const startStr = `${startDate.getMonth() + 1}월 ${startDate.getDate()}일`;
        if (!endDate) {
            return `시작: ${startStr} ~ (종료일을 선택해주세요)`;
        }
        const endStr = `${endDate.getMonth() + 1}월 ${endDate.getDate()}일`;
        return `✅ 선택된 기간: ${startStr} ~ ${endStr}`;
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

            if (startDate && currentDate.getTime() === startDate.getTime()) {
                className += " range-start";
            } else if (endDate && currentDate.getTime() === endDate.getTime()) {
                className += " range-end";
            } else if (startDate && endDate && currentDate > startDate && currentDate < endDate) {
                className += " in-range";
            }

            days.push(
                <div key={day} className={className} onClick={() => handleDateClick(day)}>
                    <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-start"}}>
                        <span className="day-number">{day}</span>
                    </div>
                    
                    <div className="ai-cal-events">
                        {dayEvents.slice(0, 3).map((evt) => (
                            <div key={evt.id} className="ai-event-text">
                                {evt.title}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return days;
    };

    const [allClothes, setAllClothes] = useState([]);
    const [selectedItems, setSelectedItems] = useState({
        아우터: null, 상의: null, 하의: null, 신발: null,
    });
    const [category, setCategory] = useState("아우터");
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState({ lat: null, lon: null });

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/clothes`, { cache: "no-store" })
            .then((res) => res.json())
            .then((data) => {
                const normalized = (Array.isArray(data) ? data : []).map(
                    (item) => {
                        let imageUrl = item?.imageUrl;
                        if (!imageUrl || imageUrl.trim?.() === "" || imageUrl === "null") {
                            imageUrl = "/images/placeholder.png";
                        }
                        return { ...item, imageUrl };
                    }
                );
                setAllClothes(normalized);
            })
            .catch((err) => {
                console.error("옷 데이터 불러오기 실패:", err);
                setAllClothes([]);
            });
            
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setLocation({ lat: latitude, lon: longitude });
                },
                (error) => console.error("위치 정보 에러:", error)
            );
        }
    }, []);

    const filteredClothes = allClothes.filter((item) => item.type === category);

    const handleSelect = (cloth) => {
        setSelectedItems((prev) => ({ ...prev, [category]: cloth }));
    };

    const handleRemove = (type) => {
        setSelectedItems((prev) => ({ ...prev, [type]: null }));
    };

    const handleRecommend = async () => {
        if (!startDate || !endDate) {
            alert("먼저 상단 캘린더에서 AI 추천을 받을 기간을 선택해주세요!");
            return;
        }

        try {
            setLoading(true);
            setShowLoadingPopup(true); // 실제 로딩 시작 시 스피너 팝업 띄움

            let url = `${API_BASE_URL}/api/recommend`;
            if (location.lat && location.lon) {
                url += `?lat=${location.lat}&lon=${location.lon}`;
            }

            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clothes: allClothes,
                    selected: selectedItems,
                    period: {
                        start: startDate.toISOString(),
                        end: endDate.toISOString()
                    }
                }),
            });

            const data = await res.json();
            
            navigate("/AI/daily", {
                state: {
                    allClothes,
                    selectedItems,
                    recommendations: data.recommendations || [],
                    period: {
                        start: startDate.toISOString(),
                        end: endDate.toISOString()
                    }
                },
            });
        } catch (err) {
            console.error("AI 추천 요청 실패:", err);
            setTimeout(() => {
                alert("AI 추천 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
            }, 300);
        } finally {
            setLoading(false);
            setShowLoadingPopup(false);
        }
    };

    return (
        <>
            <style>{`
                .ai-cal-events {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    margin-top: 4px;
                    overflow: hidden;
                    width: 100%;
                }
                .ai-event-text {
                    font-size: 0.75rem;
                    line-height: 1.4;
                    background-color: #ebf5ff;
                    color: #1e40af;
                    padding: 3px 6px;
                    border-radius: 4px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    text-align: left;
                    font-weight: 500;
                }
                .calendar-grid .day-cell {
                    min-height: 100px;
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-start;
                    align-items: stretch;
                    padding: 6px;
                    cursor: pointer;
                    border-radius: 6px;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                }
                .calendar-grid .day-cell:hover {
                    background-color: #f0f9ff;
                }
                .calendar-grid .day-cell .day-number {
                    align-self: flex-start;
                    font-weight: bold;
                    margin-bottom: 2px;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                }
                .calendar-grid .day-cell.range-start, 
                .calendar-grid .day-cell.range-end {
                    background-color: #3a82f5ff !important;
                    color: white !important;
                }
                .calendar-grid .day-cell.range-start .day-number,
                .calendar-grid .day-cell.range-end .day-number {
                    background-color: transparent;
                    color: white;
                }
                .calendar-grid .day-cell.in-range {
                    background-color: #8eb9f0ff !important;
                }
            `}</style>
            
            {/* [추가] 1. 페이지 진입 시 안내 팝업 */}
            {showGuidePopup && (
                <div className="loading-popup-overlay">
                    <div className="loading-popup-content">
                        <h3>AI 추천 서비스 이용 안내</h3>
                        <div className="loading-guide-box">
                            <p><strong>소요 시간 안내</strong><br/>
                            서버 상태에 따라 추천 결과를 받아오는 데<br/>
                            <strong>약 30초 ~ 1분</strong> 정도 소요될 수 있습니다.</p>
                            
                            <p><strong>일시적 오류 발생 시</strong><br/>
                            사용량이 많아 결과가 뜨지 않을 경우,<br/>
                            잠시 기다리셨다가 다시 시도해 주세요.</p>
                            
                            <p><strong>옷 선택 관련 안내</strong><br/>
                            선택하신 옷이 날씨, 일정, 코디 조화에 맞지 않으면<br/>
                            AI가 <strong>더 적절한 아이템으로 변경</strong>하여 추천할 수 있습니다.</p>
                        </div>
                        <button className="popup-confirm-btn" onClick={closeGuidePopup}>
                            확인했습니다
                        </button>
                    </div>
                </div>
            )}

            {/* [추가] 2. 실제 로딩 중(스피너) 팝업 */}
            {showLoadingPopup && (
                <div className="loading-popup-overlay">
                    <div className="loading-popup-content">
                        <div className="loading-spinner"></div>
                        <h3>AI가 최적의 코디를 분석 중입니다...</h3>
                        <p style={{marginTop:"10px", color:"#666"}}>잠시만 기다려 주세요! ✨</p>
                    </div>
                </div>
            )}

            <nav id="nav3">
                <Link to="/" className="logo">AI Closet</Link>
                <ul>
                    <li><Link to="/">메인</Link></li>
                    <li><Link to="/closet">옷장</Link></li>
                    <li><Link to="/AI" className="active">AI 추천</Link></li>
                    <li><Link to="/calendar">캘린더</Link></li>
                    <li><Link to="/AI/result">추천 결과</Link></li>
                </ul>
                <button className="nav-upload-btn" onClick={() => navigate("/closet/upload")}>
                    옷 등록하기
                </button>
            </nav>

            <main className="ai-container">
                <div className="page-header">
                    <h2>✨ AI 코디 추천</h2>
                    <p>
                        1. 캘린더에서 코디를 추천받을 날짜(기간)를 선택해주세요.<br/>
                        2. 꼭 입고 싶은 옷이 있다면 아래 목록에서 미리 선택할 수 있습니다.
                    </p>
                </div>

                <section className="calendar-section" style={{ marginBottom: "40px" }}>
                    <h3>일정 선택</h3>
                    <div className="calendar-container">
                        <div className="calendar-header">
                            <button onClick={() => changeMonth(-1)}>◀</button>
                            <h4>{viewDate.getFullYear()}년 {viewDate.getMonth() + 1}월</h4>
                            <button onClick={() => changeMonth(1)}>▶</button>
                        </div>
                        <div className="calendar-days-header">
                            <div className="day-name sun">일</div>
                            <div className="day-name">월</div>
                            <div className="day-name">화</div>
                            <div className="day-name">수</div>
                            <div className="day-name">목</div>
                            <div className="day-name">금</div>
                            <div className="day-name sat">토</div>
                        </div>
                        <div className="calendar-grid">
                            {renderCalendarGrid()}
                        </div>
                    </div>
                    
                    <div className="selected-range-info" style={{
                        marginTop: "15px",
                        padding: "12px",
                        backgroundColor: "#f0f9ff",
                        borderRadius: "8px",
                        textAlign: "center",
                        fontWeight: "600",
                        color: "#0369a1",
                        fontSize: "1.05rem"
                    }}>
                        {getPeriodText()}
                    </div>
                </section>

                <section className="clothes-selection-area">
                    <h3>👕 옷 선택 (옵션)</h3>
                    {location.lat && (
                        <p style={{fontSize: "0.9rem", color: "#059669", marginBottom: "15px", fontWeight: "500"}}>
                            📍 현재 위치 날씨 기반 추천 활성화됨
                        </p>
                    )}

                    <div className="category-bar">
                        {["아우터", "상의", "하의", "신발"].map((cat) => (
                            <button
                                key={cat}
                                className={`cat-btn ${category === cat ? "active" : ""}`}
                                onClick={() => setCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="ai-layout">
                        <div className="clothes-list">
                            {filteredClothes.length > 0 ? (
                                filteredClothes.map((cloth) => (
                                    <div
                                        key={cloth.id}
                                        className={`cloth-card ${
                                            selectedItems[category]?.id === cloth.id ? "selected" : ""
                                        }`}
                                        onClick={() => handleSelect(cloth)}
                                    >
                                        <img
                                            src={cloth.imageUrl}
                                            alt={cloth.name}
                                            onError={(e) => { e.target.src = "/images/placeholder.png"; }}
                                        />
                                        <p>{cloth.name}</p>
                                        <p style={{ fontSize: "0.8rem", color: "#888", marginTop: "4px" }}>
                                            {cloth.brand}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <div style={{gridColumn: "1 / -1", padding: "40px", textAlign: "center", background:"#f9f9f9", borderRadius:"8px"}}>
                                    <p style={{color: "#999"}}>등록된 {category}가 없습니다.</p>
                                </div>
                            )}
                        </div>

                        <div className="selected-panel">
                            <h3>선택된 옷</h3>
                            <div style={{display:"flex", flexDirection:"column", gap:"10px"}}>
                                {["아우터", "상의", "하의", "신발"].map((type) => (
                                    <div key={type} className="selected-item">
                                        {selectedItems[type] ? (
                                            <>
                                                <img
                                                    src={selectedItems[type].imageUrl}
                                                    alt={selectedItems[type].name}
                                                    onError={(e) => { e.target.src = "/images/placeholder.png"; }}
                                                />
                                                <div style={{flex:1}}>
                                                    <div style={{fontSize:"12px", color:"#888"}}>{type}</div>
                                                    <div style={{fontSize:"14px", fontWeight:"500"}}>{selectedItems[type].name}</div>
                                                </div>
                                                <button
                                                    className="remove-btn"
                                                    onClick={() => handleRemove(type)}
                                                >
                                                    ✕
                                                </button>
                                            </>
                                        ) : (
                                            <span style={{color:"#aaa", fontSize:"14px", padding:"10px 0"}}>{type} 선택 안 함</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                            
                            <button
                                className="recommend-btn"
                                onClick={handleRecommend}
                                disabled={loading}
                                style={{
                                    marginTop: "20px",
                                    opacity: (!startDate || !endDate) ? 0.6 : 1,
                                    cursor: (!startDate || !endDate) ? "not-allowed" : "pointer"
                                }}
                            >
                                {loading 
                                    ? "분석 중..." 
                                    : (!startDate || !endDate) 
                                        ? "기간을 설정해주세요"
                                        : "✨ AI 추천받기"
                                }
                            </button>
                        </div>
                    </div>
                </section>
            </main>
        </>
    );
}