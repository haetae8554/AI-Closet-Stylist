import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom"; // Link 추가
import "./closet.css";

// [수정] 설정 파일에서 API 주소 가져오기
import { API_BASE_URL } from "./apiConfig";

const FILTERS = ["전체", "상의", "아우터", "하의", "신발"];
const SORT_KEYS = ["정렬: 최신순", "정렬: 이름"];

// API 데이터 정규화 함수
function normalizeItem(raw, idx = 0) {
    const id = String(raw?.id ?? Date.now() + "-" + idx);
    const type = String(raw?.type ?? "").trim();
    const subType = String(raw?.subType ?? "").trim();
    const brand = String(raw?.brand ?? "").trim();
    const nameRaw = (raw?.name ?? "").trim();
    
    const name = nameRaw || (brand && subType ? `${brand} ${subType}` : brand || subType || "");
    
    const colors = Array.isArray(raw?.colors) ? raw.colors.map(String) : raw?.color ? [String(raw.color)] : [];
    const thickness = String(raw?.thickness ?? "").trim();
    const features = Array.isArray(raw?.features) ? raw.features.map((f) => f.trim()) : raw?.feature ? [String(raw.feature).trim()] : [];

    let imageUrl = raw?.imageUrl;
    if (!imageUrl || imageUrl.trim?.() === "" || imageUrl === "null") {
        imageUrl = "/images/placeholder.png";
    }

    return {
        id, type, subType, name, brand, colors, thickness, features, imageUrl,
        createdAt: raw?.createdAt || new Date().toISOString(),
        _incomplete: type === "" || colors.length === 0,
    };
}

// URL 쿼리스트링 파싱
function restoreFromURL(search, setters) {
    const params = new URLSearchParams(search);
    const type = params.get("type");
    const value = params.get("value");
    if (!type || !value) return;

    switch (type) {
        case "feature": setters.setFeatureFilter(value); break;
        case "subType": setters.setSubTypeFilter(value); break;
        case "brand": setters.setBrandFilter(value); break;
        case "thickness": setters.setThicknessFilter(value); break;
        case "filter": setters.setFilter(value); break;
        default: break;
    }
}

