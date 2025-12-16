import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./App.css";
import "./CalendarPage.css"; // 기존 스타일 재사용
import { API_BASE_URL } from "./apiConfig";

export default function RecommendationResultPage() {
    const navigate = useNavigate();

    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null); // 클릭한 날짜 정보
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [recMap, setRecMap] = useState({}); // { "2025-12-01": [코디1, 코디2] }
    const [clothesMap, setClothesMap] = useState({}); // { "top-001": {이미지, 이름...} }

    // 1. 옷 목록 불러오기 (ID로 이미지 매칭하기 위함)
    useEffect(() => {
        fetch(`${API_BASE_URL}/api/clothes`)
            .then((res) => res.json())
            .then((data) => {
                // 검색 속도를 위해 ID를 Key로 하는 객체로 변환
                const map = {};
                data.forEach((cloth) => {
                    map[cloth.id] = cloth;
                });
                setClothesMap(map);
            })
            .catch((err) => console.error("옷 목록 로드 실패:", err));
    }, []);

    // 2. 월이 바뀔 때마다 해당 월의 추천 데이터 불러오기
    useEffect(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        
        // 해당 월의 1일 ~ 말일 구하기
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);

        const startStr = getDateKey(startDate);
        const endStr = getDateKey(endDate);

        console.log(`📡 [GET] 추천 기록 조회: ${startStr} ~ ${endStr}`);

        // server.js에서 수정한 mode=map 파라미터 사용
        fetch(`${API_BASE_URL}/api/recommend/result?startDate=${startStr}&endDate=${endStr}&mode=map`)
            .then((res) => res.json())
            .then((data) => {
                console.log("✅ 데이터 로드 완료:", data);
                setRecMap(data);
            })
            .catch((err) => console.error("추천 기록 로드 실패:", err));
    }, [viewDate]);

    // 날짜 포맷 (YYYY-MM-DD)
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
        } else {
            // 데이터가 없으면 아무 동작 안 함 (혹은 알림)
            // alert("해당 날짜에는 추천 받은 기록이 없습니다.");
        }
    };

    // 캘린더 그리기
    const renderCalendarGrid = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const days = [];

        // 빈 칸 채우기
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="cal-cell empty"></div>);
        }

        // 날짜 채우기
        for (let day = 1; day <= lastDate; day++) {
            const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const hasRec = recMap[dateKey] && recMap[dateKey].length > 0;

            const currentDate = new Date(year, month, day);
            const isSun = currentDate.getDay() === 0;
            const isSat = currentDate.getDay() === 6;

            let cellClass = "cal-cell result-cell"; // result-cell 클래스 추가 (hover 효과 등)
            if (isSun) cellClass += " sun";
            if (isSat) cellClass += " sat";

            // 오늘 날짜 표시
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
                    
                    {/* 추천 데이터가 있으면 점 표시 */}
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

    // 옷 카드 렌더링 헬퍼
    const renderClothItem = (role, clothId) => {
        if (!clothId) return null;
        const cloth = clothesMap[clothId];
        
        return (
            <div className="outfit-item">
                <div className="role-badge">{role}</div>
                {cloth ? (
                    <>
                        <img src={`${API_BASE_URL}${cloth.imageUrl}`} alt={cloth.name} />
                        <span className="cloth-name">{cloth.name}</span>
                    </>
                ) : (
                    <div className="no-info">정보 없음 ({clothId})</div>
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