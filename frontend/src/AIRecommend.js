// src/AIRecommend.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AIRecommend.css";

export default function AIRecommend() {
    const navigate = useNavigate();
    const [allClothes, setAllClothes] = useState([]);
    const [selectedItems, setSelectedItems] = useState({
        아우터: null,
        상의: null,
        하의: null,
        신발: null,
    });
    const [category, setCategory] = useState("아우터");
    const [loading, setLoading] = useState(false);

    //  public/data 폴더에서 clothes.json 불러오기
    useEffect(() => {
        fetch("/data/clothes.json", { cache: "no-store" })
            .then((res) => res.json())
            .then((data) => {
                console.log("🧥 옷 데이터 불러옴:", data);

                // 이미지 없으면 기본 이미지로 대체
                const normalized = (Array.isArray(data) ? data : []).map(
                    (item, idx) => {
                        let imageUrl = item?.imageUrl;
                        if (
                            !imageUrl ||
                            imageUrl.trim?.() === "" ||
                            imageUrl === "null"
                        ) {
                            imageUrl = "/images/placeholder.png";
                        }
                        return { ...item, imageUrl };
                    }
                );

                setAllClothes(normalized);
            })
            .catch((err) => {
                console.error("옷 데이터 불러오기 실패:", err);
                setAllClothes([]);
            });
    }, []);

    //  카테고리별 필터링 (한글 기준)
    const filteredClothes = allClothes.filter((item) => item.type === category);

    const handleSelect = (cloth) => {
        setSelectedItems((prev) => ({ ...prev, [category]: cloth }));
    };

    const handleRemove = (type) => {
        setSelectedItems((prev) => ({ ...prev, [type]: null }));
    };

    const handleRecommend = async () => {
        try {
            setLoading(true);
            const res = await fetch("http://localhost:3001/api/recommend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clothes: allClothes, //  전체 옷 데이터
                    selected: selectedItems,
                }),
            });

            const data = await res.json();
            console.log("AI 추천 결과:", data);

            navigate("/AI/result", {
                state: {
                    allClothes,
                    selectedItems,
                    recommendations: data.recommendations || [],
                },
            });
        } catch (err) {
            console.error("AI 추천 요청 실패:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ai-page">
            <h2>AI 코디 추천</h2>

            <div className="category-bar">
                {["아우터", "상의", "하의", "신발"].map((cat) => (
                    <button
                        key={cat}
                        className={`cat-btn ${category === cat ? "active" : ""
                            }`}
                        onClick={() => setCategory(cat)}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <div className="ai-layout">
                <div className="clothes-list">
                    {filteredClothes.map((cloth) => (
                        <div
                            key={cloth.id}
                            className={`cloth-card ${selectedItems[category]?.id === cloth.id
                                    ? "selected"
                                    : ""
                                }`}
                            onClick={() => handleSelect(cloth)}
                        >
                            <img
                                src={cloth.imageUrl}
                                alt={cloth.name}
                                onError={(e) => {
                                    e.target.src = "/images/placeholder.png";
                                }}
                            />
                            <p>{cloth.name}</p>
                            <p style={{ fontSize: "0.8rem", color: "#666" }}>
                                {cloth.brand}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="selected-panel">
                    <h3>선택된 옷</h3>
                    {["아우터", "상의", "하의", "신발"].map((type) => (
                        <div key={type} className="selected-item">
                            {selectedItems[type] ? (
                                <>
                                    <img
                                        src={selectedItems[type].imageUrl}
                                        alt={selectedItems[type].name}
                                        onError={(e) => {
                                            e.target.src =
                                                "/images/placeholder.png";
                                        }}
                                    />
                                    <span>{selectedItems[type].name}</span>
                                    <button
                                        className="remove-btn"
                                        onClick={() => handleRemove(type)}
                                    >
                                        ✕
                                    </button>
                                </>
                            ) : (
                                <span>{type} 선택 안 함</span>
                            )}
                        </div>
                    ))}
                    <button
                        className="recommend-btn"
                        onClick={handleRecommend}
                        disabled={loading}
                    >
                        {loading ? "AI가 코디 중..." : "AI 추천받기"}
                    </button>
                </div>
            </div>
        </div>
    );
}