export default function Closet() {
    const navigate = useNavigate();
    const [sourceItems, setSourceItems] = useState([]);
    
    // 필터 및 정렬 상태들
    const [filter, setFilter] = useState("전체");
    const [sortKey, setSortKey] = useState("정렬: 최신순");
    const [page, setPage] = useState(1);
    
    // 상세 필터
    const [featureFilter, setFeatureFilter] = useState(null);
    const [subTypeFilter, setSubTypeFilter] = useState(null);
    const [brandFilter, setBrandFilter] = useState(null);
    const [thicknessFilter, setThicknessFilter] = useState(null);

    const [loading, setLoading] = useState(true);
    const [loadErr, setLoadErr] = useState("");
    const pageSize = 8;

    // 1. 초기 데이터 로드
    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                setLoadErr("");
                
                const res = await fetch(`${API_BASE_URL}/api/clothes`);
                
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                
                const normalized = (Array.isArray(data) ? data : []).map(normalizeItem);
                setSourceItems(normalized);
            } catch (e) {
                console.error(e);
                setLoadErr("데이터 로드 실패");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // 2. 뒤로가기 및 URL 복구
    useEffect(() => {
        const onPop = () => {
            setFeatureFilter(null); setSubTypeFilter(null); setBrandFilter(null); setThicknessFilter(null); setFilter("전체");
            setTimeout(() => {
                restoreFromURL(window.location.search, {
                    setFeatureFilter, setSubTypeFilter, setBrandFilter, setThicknessFilter, setFilter,
                });
            }, 10);
        };

        window.addEventListener("popstate", onPop);
        restoreFromURL(window.location.search, {
            setFeatureFilter, setSubTypeFilter, setBrandFilter, setThicknessFilter, setFilter,
        });

        return () => window.removeEventListener("popstate", onPop);
    }, []);

    // 카테고리별 개수 계산
    const counts = useMemo(() => {
        const map = { 전체: sourceItems.length };
        for (const t of FILTERS.slice(1))
            map[t] = sourceItems.filter((i) => i.type === t).length;
        return map;
    }, [sourceItems]);

    // 필터링 로직
    const filtered = useMemo(() => {
        let base = sourceItems;
        if (filter !== "전체") base = base.filter((i) => i.type === filter);
        if (featureFilter) base = base.filter((i) => i.features.includes(featureFilter));
        if (subTypeFilter) base = base.filter((i) => i.subType === subTypeFilter);
        if (brandFilter) base = base.filter((i) => i.brand === brandFilter);
        if (thicknessFilter) base = base.filter((i) => i.thickness === thicknessFilter);
        return base;
    }, [sourceItems, filter, featureFilter, subTypeFilter, brandFilter, thicknessFilter]);

    // 정렬 로직
    const sorted = useMemo(() => {
        const arr = [...filtered];
        const map = {
            "정렬: 최신순": (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
            "정렬: 이름": (a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ko"),
        };
        arr.sort(map[sortKey] || map["정렬: 최신순"]);
        return arr;
    }, [filtered, sortKey]);

    // 페이지네이션
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const pageSafe = Math.min(Math.max(1, page), totalPages);
    const paged = useMemo(() => {
        const start = (pageSafe - 1) * pageSize;
        return sorted.slice(start, start + pageSize);
    }, [sorted, pageSafe]);

    useEffect(() => setPage(1), [filter, sortKey, featureFilter, subTypeFilter, brandFilter, thicknessFilter]);

    const goDetail = (item) => {
        navigate(`/closet/detail?id=${item.id}`, { state: { item } });
    };

    // 카테고리 클릭 핸들러
    const handleCategoryClick = (f) => {
        setFilter(f);
        setFeatureFilter(null); setSubTypeFilter(null); setBrandFilter(null); setThicknessFilter(null);
        window.history.pushState({}, "", `?type=filter&value=${encodeURIComponent(f)}`);
    }

    return (
        <div className="closet-page">
            {/* 1. Global Navigation (공통) */}
            <nav id="nav3">
                <Link to="/" className="logo">AI Closet</Link>
                <ul>
                    {/* 옷장 페이지이므로 '옷장'에 active 클래스 부여 */}
                    <li><Link to="/closet" className="active">옷장</Link></li>
                    <li><Link to="/AI">AI 추천</Link></li>
                    <li><Link to="/calendar">캘린더</Link></li>
                </ul>
                <button 
                    className="nav-upload-btn" 
                    onClick={() => navigate("/closet/upload")}
                >
                    옷 등록하기
                </button>
            </nav>

            <main className="closet-container">
                {/* 2. Sub Navigation (옷장 필터) - 아래로 이동 */}
                <section className="category-tabs">
                    <ul>
                        {FILTERS.map((f) => {
                            const isActive = filter === f && !featureFilter && !subTypeFilter && !brandFilter && !thicknessFilter;
                            return (
                                <li key={f}>
                                    <button 
                                        className={isActive ? "active" : ""}
                                        onClick={() => handleCategoryClick(f)}
                                    >
                                        {f} <span className="count">{counts[f] || 0}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </section>

                {/* Toolbar */}
                <section className="toolbar">
                    <div className="left">
                        {brandFilter ? `홈 / 옷장 / ${brandFilter}`
                        : subTypeFilter ? `홈 / 옷장 / ${filter} / ${subTypeFilter}`
                        : featureFilter ? `홈 / 옷장 / ${featureFilter}`
                        : thicknessFilter ? `홈 / 옷장 / 두께감: ${thicknessFilter}`
                        : `홈 / 옷장 / ${filter}`}
                    </div>
                    <div className="right">
                        <select 
                            id="sortSelect" 
                            value={sortKey} 
                            onChange={(e) => setSortKey(e.target.value)}
                        >
                            {SORT_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                    </div>
                </section>

                {/* Product Grid */}
                {sorted.length > 0 ? (
                    <section id="productGrid" className="product-grid">
                        {paged.map((item) => (
                            <article key={item.id} className="pcard">
                                <div className="pthumb clickable" onClick={() => goDetail(item)}>
                                    <img 
                                        src={item.imageUrl} 
                                        alt={item.name || "의류 이미지"} 
                                        loading="lazy"
                                        onError={(e) => { e.target.src = "/images/placeholder.png"; }}
                                    />
                                </div>
                                <div className="pmeta">
                                    <div 
                                        className="brand clickable"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setBrandFilter(item.brand);
                                            window.history.pushState({}, "", `?type=brand&value=${encodeURIComponent(item.brand)}`);
                                        }}
                                    >
                                        {item.brand || "브랜드 미지정"}
                                    </div>
                                    <div 
                                        className={item.name ? "title clickable" : "title empty-name clickable"}
                                        onClick={() => goDetail(item)}
                                    >
                                        {item.name || "—"}
                                    </div>
                                </div>
                                
                                <div className="badges">
                                    {item.subType && (
                                        <span 
                                            className="badge subtype"
                                            onClick={() => {
                                                setSubTypeFilter(item.subType);
                                                window.history.pushState({}, "", `?type=subType&value=${encodeURIComponent(item.subType)}`);
                                            }}
                                        >
                                            #{item.subType}
                                        </span>
                                    )}
                                    {(item.features || []).map((f, i) => (
                                        <span 
                                            key={i} 
                                            className="badge feature"
                                            onClick={() => {
                                                setFeatureFilter(f);
                                                window.history.pushState({}, "", `?type=feature&value=${encodeURIComponent(f)}`);
                                            }}
                                        >
                                            #{f}
                                        </span>
                                    ))}
                                </div>

                                {item.thickness && (
                                    <div className="thickness-row">
                                        <span 
                                            className="thickness clickable"
                                            onClick={() => {
                                                setThicknessFilter(item.thickness);
                                                window.history.pushState({}, "", `?type=thickness&value=${encodeURIComponent(item.thickness)}`);
                                            }}
                                        >
                                            두께감: {item.thickness}
                                        </span>
                                    </div>
                                )}

                                <div className="colors">
                                    {(item.colors || []).map((c, idx) => (
                                        <span key={idx} className="cchip" style={{ background: c }} title={c}></span>
                                    ))}
                                </div>
                            </article>
                        ))}
                    </section>
                ) : (
                    <p className="empty-hint">{loading ? "불러오는 중…" : loadErr || "불러온 옷이 없습니다."}</p>
                )}

                {/* Pager */}
                {sorted.length > 0 && (
                    <footer className="pager">
                        <button disabled={pageSafe <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>이전</button>
                        <span className="page-info">{pageSafe} / {totalPages}</span>
                        <button disabled={pageSafe >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>다음</button>
                    </footer>
                )}
            </main>
        </div>
    );
}