import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./UploadCloth.css";

const CLOTH_TYPES = ["아우터", "상의", "하의", "신발"];
const THICKNESS_OPTIONS = ["", "얇음", "보통", "두꺼움"];

export default function UploadCloth() {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [brand, setBrand] = useState("");
    const [type, setType] = useState(CLOTH_TYPES[0]);
    const [subType, setSubType] = useState("");
    const [thickness, setThickness] = useState(THICKNESS_OPTIONS[0]);
    const [colors, setColors] = useState("");
    const [currentColor, setCurrentColor] = useState("#000000"); // 색상 피커용
    const [features, setFeatures] = useState("");
    const [imageFile, setImageFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleFileChange = (e) => {
        setImageFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");

        if (!name || !imageFile) {
            setMessage("옷 이름과 이미지를 모두 입력해주세요.");
            return;
        }

        setLoading(true);

        const formData = new FormData();
        formData.append("name", name);
        formData.append("type", type);
        formData.append("brand", brand || "");
        formData.append("subType", subType || "");
        formData.append("thickness", thickness || "");
        formData.append("colors", colors || "");
        formData.append("features", features || "");
        formData.append("image", imageFile);

        try {
            const res = await fetch(
                "http://localhost:3001/api/clothes/upload",
                {
                    method: "POST",
                    body: formData,
                }
            );

            const data = await res.json();

            if (res.ok) {
                setMessage(`✅ 옷 등록 성공: ${data.cloth.name}`);
                setName("");
                setBrand("");
                setSubType("");
                setThickness(THICKNESS_OPTIONS[0]);
                setColors("");
                setFeatures("");
                setImageFile(null);
                setTimeout(() => navigate("/closet"), 1500);
            } else {
                setMessage(`❌ 등록 실패: ${data.error || "알 수 없는 오류"}`);
            }
        } catch (err) {
            console.error("등록 요청 실패:", err);
            setMessage("❌ 서버와 통신 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="upload-page">
            <h2>새 옷 등록</h2>
            <form onSubmit={handleSubmit} className="upload-form">
                <div className="form-group">
                    <label htmlFor="name">옷 이름:</label>
                    <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="예: 레더 블루종 재킷"
                        required
                        disabled={loading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="brand">브랜드 (선택 사항):</label>
                    <input
                        id="brand"
                        type="text"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                        placeholder="예: 마크 곤잘레스"
                        disabled={loading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="type">분류:</label>
                    <select
                        id="type"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        required
                        disabled={loading}
                    >
                        {CLOTH_TYPES.map((t) => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="subType">소분류 (선택 사항):</label>
                    <input
                        id="subType"
                        type="text"
                        value={subType}
                        onChange={(e) => setSubType(e.target.value)}
                        placeholder="예: 블루종, 와이드 팬츠, 슬라이드"
                        disabled={loading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="thickness">두께감 (선택 사항):</label>
                    <select
                        id="thickness"
                        value={thickness}
                        onChange={(e) => setThickness(e.target.value)}
                        disabled={loading}
                    >
                        {THICKNESS_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                                {t || "선택 안 함"}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label htmlFor="colors">
                        색상 코드 (선택 사항, 콤마(,)로 구분):
                    </label>
                    <div
                        style={{
                            display: "flex",
                            gap: "10px",
                            alignItems: "center",
                        }}
                    >
                        <input
                            type="color"
                            value={currentColor}
                            onChange={(e) => setCurrentColor(e.target.value)}
                            style={{
                                height: "40px",
                                padding: "0",
                                flexShrink: 0,
                                width: "50px",
                            }}
                            disabled={loading}
                        />
                        <input
                            id="colors"
                            type="text"
                            value={colors}
                            onChange={(e) => setColors(e.target.value)}
                            placeholder="예: #000000, #FFFFFF, #FF0000"
                            disabled={loading}
                        />
                        <button
                            type="button"
                            onClick={() => {
                                setColors(
                                    (prev) =>
                                        (prev ? prev + ", " : "") +
                                        currentColor.toUpperCase()
                                );
                            }}
                            disabled={loading}
                            style={{ padding: "8px 12px", flexShrink: 0 }}
                        >
                            추가
                        </button>
                    </div>
                    <small style={{ color: "#888", marginTop: "5px" }}>
                        컬러 피커로 색을 선택 후 '추가' 버튼을 누르거나 직접
                        #RRGGBB 코드를 입력하세요.
                    </small>
                </div>

                <div className="form-group">
                    <label htmlFor="features">
                        특징 (선택 사항, 콤마(,)로 구분):
                    </label>
                    <input
                        id="features"
                        type="text"
                        value={features}
                        onChange={(e) => setFeatures(e.target.value)}
                        placeholder="예: 가죽, 스트리트, 워크웨어"
                        disabled={loading}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="image">사진:</label>
                    <input
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        required
                        disabled={loading}
                    />
                    {imageFile && (
                        <p className="file-info">
                            선택된 파일: {imageFile.name}
                        </p>
                    )}
                </div>

                {message && <p className="message-box">{message}</p>}

                <button type="submit" disabled={loading} className="submit-btn">
                    {loading ? "등록 중..." : "옷 등록하기"}
                </button>

                <button
                    type="button"
                    onClick={() => navigate("/closet")}
                    className="back-btn"
                >
                    취소 및 돌아가기
                </button>
            </form>
        </div>
    );
}
