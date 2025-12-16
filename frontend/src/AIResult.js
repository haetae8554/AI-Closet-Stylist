import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import "./AIResult.css"; // 기존 스타일 유지
import { API_BASE_URL } from "./apiConfig";

export default function AIResult() {
    const location = useLocation();
    const navigate = useNavigate();

    // AIRecommend에서 넘겨준 state 받기
    const {
        allClothes = [],
        recommendations: initialRecs,
        period,
    } = location.state || {};

    // state로 받은 데이터가 있으면 그걸 쓰고, 없으면 빈 배열 (새로고침 시 사라질 수 있음)
    const [recommendations, setRecommendations] = useState(initialRecs || []);

    // 옷 정보 찾기 헬퍼
    const findClothById = (id) => allClothes.find((c) => c.id === id);

    // [NEW] 이미지 URL 처리 함수 (RecommendationResultPage와 동일 로직 적용)
    const getImageUrl = (url) => {
        if (!url || url === "null")
            return "https://via.placeholder.com/150?text=No+Image";
        // 외부 링크(http, https)인 경우 그대로 반환
        if (url.startsWith("http") || url.startsWith("https")) {
            return url;
        }
        // 내부 파일인 경우 API 주소 결합
        return `${API_BASE_URL}${url}`;
    };

    // 만약 state 없이 직접 접근했다면 메인으로 돌려보내거나 알림
    useEffect(() => {
        if (!initialRecs && !period) {
            // 직접 URL 치고 들어온 경우 등
            console.warn("전달된 추천 데이터가 없습니다.");
        }
    }, [initialRecs, period]);

    return (
        <>
            <nav id="nav3">
                <Link to="/" className="logo">
                    AI Closet
                </Link>
                <ul>
                    <li>
                        <Link to="/">메인</Link>
                    </li>
                    <li>
                        <Link to="/closet">옷장</Link>
                    </li>
                    <li>
                        <Link to="/AI" className="active">
                            AI 추천
                        </Link>
                    </li>
                    <li>
                        <Link to="/calendar">캘린더</Link>
                    </li>
                    <li>
                        <Link to="/AI/result">추천 결과</Link>
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
                <div style={{ textAlign: "center", marginTop: "0px" }}>
                    <h2>✨ 추천 결과 도착!</h2>
                    <p style={{ color: "#666" }}>
                        {period
                            ? `${new Date(
                                  period.start
                              ).toLocaleDateString()} ~ ${new Date(
                                  period.end
                              ).toLocaleDateString()}`
                            : ""}
                        기간의 코디입니다.
                    </p>
                </div>

                <div className="result-container">
                    {recommendations.length > 0 ? (
                        recommendations.map((combo, idx) => (
                            <div key={idx} className="result-card">
                                <h3>Option {idx + 1}</h3>

                                {combo.reason && (
                                    <div className="ai-comment-box">
                                        <strong>💡 AI 코멘트:</strong>{" "}
                                        {combo.reason}
                                    </div>
                                )}

                                <div className="result-clothes">
                                    {["outer", "top", "bottom", "shoes"].map(
                                        (type) => {
                                            const item = findClothById(
                                                combo[type]
                                            );

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
                                                            {/* [NEW] 수정된 이미지 렌더링 부분 */}
                                                            <img
                                                                src={getImageUrl(
                                                                    item.imageUrl
                                                                )}
                                                                alt={item.name}
                                                                className="result-item-image"
                                                                onError={(
                                                                    e
                                                                ) => {
                                                                    e.target.onerror =
                                                                        null;
                                                                    e.target.src =
                                                                        "https://via.placeholder.com/150?text=Error";
                                                                }}
                                                            />
                                                            <p className="result-item-name">
                                                                {item.name}
                                                            </p>
                                                        </>
                                                    ) : (
                                                        <div className="no-recommendation">
                                                            선택 안함
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
                        <div
                            style={{
                                textAlign: "center",
                                padding: "40px",
                                color: "#666",
                            }}
                        >
                            추천 결과를 불러올 수 없습니다. 다시 시도해주세요.
                        </div>
                    )}
                </div>

                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "20px",
                        margin: "40px 0 60px 0",
                    }}
                >
                    <button
                        className="recommend-btn"
                        style={{ backgroundColor: "#888" }}
                        onClick={() => navigate("/AI")}
                    >
                        다시 추천받기
                    </button>

                    <button
                        className="recommend-btn"
                        onClick={() => navigate("/AI/result")}
                    >
                        📅 캘린더에 저장된 기록 보기
                    </button>
                </div>
            </div>
        </>
    );
}
