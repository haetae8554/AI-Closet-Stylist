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
                // data가 배열인지 확인 후 처리
                if (Array.isArray(data)) {
                    data.forEach((cloth) => {
                        map[cloth.id] = cloth;
                    });
                }
                setClothesMap(map);
            })
            .catch((err) => console.error("옷 목록 로드 실패:", err));
    }, []);

    // 2. 월별 추천 데이터 불러오기
    useEffect(() => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        
        // 해당 월의 1일 ~ 마지막 날
        const startDate = new Date(year, month, 1);
        const endDate = new Date(year, month + 1, 0);

        const startStr = getDateKey(startDate);
        const endStr = getDateKey(endDate);

        console.log(`📡 [GET] 추천 기록 조회: ${startStr} ~ ${endStr}`);

        // mode=list 로 요청해서 프론트에서 Map으로 변환하는 것이 더 안전함 (백엔드 구현에 따라 다름)
        // 여기서는 백엔드가 무엇을 주든 처리할 수 있도록 로직 강화
        fetch(`${API_BASE_URL}/api/recommend/result?startDate=${startStr}&endDate=${endStr}`)
            .then((res) => res.json())
            .then((data) => {
                console.log("✅ 원본 데이터 로드:", data);
                
                // [중요] 백엔드가 배열([])을 주든 맵({})을 주든 
                // 프론트엔드에서 { "YYYY-MM-DD": [ ... ] } 형태로 확실하게 변환
                const newRecMap = {};

                if (Array.isArray(data)) {
                    // 배열로 들어온 경우 (예: [{date: "2023-12-23", ...}, ...])
                    data.forEach(item => {
                        // item.date가 있는지 확인
                        const dKey = item.date; 
                        if (dKey) {
                            if (!newRecMap[dKey]) newRecMap[dKey] = [];
                            newRecMap[dKey].push(item);
                        }
                    });
                } else if (typeof data === 'object') {
                    // 이미 맵 형태로 들어온 경우
                    Object.assign(newRecMap, data);
                }

                setRecMap(newRecMap);
            })
            .catch((err) => console.error("추천 기록 로드 실패:", err));
    }, [viewDate]);

    // 날짜를 YYYY-MM-DD 문자열로 변환
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
        // [중요] 클릭한 날짜 키 생성 시에도 padStart(2, "0") 필수
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
        
        // 이번 달 1일의 요일 (0:일, 1:월 ...)
        const firstDayObj = new Date(year, month, 1);
        const firstDay = firstDayObj.getDay();
        
        // 이번 달 마지막 날짜
        const lastDateObj = new Date(year, month + 1, 0);
        const lastDate = lastDateObj.getDate();
        
        const days = [];

        // 빈 칸 채우기
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="cal-cell empty"></div>);
        }

        // 날짜 채우기
        for (let day = 1; day <= lastDate; day++) {
            const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const hasRec = recMap[dateKey] && recMap[dateKey].length > 0;
            
            // 요일 계산을 위해 현재 날짜 객체 생성
            const currentDate = new Date(year, month, day);
            const isSun = currentDate.getDay() === 0;
            const isSat = currentDate.getDay() === 6;

            let cellClass = "cal-cell result-cell";
            if (isSun) cellClass += " sun";
            if (isSat) cellClass += " sat";

            // 오늘 날짜 하이라이트 (브라우저 로컬 시간 기준)
            const today = new Date();
            if (today.getFullYear() === year && 
                today.getMonth() === month && 
                today.getDate() === day) {
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
                            <span className="rec-text">{recMap[dateKey].length}건</span>
                        </div>
                    )}
                </div>
            );
        }
        return days;
    };

    // 옷 카드 렌더링 헬퍼
    const renderClothItem = (role, identifier) => {
        if (!identifier) return null;

        // 1. ID로 검색
        let cloth = clothesMap[identifier];

        // 2. 이름으로 검색 (ID 매칭 실패 시 fallback)
        if (!cloth) {
            cloth = Object.values(clothesMap).find((c) => c.name === identifier);
        }
        
        // 이미지 URL 안전하게 처리
        const getImageUrl = (url) => {
            if (!url) return "https://via.placeholder.com/150?text=No+Image";
            if (url.startsWith("http") || url.startsWith("https")) {
                return url; 
            }
            // 슬래시 중복 방지 및 누락 처리
            const cleanBase = API_BASE_URL.replace(/\/$/, ""); // 끝 슬래시 제거
            const cleanUrl = url.startsWith("/") ? url : `/${url}`; // 앞 슬래시 추가
            return `${cleanBase}${cleanUrl}`;
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
                        <div style={{fontSize: "1.5rem", marginBottom: "5px"}}>👕</div>
                        <span style={{fontSize: "0.8rem", color:"#666"}}>{identifier}</span>
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
                    <p>날짜를 클릭하여 저장된 코디를 확인하세요.</p>
                </div>

                <div className="cal-body">
                    <div className="cal-nav">
                        <button onClick={() => changeMonth(-1)}>◀</button>
                        <h3>{viewDate.getFullYear()}년 {viewDate.getMonth() + 1}월</h3>
                        <button onClick={() => changeMonth(1)}>▶</button>
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
                            <h3>📅 {selectedDate.displayDate}의 추천</h3>
                            <button className="close-btn" onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>

                        <div className="rec-list-container">
                            {selectedDate.data.map((rec, idx) => (
                                <div key={idx} className="rec-card">
                                    <div className="rec-card-header">
                                        <span className="rec-badge">추천 {idx + 1}</span>
                                    </div>
                                    
                                    <div className="outfit-grid">
                                        {renderClothItem("아우터", rec.outer)}
                                        {renderClothItem("상의", rec.top)}
                                        {renderClothItem("하의", rec.bottom)}
                                        {renderClothItem("신발", rec.shoes)}
                                    </div>

                                    <div className="rec-reason">
                                        <strong>💡 스타일링 팁:</strong><br/>
                                        {rec.reason}
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