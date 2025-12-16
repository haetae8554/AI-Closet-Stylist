import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./App.css";
import "./CalendarPage.css"; 
import { API_BASE_URL } from "./apiConfig";

export default function RecommendationResultPage() {
    const navigate = useNavigate();

    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null); 
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [recMap, setRecMap] = useState({}); 
    const [clothesMap, setClothesMap] = useState({}); 

    // 1. 옷 목록 불러오기
    useEffect(() => {
        fetch(`${API_BASE_URL}/api/clothes`)
            .then((res) => res.json())
            .then((data) => {
                const map = {};
                data.forEach((cloth) => {
                    map[cloth.id] = cloth;
                });
                setClothesMap(map);
            })
            .catch((err) => console.error("옷 목록 로드 실패:", err));
    }, []);

    // 2. 월별 추천 데이터 불러오기
    useEffect(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);

        const startStr = getDateKey(startDate);
        const endStr = getDateKey(endDate);

        console.log(`📡 [GET] 추천 기록 조회: ${startStr} ~ ${endStr}`);

        fetch(`${API_BASE_URL}/api/recommend/result?startDate=${startStr}&endDate=${endStr}&mode=map`)
            .then((res) => res.json())
            .then((data) => {
                console.log("✅ 데이터 로드 완료:", data);
                setRecMap(data);
            })
            .catch((err) => console.error("추천 기록 로드 실패:", err));
    }, [viewDate]);

    const getDateKey = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const changeMonth = (offset) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setViewDate(newDate);
    };

    const handleDateClick = (day) => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

        const dataForDay = recMap[dateKey];

        if (dataForDay && dataForDay.length > 0) {
            setSelectedDate({ dateKey, displayDate: `${month + 1}월 ${day}일`, data: dataForDay });
            setIsModalOpen(true);
        }
    };

    const renderCalendarGrid = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const days = [];

        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="cal-cell empty"></div>);
        }

        for (let day = 1; day <= lastDate; day++) {
            const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const hasRec = recMap[dateKey] && recMap[dateKey].length > 0;
            const currentDate = new Date(year, month, day);
            const isSun = currentDate.getDay() === 0;
            const isSat = currentDate.getDay() === 6;

            let cellClass = "cal-cell result-cell";
            if (isSun) cellClass += " sun";
            if (isSat) cellClass += " sat";

            const today = new Date();
            if (today.toDateString() === currentDate.toDateString()) {
                cellClass += " today";
            }

            days.push(
                <div
                    key={day}
                    className={cellClass}
                    onClick={() => handleDateClick(day)}
                    style={{ cursor: hasRec ? "pointer" : "default" }}
                >
                    <div className="cal-date-num">{day}</div>
                    {hasRec && (
                        <div className="rec-indicator">
                            <span className="rec-dot"></span>
                            <span className="rec-text">추천 {recMap[dateKey].length}건</span>
                        </div>
                    )}
                </div>
            );
        }
        return days;
    };

    // [수정됨] 옷 카드 렌더링 헬퍼
    const renderClothItem = (role, identifier) => {
        if (!identifier) return null;

        // 1. ID로 먼저 검색 (clothes.json의 id와 일치하는지)
        let cloth = clothesMap[identifier];

        // 2. ID로 없으면 이름으로 검색 (AI가 추천 결과로 '이름'을 줬을 경우 대비)
        if (!cloth) {
            cloth = Object.values(clothesMap).find((c) => c.name === identifier);
        }
        
        // [핵심 수정] 이미지 URL 처리 함수
        // 외부 링크(https://...)는 그대로 쓰고, 내부 파일(/images/...)만 API 주소를 붙임
        const getImageUrl = (url) => {
            if (!url) return "https://via.placeholder.com/150?text=No+Image";
            if (url.startsWith("http") || url.startsWith("https")) {
                return url; 
            }
            return `${API_BASE_URL}${url}`;
        };

        return (
            <div className="outfit-item">
                <div className="role-badge">{role}</div>
                {cloth ? (
                    <>
                        <img 
                            src={getImageUrl(cloth.imageUrl)} 
                            alt={cloth.name} 
                            onError={(e) => {
                                e.target.onerror = null; 
                                e.target.src = "https://via.placeholder.com/150?text=Error";
                            }}
                        />
                        <span className="cloth-name">{cloth.name}</span>
                    </>
                ) : (
                    <div className="no-info">
                        <div style={{fontSize: "2rem", marginBottom: "5px"}}>👕</div>
                        <span>{identifier}</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="calendar-page-wrapper">
             <nav id="nav3">
                <Link to="/" className="logo">AI Closet</Link>
                <ul>
                    <li><Link to="/">메인</Link></li>
                    <li><Link to="/closet">옷장</Link></li>
                    <li><Link to="/AI">AI 추천</Link></li>
                    <li><Link to="/calendar">캘린더</Link></li>
                    <li><Link to="/AI/result" className="active">추천 결과</Link></li>
                </ul>
                <button className="nav-upload-btn" onClick={() => navigate("/closet/upload")}>
                    옷 등록하기
                </button>
            </nav>

            <main className="calendar-main-container">
                <div className="cal-header">
                    <h2>✨ AI 코디 추천 기록</h2>
                    <p>과거에 추천받았던 코디 내역을 확인해보세요.</p>
                </div>

                <div className="cal-body">
                    <div className="cal-nav">
                        <button onClick={() => changeMonth(-1)}>◀ 이전 달</button>
                        <h3>{viewDate.getFullYear()}년 {viewDate.getMonth() + 1}월</h3>
                        <button onClick={() => changeMonth(1)}>다음 달 ▶</button>
                    </div>

                    <div className="cal-grid-header">
                        <div className="sun">일</div>
                        <div>월</div>
                        <div>화</div>
                        <div>수</div>
                        <div>목</div>
                        <div>금</div>
                        <div className="sat">토</div>
                    </div>

                    <div className="cal-grid">{renderCalendarGrid()}</div>
                </div>
            </main>

            {/* 상세 모달 */}
            {isModalOpen && selectedDate && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>📅 {selectedDate.displayDate} 추천 코디</h3>
                            <button className="close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>

                        <div className="rec-list-container">
                            {selectedDate.data.map((rec, idx) => (
                                <div key={idx} className="rec-card">
                                    <div className="rec-card-header">
                                        <span className="rec-badge">Option {idx + 1}</span>
                                    </div>
                                    
                                    <div className="outfit-grid">
                                        {renderClothItem("아우터", rec.outer)}
                                        {renderClothItem("상의", rec.top)}
                                        {renderClothItem("하의", rec.bottom)}
                                        {renderClothItem("신발", rec.shoes)}
                                    </div>

                                    <div className="rec-reason">
                                        <strong>💡 AI 의견:</strong> {rec.reason}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}