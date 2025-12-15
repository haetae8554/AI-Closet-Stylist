import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./closet.css";

// [수정] 설정 파일에서 API 주소 가져오기
// (파일 위치에 따라 "./apiConfig" 또는 "../apiConfig"로 경로를 맞춰주세요)
import { API_BASE_URL } from "./apiConfig";

const h = React.createElement;
const FILTERS = ["전체", "상의", "아우터", "하의", "신발"];
const SORT_KEYS = ["정렬: 최신순", "정렬: 이름"];

// API 데이터가 들쭉날쭉할 수 있어서 표준 포맷으로 맞춰주는 함수
function normalizeItem(raw, idx = 0) {
    const id = String(raw?.id ?? Date.now() + "-" + idx);
    const type = String(raw?.type ?? "").trim();
    const subType = String(raw?.subType ?? "").trim();
    const brand = String(raw?.brand ?? "").trim();
    const nameRaw = (raw?.name ?? "").trim();
    
    // 이름이 없으면 브랜드+종류로 대체
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

// URL 쿼리스트링(?type=...)을 파싱해서 필터 상태 복구
function restoreFromURL(search, setters) {
    const params = new URLSearchParams(search);
    const type = params.get("type");
    const value = params.get("value");
    if (!type || !value) return;

    // 필터 종류가 늘어나면 case 추가 필요
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
    
    // 상세 필터 (태그 클릭 시 활성화)
    const [featureFilter, setFeatureFilter] = useState(null);
    const [subTypeFilter, setSubTypeFilter] = useState(null);
    const [brandFilter, setBrandFilter] = useState(null);
    const [thicknessFilter, setThicknessFilter] = useState(null);

    const [loading, setLoading] = useState(true);
    const [loadErr, setLoadErr] = useState("");
    const pageSize = 8;

    // 1. 초기 데이터 로드 (API 호출)
    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                setLoadErr("");
                
                // [수정] 상수(API_BASE_URL)를 사용하여 주소 조합
                const res = await fetch(`${API_BASE_URL}/api/clothes`);
                
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                
                // 데이터 정규화 후 상태 저장
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

    // 2. 뒤로가기(PopState) 및 URL 기반 필터 복구 처리
    useEffect(() => {
        const onPop = () => {
            // 일단 필터 초기화 후 URL에 맞춰 다시 세팅
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

    // 카테고리별 개수 계산 (useMemo로 성능 최적화)
    const counts = useMemo(() => {
        const map = { 전체: sourceItems.length };
        for (const t of FILTERS.slice(1))
            map[t] = sourceItems.filter((i) => i.type === t).length;
        return map;
    }, [sourceItems]);

    // 실제 필터링 로직
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

    // 페이지네이션 계산
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const pageSafe = Math.min(Math.max(1, page), totalPages);
    const paged = useMemo(() => {
        const start = (pageSafe - 1) * pageSize;
        return sorted.slice(start, start + pageSize);
    }, [sorted, pageSafe]);

    // 필터 조건 바뀌면 1페이지로 리셋
    useEffect(() => setPage(1), [filter, sortKey, featureFilter, subTypeFilter, brandFilter, thicknessFilter]);

    // 상세 페이지 이동 헬퍼
    const goDetail = (item) => {
        navigate(`/closet/detail?id=${item.id}`, { state: { item } });
    };

    // --- UI 컴포넌트 렌더링 ---
    
    const Nav = h("nav", { id: "nav3", role: "navigation" }, [
        h("a", { href: "/", className: "logo" }, "AI Closet"),
        h("ul", null, FILTERS.map((f) =>
            h("li", { key: f },
                h("a", {
                    href: "#",
                    className: filter === f && !featureFilter && !subTypeFilter && !brandFilter && !thicknessFilter ? "active" : undefined,
                    onClick: (e) => {
                        e.preventDefault();
                        setFilter(f);
                        // 대분류 클릭 시 상세 필터는 해제
                        setFeatureFilter(null); setSubTypeFilter(null); setBrandFilter(null); setThicknessFilter(null);
                        window.history.pushState({}, "", `?type=filter&value=${encodeURIComponent(f)}`);
                    },
                }, `${f} (${counts[f] || 0})`)
            )
        )),
        h("button", {
            id: "btnNavUpload",
            className: "nav-upload-btn",
            onClick: () => navigate("/closet/upload"), // 업로드 페이지 연결
        }, "옷 등록하기"),
    ]);

    const Toolbar = h("section", { className: "toolbar" }, [
        h("div", { className: "left" },
            brandFilter ? `홈 / 옷장 / ${brandFilter}`
            : subTypeFilter ? `홈 / 옷장 / ${filter} / ${subTypeFilter}`
            : featureFilter ? `홈 / 옷장 / ${featureFilter}`
            : thicknessFilter ? `홈 / 옷장 / 두께감: ${thicknessFilter}`
            : `홈 / 옷장 / ${filter}`
        ),
        h("div", { className: "right" },
            h("select", {
                id: "sortSelect",
                value: sortKey,
                onChange: (e) => setSortKey(e.target.value),
            }, SORT_KEYS.map((k) => h("option", { key: k, value: k }, k)))
        ),
    ]);

    const Card = (item) =>
        h("article", { key: item.id, className: "pcard" }, [
            h("div", { 
                className: "pthumb clickable",
                onClick: () => goDetail(item) // 썸네일 클릭 시 상세 이동
            }, 
                h("img", {
                    src: item.imageUrl,
                    alt: item.name || "의류 이미지",
                    loading: "lazy",
                    onError: (e) => { e.target.src = "/images/placeholder.png"; },
                })
            ),
            h("div", { className: "pmeta" }, [
                h("div", {
                    className: "brand clickable",
                    onClick: (e) => {
                        e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
                        setBrandFilter(item.brand);
                        window.history.pushState({}, "", `?type=brand&value=${encodeURIComponent(item.brand)}`);
                    },
                }, item.brand || "브랜드 미지정"),
                h("div", { 
                    className: item.name ? "title clickable" : "title empty-name clickable",
                    onClick: () => goDetail(item) // 제목 클릭 시 상세 이동
                }, item.name || "—"),
            ]),
            
            // 뱃지 영역 (서브타입, 특징)
            h("div", { className: "badges" }, [
                item.subType ? h("span", {
                    className: "badge subtype",
                    onClick: () => {
                        setSubTypeFilter(item.subType);
                        window.history.pushState({}, "", `?type=subType&value=${encodeURIComponent(item.subType)}`);
                    },
                }, `#${item.subType}`) : null,
                ...(item.features || []).map((f, i) =>
                    h("span", {
                        key: i,
                        className: "badge feature",
                        onClick: () => {
                            setFeatureFilter(f);
                            window.history.pushState({}, "", `?type=feature&value=${encodeURIComponent(f)}`);
                        },
                    }, `#${f}`)
                ),
            ].filter(Boolean)),

            // 두께감 표시
            item.thickness ? h("div", { className: "thickness-row" },
                h("span", {
                    className: "thickness clickable",
                    onClick: () => {
                        setThicknessFilter(item.thickness);
                        window.history.pushState({}, "", `?type=thickness&value=${encodeURIComponent(item.thickness)}`);
                    },
                }, `두께감: ${item.thickness}`)
            ) : null,

            // 색상 칩 표시
            h("div", { className: "colors" },
                (item.colors || []).map((c, idx) =>
                    h("span", { key: idx, className: "cchip", style: { background: c }, title: c })
                )
            ),
        ]);

    const GridOrEmpty = sorted.length > 0
        ? h("section", { id: "productGrid", className: "product-grid" }, paged.map(Card))
        : h("p", { className: "empty-hint" }, loading ? "불러오는 중…" : loadErr || "불러온 옷이 없습니다.");

    const Pager = sorted.length > 0
        ? h("footer", { className: "pager" }, [
            h("button", { disabled: pageSafe <= 1, onClick: () => setPage((p) => Math.max(1, p - 1)) }, "이전"),
            h("span", { className: "page-info" }, `${pageSafe} / ${totalPages}`),
            h("button", { disabled: pageSafe >= totalPages, onClick: () => setPage((p) => Math.min(totalPages, p + 1)) }, "다음"),
        ]) : null;

    return h("div", { className: "closet-page" }, [
        Nav,
        h("main", { className: "closet-container" }, [
            Toolbar,
            GridOrEmpty,
            Pager,
        ]),
    ]);
}