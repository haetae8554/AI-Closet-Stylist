import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./App.css"; 
import "./AIRecommend.css"; 
// [수정] 설정 파일에서 API 주소 가져오기
import { API_BASE_URL } from "./apiConfig";

export default function AIRecommend() {
    const navigate = useNavigate();

    const [viewDate, setViewDate] = useState(new Date());
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);

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
        if (!startDate) return "여행(외출) 시작일을 선택해주세요.";
        const startStr = `${startDate.getMonth() + 1}/${startDate.getDate()}`;
        if (!endDate) return `${startStr} ~ (종료일 선택)`;
        const endStr = `${endDate.getMonth() + 1}/${endDate.getDate()}`;
        return `기간: ${startStr} ~ ${endStr}`;
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
                    <span className="day-number">{day}</span>
                </div>
            );
        }
        return days;
    };

    const [allClothes, setAllClothes] = useState([]);
    const [selectedItems, setSelectedItems] = useState({
        아우터: null,
        상의: null,
        하의: null,
        신발: null,
    });
    const [category, setCategory] = useState("아우터");
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState({ lat: null, lon: null });

    useEffect(() => {
        // [수정] 상수(API_BASE_URL) 사용
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
                (error) => {
                    console.error("위치 정보 에러:", error);
                }
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
            alert("먼저 상단 캘린더에서 여행(외출) 기간을 선택해주세요!");
            return;
        }

        try {
            setLoading(true);

            // [수정] 상수(API_BASE_URL) 사용 및 백틱(`) 적용
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

            navigate("/AI/result", {
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
            <nav id="nav3">
                <Link to="/" className="logo">AI Closet</Link>
                <ul>
                    <li><Link to="/closet">옷장</Link></li>
                    <li><Link to="/AI" className="active">AI 추천</Link></li>
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

            <main className="ai-container">
                <div className="page-header">
                    <h2>AI 코디 추천</h2>
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
                    <div className="selected-range-info">
                        {getPeriodText()}
                    </div>
                </section>

                <section className="clothes-selection-area">
                    <h3>옷 선택 (옵션)</h3>
                    {location.lat && (
                        <p style={{fontSize: "0.9rem", color: "#059669", marginBottom: "15px", fontWeight: "500"}}>
                            현재 위치 날씨 기반 추천 활성화됨
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
                                                    X
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
                                        : "AI 추천받기"
                                }
                            </button>
                        </div>
                    </div>
                </section>
            </main>
        </>
    );
}