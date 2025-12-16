import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./closet_detail.css";
import { API_BASE_URL } from "./apiConfig";

const h = React.createElement;
const FILTERS = ["전체", "상의", "아우터", "하의", "신발"];
const PLACEHOLDER = "/images/placeholder.png";

// 안전한 이미지 소스 반환
function getSafeImageSrc(url) {
    if (!url) return PLACEHOLDER;
    const s = String(url).trim();
    if (!s || s === "null" || s === "undefined" || s === "about:blank") return PLACEHOLDER;
    if (!s.startsWith("http") && !s.startsWith("/")) return PLACEHOLDER;
    return s;
}

// Hex -> RGB 변환
function hexToRgb(hex) {
    if (!hex) return null;
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length !== 6) return null;
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// RGB -> HSL 변환
function rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            default: h = (r - g) / d + 4; break;
        }
        h *= 60;
    }
    return { h, s: s * 100, l: l * 100 };
}

// 색상 이름 추출
function colorNameFromHex(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex || "색상 미상";
    const { h, s, l } = rgbToHsl(rgb);
    if (l >= 92) return "화이트";
    if (l <= 12) return "블랙";
    if (s <= 8) return "그레이";
    if (h < 15 || h >= 345) return "레드";
    if (h < 35) return "오렌지";
    if (h < 55) return "옐로우";
    if (h < 85) return "라임";
    if (h < 160) return "그린";
    if (h < 190) return "민트";
    if (h < 210) return "시안";
    if (h < 240) return "블루";
    if (h < 265) return "인디고";
    if (h < 290) return "퍼플";
    if (h < 320) return "핑크";
    return "마젠타";
}

