import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./App.css";
import "./CalendarPage.css";
// [필수] apiConfig가 올바른 경로에 있는지 확인하세요.
import { API_BASE_URL } from "./apiConfig";

export default function CalendarPage() {
    const navigate = useNavigate();

    // ─────────────── [상태 관리] ───────────────
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // events 상태: API에서 불러온 데이터를 담음
    const [events, setEvents] = useState({});
    const [newEventInput, setNewEventInput] = useState("");

    // [디버깅] API 주소 확인
    useEffect(() => {
        console.log("🛠️ 현재 설정된 API URL:", API_BASE_URL);
    }, []);

    // [1] 컴포넌트 로드 시 'Backend API'에서 일정 불러오기
    useEffect(() => {
        console.log("📡 [GET] 일정 불러오기 시도...");
        fetch(`${API_BASE_URL}/api/calendar`)
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`서버 응답 에러: ${res.status}`);
                }
                return res.json();
            })
            .then((data) => {
                console.log("✅ [GET] 일정 불러오기 성공:", data);
                setEvents(data);
            })
            .catch((err) => {
                console.error("❌ [GET] 일정 불러오기 실패:", err);
            });
    }, []);

    // [2] 변경된 이벤트를 서버에 저장하는 헬퍼 함수
    const saveEventsToServer = async (updatedEvents) => {
        const url = `${API_BASE_URL}/api/calendar`;
        console.log(`📡 [POST] 일정 저장 시도: ${url}`);
        console.log("📦 보낼 데이터:", updatedEvents);

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedEvents),
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`저장 실패(${res.status}): ${errorText}`);
            }

            const result = await res.json();
            console.log("✅ [POST] 일정 저장 성공:", result);
        } catch (error) {
            console.error("❌ [POST] 통신 에러 발생:", error);
            alert(
                "서버와 통신할 수 없습니다. 백엔드가 켜져있는지 확인해주세요."
            );
        }
    };

    // ─────────────── [날짜 계산 로직] ───────────────
    const changeMonth = (offset) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + offset);
        setViewDate(newDate);
    };

    const getDateKey = (year, month, day) => {
        return `${year}-${String(month + 1).padStart(2, "0")}-${String(
            day
        ).padStart(2, "0")}`;
    };

    const handleDateClick = (day) => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const dateKey = getDateKey(year, month, day);

        setSelectedDate({ year, month, day, dateKey });
        setIsModalOpen(true);
        setNewEventInput("");
    };

    // ─────────────── [일정 추가/삭제 로직] ───────────────
    const handleAddEvent = () => {
        if (!newEventInput.trim()) return;
        if (!selectedDate) return;

        const { dateKey } = selectedDate;
        const newEvent = {
            id: Date.now(),
            title: newEventInput,
        };

        // 1. 상태 업데이트 (UI 즉시 반영)
        const currentDayEvents = events[dateKey] || [];
        const updatedEvents = {
            ...events,
            [dateKey]: [...currentDayEvents, newEvent],
        };

        setEvents(updatedEvents);
        setNewEventInput("");

        // 2. 서버 동기화
        saveEventsToServer(updatedEvents);
    };

    const handleDeleteEvent = (e, dateKey, id) => {
        e.stopPropagation();

        // 1. 상태 업데이트 (UI 즉시 반영)
        const updatedDayEvents = events[dateKey].filter((evt) => evt.id !== id);
        const updatedEvents = {
            ...events,
            [dateKey]: updatedDayEvents,
        };

        setEvents(updatedEvents);

        // 2. 서버 동기화
        saveEventsToServer(updatedEvents);
    };

    // ─────────────── [렌더링 로직] ───────────────
    const renderCalendarGrid = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const days = [];

        for (let i = 0; i < firstDay; i++) {
            days.push(
                <div key={`empty-${i}`} className="cal-cell empty"></div>
            );
        }

        for (let day = 1; day <= lastDate; day++) {
            const dateKey = getDateKey(year, month, day);
            const dayEvents = events[dateKey] || [];

            const currentDate = new Date(year, month, day);
            const isSun = currentDate.getDay() === 0;
            const isSat = currentDate.getDay() === 6;

            let cellClass = "cal-cell";
            if (isSun) cellClass += " sun";
            if (isSat) cellClass += " sat";

            const today = new Date();
            if (
                today.getFullYear() === year &&
                today.getMonth() === month &&
                today.getDate() === day
            ) {
                cellClass += " today";
            }

            days.push(
                <div
                    key={day}
                    className={cellClass}
                    onClick={() => handleDateClick(day)}
                >
                    <div className="cal-date-num">{day}</div>

                    {/* 점 대신 텍스트 리스트 출력 */}
                    <div className="cal-events-list">
                        {dayEvents.map((evt) => (
                            <div key={evt.id} className="event-item-text">
                                {evt.title}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return days;
    };

    return (
        <div className="calendar-page-wrapper">
            <nav id="nav3">
                <Link to="/" className="logo">
                    AI Closet
                </Link>
                <ul>
                    <li>
                        <Link to="/closet">옷장</Link>
                    </li>
                    <li>
                        <Link to="/AI">AI 추천</Link>
                    </li>
                    <li>
                        <Link to="/calendar" className="active">
                            캘린더
                        </Link>
                    </li>
                </ul>
                <button
                    className="nav-upload-btn"
                    onClick={() => navigate("/closet/upload")}
                >
                    옷 등록하기
                </button>
            </nav>

            <main className="calendar-main-container">
                <div className="cal-header">
                    <h2>📅 나의 일정 관리</h2>
                    <p>날짜를 클릭하여 일정을 추가하거나 삭제하세요.</p>
                </div>

                <div className="cal-body">
                    <div className="cal-nav">
                        <button onClick={() => changeMonth(-1)}>
                            ◀ 이전 달
                        </button>
                        <h3>
                            {viewDate.getFullYear()}년 {viewDate.getMonth() + 1}
                            월
                        </h3>
                        <button onClick={() => changeMonth(1)}>
                            다음 달 ▶
                        </button>
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

            {/* 일정 추가/관리 모달 */}
            {isModalOpen && selectedDate && (
                <div
                    className="modal-overlay"
                    onClick={() => setIsModalOpen(false)}
                >
                    <div
                        className="modal-content"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h3>
                                {selectedDate.month + 1}월 {selectedDate.day}일
                                일정
                            </h3>
                            <button
                                className="close-btn"
                                onClick={() => setIsModalOpen(false)}
                            >
                                ✕
                            </button>
                        </div>

                        <ul className="event-list">
                            {(events[selectedDate.dateKey] || []).length > 0 ? (
                                events[selectedDate.dateKey].map((evt) => (
                                    <li key={evt.id}>
                                        <span>▪ {evt.title}</span>
                                        <button
                                            style={{
                                                color: "#e74c3c",
                                                background: "none",
                                                border: "none",
                                                cursor: "pointer",
                                                fontWeight: "bold",
                                            }}
                                            onClick={(e) =>
                                                handleDeleteEvent(
                                                    e,
                                                    selectedDate.dateKey,
                                                    evt.id
                                                )
                                            }
                                        >
                                            삭제
                                        </button>
                                    </li>
                                ))
                            ) : (
                                <li
                                    style={{
                                        color: "#999",
                                        justifyContent: "center",
                                    }}
                                >
                                    일정이 없습니다.
                                </li>
                            )}
                        </ul>

                        <div className="add-event-box">
                            <input
                                type="text"
                                placeholder="일정 입력"
                                value={newEventInput}
                                onChange={(e) =>
                                    setNewEventInput(e.target.value)
                                }
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleAddEvent();
                                }}
                            />
                            <button onClick={handleAddEvent}>추가</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
