import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import "./AIResult.css";
import { API_BASE_URL } from "./apiConfig";

export default function AIResult() {
    const location = useLocation();
    const navigate = useNavigate();
    
    // 이전 페이지에서 넘어온 전체 옷 정보와 타겟 날짜 정보
    const { allClothes = [], targetDate } = location.state || {};
    
    // 서버에서 받아온 추천 데이터를 저장할 상태
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);

    const findClothById = (id) => allClothes.find((c) => c.id === id);

    // 컴포넌트 마운트 시 서버에 저장된 추천 결과 요청
    useEffect(() => {
        const fetchRecommendations = async () => {
            try {
                // targetDate가 있으면 쿼리 스트링으로 전달, 없으면 오늘 날짜 기준
                const dateQuery = targetDate ? `?date=${targetDate}` : "";
                
                const response = await fetch(`${API_BASE_URL}/api//api/recommend/result${dateQuery}`);
                
                if (response.ok) {
                    const data = await response.json();
                    setRecommendations(data);
                } else {
                    console.error("데이터 가져오기 실패");
                }
            } catch (error) {
                console.error("통신 에러:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRecommendations();
    }, [targetDate]);

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
                    {recommendations.map((combo, idx) => (
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
                    ))}
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