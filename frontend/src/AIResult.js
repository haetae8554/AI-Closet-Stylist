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

                        {combo.reason && (
                            <div
                                style={{
                                    backgroundColor: "#f0f8ff",
                                    padding: "12px",
                                    borderRadius: "8px",
                                    marginBottom: "20px",
                                    fontSize: "0.95rem",
                                    color: "#333",
                                    lineHeight: "1.5",
                                }}
                            >
                                <strong>AI 코멘트:</strong> {combo.reason}
                            </div>
                        )}

                        <div
                            className="result-clothes"
                            style={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "flex-start",
                                gap: "30px",
                                flexWrap: "wrap",
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
                                                <p style={{ marginTop: "5px" }}>{item.name}</p>
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
                                            <div
                                                style={{
                                                    width: "120px",
                                                    height: "120px",
                                                    margin: "0 auto",
                                                    background: "#eee",
                                                    borderRadius: "8px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    color: "#999",
                                                    fontSize: "0.8rem",
                                                }}
                                            >
                                                추천 없음
                                            </div>
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