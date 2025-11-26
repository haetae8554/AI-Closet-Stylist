// src/AIResult.js
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function AIResult() {
    const location = useLocation();
    const navigate = useNavigate();
    const { allClothes = [], recommendations = [] } = location.state || {};

    const findClothById = (id) => allClothes.find((c) => c.id === id);

    return (
        <div className="ai-page">
            <h2>AI 추천 결과</h2>
            <p>총 {recommendations.length}개의 코디를 추천했습니다.</p>

            <div className="result-container">
                {recommendations.map((combo, idx) => (
                    <div
                        key={idx}
                        className="result-card"
                        style={{
                            border: "1px solid #ddd",
                            borderRadius: "10px",
                            padding: "20px",
                            marginBottom: "25px",
                            background: "#fff",
                            boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                        }}
                    >
                        <h3
                            style={{
                                borderBottom: "2px solid #eee",
                                paddingBottom: "8px",
                                marginBottom: "15px",
                            }}
                        >
                            코디 #{idx + 1}
                        </h3>

                        {/* 가로 한 줄 정렬 */}
                        <div
                            className="result-clothes"
                            style={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "flex-start",
                                gap: "30px",
                                flexWrap: "nowrap",
                            }}
                        >
                            {["outer", "top", "bottom", "shoes"].map((type) => {
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
                                        style={{
                                            textAlign: "center",
                                            width: "160px",
                                        }}
                                    >
                                        <p
                                            style={{
                                                fontWeight: "bold",
                                                marginBottom: "6px",
                                            }}
                                        >
                                            {type.toUpperCase()}
                                        </p>
                                        {item ? (
                                            <>
                                                <img
                                                    src={imageUrl}
                                                    alt={item.name}
                                                    width="120"
                                                    height="120"
                                                    style={{
                                                        objectFit: "cover",
                                                        borderRadius: "8px",
                                                        border: "1px solid #eee",
                                                    }}
                                                    onError={(e) => {
                                                        e.target.src =
                                                            "/images/placeholder.png";
                                                    }}
                                                />
                                                <p>{item.name}</p>
                                                <p
                                                    style={{
                                                        fontSize: "0.8rem",
                                                        color: "#777",
                                                    }}
                                                >
                                                    {item.brand}
                                                </p>
                                            </>
                                        ) : (
                                            <p>선택된 옷 없음</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <button className="recommend-btn" onClick={() => navigate("/AI")}>
                다시 추천받기
            </button>
        </div>
    );
}