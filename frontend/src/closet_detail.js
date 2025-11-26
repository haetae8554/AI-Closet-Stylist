import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./closet_detail.css";

const h = React.createElement;
const FILTERS = ["전체", "상의", "아우터", "하의", "신발"];
const PLACEHOLDER = "/images/placeholder.png"; // public 폴더 기준 경로

function getSafeImageSrc(url) {
    if (!url) return PLACEHOLDER;
    const s = String(url).trim();
    if (!s || s === "null" || s === "undefined" || s === "about:blank")
        return PLACEHOLDER;
    // 확장자 없는 값이나 외부 링크 깨짐 방지
    if (!s.startsWith("http") && !s.startsWith("/")) return PLACEHOLDER;
    return s;
}

// 색상 → 이름 변환 유틸
function hexToRgb(hex) {
    if (!hex) return null;
    let h = hex.replace("#", "");
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    if (h.length !== 6) return null;
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
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

    useEffect(() => {
        const stored = JSON.parse(localStorage.getItem("closet_items") || "[]");
        setItems(stored);

        const params = new URLSearchParams(location.search);
        const id = params.get("id");
        const stateItem = location.state?.item || null;

        if (stateItem && (!id || String(stateItem.id) === String(id))) {
            setCurrent(stateItem);
        } else if (id) {
            const found = stored.find((x) => String(x.id) === String(id));
            setCurrent(found || null);
        } else {
            setCurrent(stored[stored.length - 1] || null);
        }
    }, [location.key, location.search, location.state?.item]);

    useEffect(() => setImgBroken(false), [current?.imageUrl]);

    const sorted = useMemo(() => {
        const list = [...items];
        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        return list;
    }, [items]);

    const indexOfCurrent = useMemo(() => {
        if (!current) return -1;
        return sorted.findIndex((x) => String(x.id) === String(current.id));
    }, [sorted, current]);

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
        navigate(`/closet_detail?id=${encodeURIComponent(prev.id)}`, { state: { item: prev } });
    };
    const goNext = () => {
        if (indexOfCurrent >= sorted.length - 1) return;
        const next = sorted[indexOfCurrent + 1];
        setCurrent(next);
        navigate(`/closet_detail?id=${encodeURIComponent(next.id)}`, { state: { item: next } });
    };

    const handleDelete = () => {
        if (!current) return;
        if (!window.confirm("이 옷 정보를 삭제할까요?")) return;
        const remain = items.filter((x) => x.id !== current.id);
        localStorage.setItem("closet_items", JSON.stringify(remain));
        setItems(remain);
        if (remain.length > 0) {
            const fallback = remain[Math.min(indexOfCurrent, remain.length - 1)];
            setCurrent(fallback);
            navigate(`/closet_detail?id=${encodeURIComponent(fallback.id)}`, {
                replace: true,
                state: { item: fallback },
            });
        } else navigate("/closet");
    };

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
                h("button", { className: "btn", onClick: () => alert("수정 기능은 준비 중입니다.") }, "수정"),
                h("button", { className: "btn danger", onClick: handleDelete }, "삭제"),
            ]),
            h("div", { className: "prev-next" }, [
                h("button", { className: "btn ghost", disabled: indexOfCurrent <= 0, onClick: goPrev }, "이전"),
                h("button", { className: "btn ghost", disabled: indexOfCurrent >= sorted.length - 1, onClick: goNext }, "다음"),
            ]),
        ]),
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
                onClick: () => alert("옷 등록 기능은 준비 중입니다."),
            }, "옷 등록하기"),
        ]),
        h("div", { className: "nav-back-wrapper" },
            h("button", {
                className: "btn back-btn",
                onClick: () => navigate("/closet"),
            }, "← 옷장으로 돌아가기")
        ),
        h("main", { className: "closet-page" }, [current ? DetailCard : "표시할 옷이 없습니다."]),
    ]);
}