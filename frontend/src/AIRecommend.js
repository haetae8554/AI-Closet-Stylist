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
  
    // 1. 달력 일정 데이터 로드
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

    // [복구] 날짜 클릭 핸들러 (시작일 -> 종료일 -> 초기화 순서)
    const handleDateClick = (day) => {
        const clickedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);

        if (!startDate || (startDate && endDate)) {
            // 1. 아무것도 없거나, 이미 기간이 완성되어 있으면 -> 새로 시작
            setStartDate(clickedDate);
            setEndDate(null);
        } else if (startDate && !endDate) {
            // 2. 시작일만 있는 경우
            if (clickedDate < startDate) {
                // 시작일보다 이전 날짜를 찍으면 -> 시작일을 변경
                setStartDate(clickedDate);
            } else {
                // 시작일 이후 날짜를 찍으면 -> 종료일 설정 (기간 완성)
                setEndDate(clickedDate);
            }
        }
    };

    // [복구] 하단 기간 표시 텍스트 로직
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

    // 달력 렌더링
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

            // 기본 클래스
            let className = "day-cell";
            if (isSun) className += " sun";
            if (isSat) className += " sat";

            // [핵심] 기간 선택 시 클래스 추가 로직
            if (startDate && currentDate.getTime() === startDate.getTime()) {
                className += " range-start"; // 시작일 (파란색 배경)
            } else if (endDate && currentDate.getTime() === endDate.getTime()) {
                className += " range-end";   // 종료일 (파란색 배경)
            } else if (startDate && endDate && currentDate > startDate && currentDate < endDate) {
                className += " in-range";    // 기간 사이 (연한 파란색)
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

    // ... 옷 데이터 및 추천 로직 (기존 유지) ...
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
            alert("AI 추천 요청 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* [복구] CSS 스타일 복구: .range-start, .range-end, .in-range 추가됨 */}
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
                    border-radius: 6px; /* 모서리 둥글게 */
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

                /* [여기부터 복구된 스타일] */
                /* 시작일과 종료일: 진한 파란색 배경 + 흰색 글씨 */
                .calendar-grid .day-cell.range-start, 
                .calendar-grid .day-cell.range-end {
                    background-color: #3a82f5ff !important;
                    color: white !important;
                    
                }
                
                /* 시작일/종료일 내부의 텍스트 색상 강제 변경 */
                .calendar-grid .day-cell.range-start .day-number,
                .calendar-grid .day-cell.range-end .day-number {
                    background-color: transparent;
                    color: white;
                }
                
                /* 기간 사이 구간: 연한 파란색 배경 */
                .calendar-grid .day-cell.in-range {
                    background-color: #8eb9f0ff !important;
                }
            `}</style>

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
                    
                    {/* 기간 선택 안내 문구 */}
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
                                    ? "AI 분석 중..." 
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