export default function ClosetDetail() {
    const navigate = useNavigate();
    const location = useLocation();
    const [items, setItems] = useState([]);
    const [current, setCurrent] = useState(null);
    const [imgBroken, setImgBroken] = useState(false);
    
    // 수정 모드 상태
    const [isEditing, setIsEditing] = useState(false);
    
    // 수정 폼 데이터 상태
    const [editForm, setEditForm] = useState({
        name: "",
        brand: "",
        type: "아우터",
        subType: "",
        thickness: "",
        features: "",
        colors: "", 
        imageFile: null
    });

    // 데이터 로드
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/clothes`);
                if (!res.ok) throw new Error("Load Failed");
                const data = await res.json();
                setItems(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("데이터 로드 실패:", err);
            }
        })();
    }, []);

    // URL 파라미터 또는 state로 현재 아이템 설정
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const id = params.get("id");
        const stateItem = location.state?.item || null;

        if (stateItem && (!id || String(stateItem.id) === String(id))) {
            setCurrent(stateItem);
        }
        else if (id && items.length > 0) {
            const found = items.find((x) => String(x.id) === String(id));
            setCurrent(found || null);
        }
    }, [location.key, location.search, location.state, items]);

    useEffect(() => {
        setImgBroken(false);
        setIsEditing(false); // 아이템 변경 시 수정 모드 해제
    }, [current?.id]);

    const sorted = useMemo(() => {
        const list = [...items];
        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        return list;
    }, [items]);

    const indexOfCurrent = useMemo(() => {
        if (!current) return -1;
        return sorted.findIndex((x) => String(x.id) === String(current.id));
    }, [sorted, current]);

    const handleGoBack = () => {
        if (location.state?.from === "home") {
            navigate("/");
        } else {
            navigate("/closet");
        }
    };

    const goFilter = (type, value) => {
        if (!value) return;
        navigate({
            pathname: "/closet",
            search: `?type=${encodeURIComponent(type)}&value=${encodeURIComponent(value)}`
        });
    };

    const goPrev = () => {
        if (indexOfCurrent <= 0) return;
        const prev = sorted[indexOfCurrent - 1];
        setCurrent(prev);
        navigate(`/closet/detail?id=${encodeURIComponent(prev.id)}`, { state: { item: prev } });
    };

    const goNext = () => {
        if (indexOfCurrent >= sorted.length - 1) return;
        const next = sorted[indexOfCurrent + 1];
        setCurrent(next);
        navigate(`/closet/detail?id=${encodeURIComponent(next.id)}`, { state: { item: next } });
    };

    // 삭제 처리
    const handleDelete = async () => {
        if (!current) return;
        if (!window.confirm("정말로 이 옷 데이터를 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.")) return;

        try {
            const res = await fetch(`${API_BASE_URL}/api/clothes/${current.id}`, {
                method: "DELETE",
            });

            if (res.ok) {
                alert("삭제되었습니다.");
                navigate("/closet", { replace: true });
            } else {
                const errData = await res.json();
                alert(`삭제 실패: ${errData.error || "서버 오류"}`);
            }
        } catch (e) {
            console.error(e);
            alert("서버 통신 오류 발생");
        }
    };

    // 수정 모드 진입
    const handleEditStart = () => {
        if (!current) return;
        setEditForm({
            name: current.name || "",
            brand: current.brand || "",
            type: current.type || "아우터",
            subType: current.subType || "",
            thickness: current.thickness || "",
            features: current.features ? current.features.join(", ") : "",
            colors: current.colors ? current.colors.join(", ") : "",
            imageFile: null
        });
        setIsEditing(true);
    };

    // 수정 모드 취소
    const handleEditCancel = () => {
        setIsEditing(false);
    };

    // 수정 내용 저장
    const handleEditSave = async (e) => {
        e.preventDefault();
        if (!current) return;

        const formData = new FormData();
        formData.append("name", editForm.name);
        formData.append("brand", editForm.brand);
        formData.append("type", editForm.type);
        formData.append("subType", editForm.subType);
        formData.append("thickness", editForm.thickness);
        formData.append("features", editForm.features);
        formData.append("colors", editForm.colors);
        if (editForm.imageFile) {
            formData.append("image", editForm.imageFile);
        }

        try {
            // 백엔드 구현 필요: PUT /api/clothes/:id
            const res = await fetch(`${API_BASE_URL}/api/clothes/${current.id}`, {
                method: "PUT", 
                body: formData,
            });

            if (res.ok) {
                const updatedData = await res.json();
                alert("수정되었습니다.");
                
                // 로컬 상태 업데이트
                setCurrent(updatedData.cloth);
                setItems(prev => prev.map(item => item.id === current.id ? updatedData.cloth : item));
                setIsEditing(false);
            } else {
                alert("수정 실패: 서버 오류");
            }
        } catch (err) {
            console.error(err);
            alert("서버 통신 오류");
        }
    };

    const handleFormChange = (field, value) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setEditForm(prev => ({ ...prev, imageFile: e.target.files[0] }));
        }
    };

    // 색상 표시 컴포넌트
    const ColorRow = (colors = []) => {
        if (!Array.isArray(colors) || colors.length === 0) return null;
        const labels = colors.map((c) => colorNameFromHex(c));
        return h("div", { className: "meta-block" }, [
            h("div", { className: "meta-line" }, [
                h("span", { className: "meta-label" }, "색상 "),
                h("span", { className: "meta-value" }, labels.join(", ")),
            ]),
            h("div", { className: "palette" },
                colors.map((c, i) =>
                    h("span", { key: i, className: "swatch", title: c, style: { background: c } })
                )
            ),
        ]);
    };

    // 상세 정보 카드 뷰
    const DetailCard = current && h("div", { className: "detail-card" }, [
        h("div", { className: "image-wrap" },
            h("img", {
                src: imgBroken ? PLACEHOLDER : getSafeImageSrc(current.imageUrl),
                alt: current.name || "cloth",
                onError: () => setImgBroken(true),
            })
        ),
        h("div", { className: "info" }, [
            h("h2", { className: "title" }, current.name || "(이름 없음)"),

            h("div", { className: "brand-type" }, [
                current.brand && h("span", { className: "chip clickable", onClick: () => goFilter("brand", current.brand) }, current.brand),
                current.type && h("span", { className: "chip clickable", onClick: () => goFilter("filter", current.type) }, current.type),
                current.subType && h("span", { className: "chip clickable", onClick: () => goFilter("subType", current.subType) }, current.subType),
            ]),

            h("div", { className: "meta-block" }, [
                current.thickness && h("div", { className: "meta-line" }, [
                    h("span", { className: "meta-label" }, "두께감 "),
                    h("span", { className: "meta-value" }, current.thickness),
                ]),
                current.features?.length > 0 && h("div", { className: "meta-line" }, [
                    h("span", { className: "meta-label" }, "특징 "),
                    h("span", { className: "meta-value" }, current.features.join(", ")),
                ]),
            ]),
            ColorRow(current.colors),

            h("div", { className: "meta-block secondary" }, [
                h("div", { className: "meta-line" }, [
                    h("span", { className: "meta-label" }, "등록일 "),
                    h("span", { className: "meta-value" },
                        current.createdAt ? new Date(current.createdAt).toLocaleString("ko-KR") : "-"
                    ),
                ]),
            ]),

            h("div", { className: "actions" }, [
                h("button", { className: "btn", onClick: handleEditStart }, "수정"),
                h("button", { className: "btn danger", onClick: handleDelete }, "삭제"),
            ]),
            h("div", { className: "prev-next" }, [
                h("button", { className: "btn ghost", disabled: indexOfCurrent <= 0, onClick: goPrev }, "이전"),
                h("button", { className: "btn ghost", disabled: indexOfCurrent >= sorted.length - 1, onClick: goNext }, "다음"),
            ]),
        ]),
    ]);

    // 수정 폼 뷰
    const EditCard = h("div", { className: "detail-card" }, [
        h("div", { className: "image-wrap" }, [
            // 기존 이미지 또는 새 파일 미리보기 로직이 필요할 수 있으나 단순화를 위해 현재 이미지 표시
            h("img", {
                src: editForm.imageFile ? URL.createObjectURL(editForm.imageFile) : getSafeImageSrc(current?.imageUrl),
                alt: "preview",
                style: { opacity: editForm.imageFile ? 1 : 0.6 }
            })
        ]),
        h("form", { className: "info", onSubmit: handleEditSave }, [
            h("h3", { style: {marginBottom: '15px'} }, "정보 수정"),
            
            h("div", { className: "form-group", style: {marginBottom: '10px'} }, [
                h("label", { style: {display:'block', fontSize:'13px', color:'#666'} }, "이름"),
                h("input", { 
                    type: "text", 
                    value: editForm.name, 
                    onChange: (e) => handleFormChange("name", e.target.value),
                    style: {width:'100%', padding:'8px', marginTop:'4px'}
                })
            ]),
            
            h("div", { className: "form-group", style: {marginBottom: '10px'} }, [
                h("label", { style: {display:'block', fontSize:'13px', color:'#666'} }, "분류"),
                h("select", { 
                    value: editForm.type, 
                    onChange: (e) => handleFormChange("type", e.target.value),
                    style: {width:'100%', padding:'8px', marginTop:'4px'}
                }, ["아우터", "상의", "하의", "신발"].map(t => h("option", {key:t, value:t}, t)))
            ]),

            h("div", { className: "form-group", style: {marginBottom: '10px'} }, [
                h("label", { style: {display:'block', fontSize:'13px', color:'#666'} }, "브랜드"),
                h("input", { 
                    type: "text", 
                    value: editForm.brand, 
                    onChange: (e) => handleFormChange("brand", e.target.value),
                    style: {width:'100%', padding:'8px', marginTop:'4px'}
                })
            ]),

            h("div", { className: "form-group", style: {marginBottom: '10px'} }, [
                h("label", { style: {display:'block', fontSize:'13px', color:'#666'} }, "소분류"),
                h("input", { 
                    type: "text", 
                    value: editForm.subType, 
                    onChange: (e) => handleFormChange("subType", e.target.value),
                    style: {width:'100%', padding:'8px', marginTop:'4px'}
                })
            ]),

            h("div", { className: "form-group", style: {marginBottom: '10px'} }, [
                h("label", { style: {display:'block', fontSize:'13px', color:'#666'} }, "두께감"),
                h("select", { 
                    value: editForm.thickness, 
                    onChange: (e) => handleFormChange("thickness", e.target.value),
                    style: {width:'100%', padding:'8px', marginTop:'4px'}
                }, ["", "얇음", "보통", "두꺼움"].map(t => h("option", {key:t, value:t}, t || "선택 안 함")))
            ]),

            h("div", { className: "form-group", style: {marginBottom: '10px'} }, [
                h("label", { style: {display:'block', fontSize:'13px', color:'#666'} }, "색상 (콤마 구분)"),
                h("input", { 
                    type: "text", 
                    value: editForm.colors, 
                    placeholder: "#000000, #FFFFFF",
                    onChange: (e) => handleFormChange("colors", e.target.value),
                    style: {width:'100%', padding:'8px', marginTop:'4px'}
                })
            ]),

            h("div", { className: "form-group", style: {marginBottom: '10px'} }, [
                h("label", { style: {display:'block', fontSize:'13px', color:'#666'} }, "특징 (콤마 구분)"),
                h("input", { 
                    type: "text", 
                    value: editForm.features, 
                    onChange: (e) => handleFormChange("features", e.target.value),
                    style: {width:'100%', padding:'8px', marginTop:'4px'}
                })
            ]),

            h("div", { className: "form-group", style: {marginBottom: '10px'} }, [
                h("label", { style: {display:'block', fontSize:'13px', color:'#666'} }, "이미지 변경 (선택)"),
                h("input", { 
                    type: "file", 
                    accept: "image/*",
                    onChange: handleFileChange,
                    style: {marginTop:'4px'}
                })
            ]),

            h("div", { className: "actions", style: {marginTop: '20px'} }, [
                h("button", { type: "submit", className: "btn", style:{background: '#007bff', color:'white', borderColor:'#007bff'} }, "저장"),
                h("button", { type: "button", className: "btn", onClick: handleEditCancel }, "취소"),
            ]),
        ])
    ]);

    return h(React.Fragment, null, [
        h("nav", { id: "nav3", role: "navigation" }, [
            h("a", { href: "/", className: "logo" }, "AI Closet"),
            h("ul", null, FILTERS.map((f) =>
                h("li", { key: f },
                    h("a", { href: "#", onClick: (e) => { e.preventDefault(); goFilter("filter", f); } }, f)
                )
            )),
            h("button", {
                id: "btnNavUpload",
                className: "nav-upload-btn",
                onClick: () => navigate("/closet/upload"),
            }, "옷 등록하기"),
        ]),
        h("div", { className: "nav-back-wrapper" },
            h("button", {
                className: "btn back-btn",
                onClick: handleGoBack,
            }, `← ${location.state?.from === "home" ? "홈으로 돌아가기" : "옷장으로 돌아가기"}`)
        ),
        h("main", { className: "closet-page" }, [
            !current ? "표시할 옷 정보를 불러오는 중입니다..." : (isEditing ? EditCard : DetailCard)
        ]),
    ]);
}