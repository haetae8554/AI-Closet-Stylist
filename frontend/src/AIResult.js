import React from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import "./AIResult.css";

export default function AIResult() {
    const location = useLocation();
    const navigate = useNavigate();
    const { allClothes = [], recommendations = [] } = location.state || {};

    const findClothById = (id) => allClothes.find((c) => c.id === id);

    return (
        <>
            {/* [수정] Navbar 5개 메뉴 적용 및 '추천 결과' 활성화 */}
            <nav id="nav3">
                <Link to="/" className="logo">AI Closet</Link>
                <ul>
                    <li><Link to="/">메인</Link></li>
                    <li><Link to="/closet">옷장</Link></li>
                    <li><Link to="/AI">AI 추천</Link></li>
                    <li><Link to="/calendar">캘린더</Link></li>
                    <li><Link to="/AI/result" className="active">추천 결과</Link></li>
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