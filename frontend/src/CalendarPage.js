import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./App.css"; // 스타일은 App.css를 공유해서 사용

export default function CalendarPage() {
    const navigate = useNavigate();

    // ──────────────── [캘린더 상태 및 로직] ────────────────
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
        if (!startDate) return "AI 추천을 받을 기간의 시작일을 선택해주세요.";
        const startStr = `${startDate.getMonth() + 1}/${startDate.getDate()}`;
        if (!endDate) return `${startStr} ~ (종료일 선택)`;
        const endStr = `${endDate.getMonth() + 1}/${endDate.getDate()}`;
        return `선택된 기간: ${startStr} ~ ${endStr}`;
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
    // ──────────────────────────────────────────────────

    return (
        <>
            {/* 공통 네비게이션 바 */}
            <nav id="nav3">
                <Link to="/" className="logo">AI Closet</Link>
                <ul>
                    <li><Link to="/closet">옷장</Link></li>
                    <li><Link to="/AI">AI 추천</Link></li>
                    <li><Link to="/calendar" className="active">캘린더</Link></li>
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

            {/* 캘린더 페이지 컨텐츠 */}
            <main className="page-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
                <h2>코디 캘린더</h2>
                <p style={{ marginBottom: '20px', color: '#666' }}>
                    원하는 날짜나 기간을 선택하여 AI 코디 추천을 받아보세요.
                </p>

                <section className="calendar-section">
                    <div className="calendar-container">
                        <div className="calendar-header">
                            <button onClick={() => changeMonth(-1)}>◀ 이전 달</button>
                            <h4>{viewDate.getFullYear()}년 {viewDate.getMonth() + 1}월</h4>
                            <button onClick={() => changeMonth(1)}>다음 달 ▶</button>
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

                    {/* 기간 선택 후 동작할 버튼 예시 */}
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <button
                            className="ai-recommend-btn"
                            disabled={!startDate || !endDate}
                            style={{ opacity: (!startDate || !endDate) ? 0.5 : 1, cursor: (!startDate || !endDate) ? 'not-allowed' : 'pointer' }}
                            onClick={() => alert(`선택된 기간 (${getPeriodText()})으로 AI 추천을 시작합니다!`)}
                        >
                            선택한 기간으로 코디 추천받기
                        </button>
                    </div>
                </section>
            </main>
        </>
    );
}