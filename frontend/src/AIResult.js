import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import "./AIResult.css";
import { API_BASE_URL } from "./apiConfig";

export default function AIResult() {
    const location = useLocation();
    const navigate = useNavigate();
    
    // 이전 페이지(AIRecommend)에서 넘어온 정보들
    // period: { start: "...", end: "..." } 형태
    const { allClothes = [], targetDate, period } = location.state || {};
    
    // 서버에서 받아온 추천 데이터를 저장할 상태
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);

    const findClothById = (id) => allClothes.find((c) => c.id === id);

    // 컴포넌트 마운트 시 서버에 저장된 추천 결과 요청
    useEffect(() => {
        const fetchRecommendations = async () => {
            try {
                let query = "";

                // 1. 기간(period)이 있는 경우 (범위 조회)
                if (period && period.start && period.end) {
                    const s = new Date(period.start).toISOString().split('T')[0];
                    const e = new Date(period.end).toISOString().split('T')[0];
                    query = `?startDate=${s}&endDate=${e}`;
                } 
                // 2. 특정 날짜(targetDate)만 있는 경우 (단일 조회)
                else if (targetDate) {
                    query = `?date=${targetDate}`;
                }
                // 3. 아무것도 없으면 기본적으로 오늘 날짜 기준 조회(백엔드 처리)
                
                const response = await fetch(`${API_BASE_URL}/api/recommend/result${query}`);
                
                if (response.ok) {
                    const data = await response.json();
                    // 데이터가 배열인지 확인 후 설정
                    if (Array.isArray(data)) {
                        setRecommendations(data);
                    } else {
                        // 만약 객체로 온다면 배열로 변환하거나 빈 배열 처리
                        setRecommendations([]);
                    }
                } else {
                    console.error("데이터 가져오기 실패 status:", response.status);
                }
            } catch (error) {
                console.error("통신 에러:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRecommendations();
    }, [targetDate, period]); // period가 변경될 때도 재실행

    if (loading) {
        return <div className="ai-page"><h2>결과를 불러오는 중입니다...</h2></div>;
    }

    return (
        <>
            <nav id="nav3">
                <a href="/" className="logo">
                    AI Closet
                </a>
                <ul>
                    <li>
                        <Link to="/closet">옷장</Link>
                    </li>
                    <li>
                        <Link to="/AI">AI 추천</Link>
                    </li>
                    <li>
                        <Link to="/calendar">캘린더</Link>
                    </li>
                </ul>
                <button
                    className="nav-upload-btn"
                    onClick={() => navigate("/closet/upload")}
                >
                    옷 등록하기
                </button>
            </nav>

            <div className="ai-page">
                <h2>AI 추천 결과</h2>
                <p>총 {recommendations.length}개의 코디를 추천했습니다.</p>

                <div className="result-container">
                    {recommendations.length > 0 ? (
                        recommendations.map((combo, idx) => (
                            <div key={idx} className="result-card">
                                <h3>코디 #{idx + 1}</h3>

                                {combo.reason && (
                                    <div className="ai-comment-box">
                                        <strong>AI 코멘트:</strong> {combo.reason}
                                    </div>
                                )}

                                <div className="result-clothes">
                                    {["outer", "top", "bottom", "shoes"].map(
                                        (type) => {
                                            const item = findClothById(combo[type]);
                                            const imageUrl =
                                                !item?.imageUrl ||
                                                item.imageUrl.trim?.() === "" ||
                                                item.imageUrl === "null"
                                                    ? "/images/placeholder.png"
                                                    : item.imageUrl;

                                            return (
                                                <div
                                                    key={type}
                                                    className="result-item"
                                                >
                                                    <p className="result-item-type">
                                                        {type.toUpperCase()}
                                                    </p>
                                                    {item ? (
                                                        <>
                                                            <img
                                                                src={imageUrl}
                                                                alt={item.name}
                                                                width="120"
                                                                height="120"
                                                                className="result-item-image"
                                                                onError={(e) => {
                                                                    e.target.src =
                                                                        "/images/placeholder.png";
                                                                }}
                                                            />
                                                            <p className="result-item-name">
                                                                {item.name}
                                                            </p>
                                                            <p className="result-item-brand">
                                                                {item.brand}
                                                            </p>
                                                        </>
                                                    ) : (
                                                        <div className="no-recommendation">
                                                            추천 없음
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
                            해당 기간에 저장된 추천 결과가 없습니다.
                        </div>
                    )}
                </div>

                <button
                    className="recommend-btn"
                    onClick={() => navigate("/AI")}
                >
                    다시 추천받기
                </button>
            </div>
        </>
    );
}