import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./closet.css";

const h = React.createElement;
const FILTERS = ["전체", "상의", "아우터", "하의", "신발"];
const SORT_KEYS = ["정렬: 최신순", "정렬: 이름"];

// ────────────────────────────────
// 데이터 정규화
// ────────────────────────────────
function normalizeItem(raw, idx = 0) {
    const id = String(raw?.id ?? Date.now() + "-" + idx);
    const type = String(raw?.type ?? "").trim();
    const subType = String(raw?.subType ?? "").trim();
    const brand = String(raw?.brand ?? "").trim();
    const nameRaw = (raw?.name ?? "").trim();
    const name =
        nameRaw || (brand && subType ? `${brand} ${subType}` : brand || subType || "");
    const colors = Array.isArray(raw?.colors)
        ? raw.colors.map(String)
        : raw?.color
            ? [String(raw.color)]
            : [];
    const thickness = String(raw?.thickness ?? "").trim();
    const features = Array.isArray(raw?.features)
        ? raw.features.map((f) => f.trim())
        : raw?.feature
            ? [String(raw.feature).trim()]
            : [];

    let imageUrl = raw?.imageUrl;
    if (!imageUrl || imageUrl.trim?.() === "" || imageUrl === "null") {
        imageUrl = "/images/placeholder.png";
    }

    return {
        id,
        type,
        subType,
        name,
        brand,
        colors,
        thickness,
        features,
        imageUrl,
        createdAt: raw?.createdAt || new Date().toISOString(),
        _incomplete: type === "" || colors.length === 0,
    };
}

// ────────────────────────────────
// URL → 상태 복원 (+ 쿼리 없으면 전체 초기화)
// ────────────────────────────────
function restoreFromURL(search, setters) {
    const params = new URLSearchParams(search);
    const type = params.get("type");
    const value = params.get("value");

    // 쿼리가 비어있으면 이전 필터를 모두 초기화
    if (!type || !value) {
        if (typeof setters.resetAll === "function") {
            setters.resetAll();
        }
        return;
    }

    switch (type) {
        case "feature":
            setters.setFeatureFilter(value);
            break;
        case "subType":
            setters.setSubTypeFilter(value);
            break;
        case "brand":
            setters.setBrandFilter(value);
            break;
        case "thickness":
            setters.setThicknessFilter(value);
            break;
        case "filter":
            setters.setFilter(value);
            break;
        default:
            break;
    }
}

// ────────────────────────────────
export default function Closet() {
    const navigate = useNavigate();
    const location = useLocation();

    const [sourceItems, setSourceItems] = useState([]);
    const [filter, setFilter] = useState("전체");
    const [sortKey, setSortKey] = useState("정렬: 최신순");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadErr, setLoadErr] = useState("");
    const [featureFilter, setFeatureFilter] = useState(null);
    const [subTypeFilter, setSubTypeFilter] = useState(null);
    const [brandFilter, setBrandFilter] = useState(null);
    const [thicknessFilter, setThicknessFilter] = useState(null);
    const pageSize = 8;

    // 데이터 로드
    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                setLoadErr("");
                const res = await fetch("/data/clothes.json", { cache: "no-store" });
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

    // 로컬스토리지에 목록 캐시(상세 단독 진입 대비)
    useEffect(() => {
        if (sourceItems.length) {
            localStorage.setItem("closet_items", JSON.stringify(sourceItems));
        }
    }, [sourceItems]);

    // URL이 바뀔 때마다(뒤로가기 포함) 필터 상태 복원 + 스크롤 복원
    useEffect(() => {
        restoreFromURL(location.search, {
            setFeatureFilter,
            setSubTypeFilter,
            setBrandFilter,
            setThicknessFilter,
            setFilter,
            // 쿼리 없을 때 전체 초기화
            resetAll: () => {
                setFilter("전체");
                setFeatureFilter(null);
                setSubTypeFilter(null);
                setBrandFilter(null);
                setThicknessFilter(null);
                setPage(1);
            },
        });

        // 스크롤 복원(상세로 이동 전 현재 엔트리에 저장해둔 값)
        const st = location.state;
        if (st && typeof st.gridScrollY === "number") {
            setTimeout(() => window.scrollTo(0, st.gridScrollY), 0);
        }
    }, [location.key, location.search]); // key 포함: 히스토리 스텝 이동시에도 반응

    // 카테고리별 카운트
    const counts = useMemo(() => {
        const map = { 전체: sourceItems.length };
        for (const t of FILTERS.slice(1)) map[t] = sourceItems.filter((i) => i.type === t).length;
        return map;
    }, [sourceItems]);

    // 필터링
    const filtered = useMemo(() => {
        let base = sourceItems;
        if (filter !== "전체") base = base.filter((i) => i.type === filter);
        if (featureFilter) base = base.filter((i) => i.features.includes(featureFilter));
        if (subTypeFilter) base = base.filter((i) => i.subType === subTypeFilter);
        if (brandFilter) base = base.filter((i) => i.brand === brandFilter);
        if (thicknessFilter) base = base.filter((i) => i.thickness === thicknessFilter);
        return base;
    }, [sourceItems, filter, featureFilter, subTypeFilter, brandFilter, thicknessFilter]);

    // 정렬
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

    // 필터 변경 시 첫 페이지로
    useEffect(
        () => setPage(1),
        [filter, sortKey, featureFilter, subTypeFilter, brandFilter, thicknessFilter]
    );

    // 상세 이동 헬퍼
    function goDetail(item) {
        // 현재 목록 엔트리의 state에 스크롤 위치 저장(replace)
        navigate(
            { pathname: location.pathname, search: location.search },
            {
                replace: true,
                state: { gridScrollY: window.scrollY },
            }
        );

        // 상세 페이지로 이동 (state에 item 포함)
        navigate(`/closet_detail?id=${encodeURIComponent(item.id)}`, {
            state: { item },
        });
    }

    // URL search 변경 유틸
    const goWithSearch = (search) =>
        navigate({ pathname: "/closet", search }, { replace: false });

    // ─────────────── NAV ───────────────
    const Nav = h("nav", { id: "nav3", role: "navigation" }, [
        h("a", { href: "/", className: "logo" }, "AI Closet"),
        h(
            "ul",
            null,
            FILTERS.map((f) =>
                h(
                    "li",
                    { key: f },
                    h(
                        "a",
                        {
                            href: "#",
                            className:
                                filter === f &&
                                    !featureFilter &&
                                    !subTypeFilter &&
                                    !brandFilter &&
                                    !thicknessFilter
                                    ? "active"
                                    : undefined,
                            onClick: (e) => {
                                e.preventDefault();
                                setFilter(f);
                                setFeatureFilter(null);
                                setSubTypeFilter(null);
                                setBrandFilter(null);
                                setThicknessFilter(null);
                                goWithSearch(`?type=filter&value=${encodeURIComponent(f)}`);
                            },
                        },
                        `${f} (${counts[f] || 0})`
                    )
                )
            )
        ),
        h(
            "button",
            {
                id: "btnNavUpload",
                className: "nav-upload-btn",
                onClick: () => alert("옷 등록 기능은 준비 중입니다."),
            },
            "옷 등록하기"
        ),
    ]);

    // ─────────────── TOOLBAR ───────────────
    const Toolbar = h("section", { className: "toolbar" }, [
        h(
            "div",
            { className: "left" },
            brandFilter
                ? `홈 / 옷장 / ${brandFilter}`
                : subTypeFilter
                    ? `홈 / 옷장 / ${filter} / ${subTypeFilter}`
                    : featureFilter
                        ? `홈 / 옷장 / #${featureFilter}`
                        : thicknessFilter
                            ? `홈 / 옷장 / 두께감: ${thicknessFilter}`
                            : `홈 / 옷장 / ${filter}`
        ),
        h(
            "div",
            { className: "right" },
            h(
                "select",
                {
                    id: "sortSelect",
                    value: sortKey,
                    onChange: (e) => setSortKey(e.target.value),
                },
                SORT_KEYS.map((k) => h("option", { key: k, value: k }, k))
            )
        ),
    ]);

    // ─────────────── CARD ───────────────
    const Card = (item) =>
        h("article", { key: item.id, className: "pcard" }, [
            // 클릭 가능 영역(이미지 + 타이틀)
            h(
                "div",
                {
                    className: "clickable-area",
                    onClick: () => goDetail(item),
                    role: "button",
                    tabIndex: 0,
                    onKeyDown: (e) => {
                        if (e.key === "Enter" || e.key === " ") goDetail(item);
                    },
                },
                [
                    h(
                        "div",
                        { className: "pthumb" },
                        h("img", {
                            src: item.imageUrl || "/images/placeholder.png",
                            alt: item.name || "의류 이미지",
                            loading: "lazy",
                            decoding: "async",
                            onError: (e) => {
                                const img = e.currentTarget;
                                if (img.dataset.fallbackDone === "1") return; // 1회만
                                img.dataset.fallbackDone = "1";
                                img.src = "/images/placeholder.png";
                            }
                        })

                    ),
                    h("div", { className: "pmeta" }, [
                        h(
                            "div",
                            {
                                className: item.name ? "title" : "title empty-name",
                            },
                            item.name || "—"
                        ),
                    ]),
                ]
            ),

            // 브랜드(필터용) - 카드 클릭 전파 막기
            h(
                "div",
                { className: "brand-row" },
                h(
                    "span",
                    {
                        className: "brand clickable",
                        onClick: (e) => {
                            e.stopPropagation();
                            setBrandFilter(item.brand);
                            goWithSearch(`?type=brand&value=${encodeURIComponent(item.brand)}`);
                        },
                    },
                    item.brand || "브랜드 미지정"
                )
            ),

            // 특징 / 소분류(필터용) - 전파 막기
            h(
                "div",
                { className: "badges" },
                [
                    item.subType
                        ? h(
                            "span",
                            {
                                className: "badge subtype",
                                onClick: (e) => {
                                    e.stopPropagation();
                                    setSubTypeFilter(item.subType);
                                    goWithSearch(`?type=subType&value=${encodeURIComponent(item.subType)}`);
                                },
                            },
                            `#${item.subType}`
                        )
                        : null,
                    ...(item.features || []).map((f, i) =>
                        h(
                            "span",
                            {
                                key: i,
                                className: "badge feature",
                                onClick: (e) => {
                                    e.stopPropagation();
                                    setFeatureFilter(f);
                                    goWithSearch(`?type=feature&value=${encodeURIComponent(f)}`);
                                },
                            },
                            `#${f}`
                        )
                    ),
                ].filter(Boolean)
            ),

            // 두께(필터용) - 전파 막기
            item.thickness
                ? h(
                    "div",
                    { className: "thickness-row" },
                    h(
                        "span",
                        {
                            className: "thickness clickable",
                            onClick: (e) => {
                                e.stopPropagation();
                                setThicknessFilter(item.thickness);
                                goWithSearch(
                                    `?type=thickness&value=${encodeURIComponent(item.thickness)}`
                                );
                            },
                        },
                        `두께감: ${item.thickness}`
                    )
                )
                : null,

            // 색상칩(표시만)
            h(
                "div",
                { className: "colors" },
                (item.colors || []).map((c, idx) =>
                    h("span", { key: idx, className: "cchip", style: { background: c }, title: c })
                )
            ),
        ]);

    // ─────────────── 본문 / 페이지 ───────────────
    const GridOrEmpty =
        sorted.length > 0
            ? h("section", { id: "productGrid", className: "product-grid" }, paged.map(Card))
            : h(
                "p",
                { className: "empty-hint" },
                loading ? "불러오는 중…" : loadErr || "불러온 옷이 없습니다."
            );

    const Pager =
        sorted.length > 0
            ? h("footer", { className: "pager" }, [
                h(
                    "button",
                    {
                        disabled: pageSafe <= 1,
                        onClick: () => setPage((p) => Math.max(1, p - 1)),
                    },
                    "이전"
                ),
                h("span", { className: "page-info" }, `${pageSafe} / ${totalPages}`),
                h(
                    "button",
                    {
                        disabled: pageSafe >= totalPages,
                        onClick: () => setPage((p) => Math.min(totalPages, p + 1)),
                    },
                    "다음"
                ),
            ])
            : null;

    // ─────────────── 렌더링 ───────────────
    return h("div", { className: "closet-page" }, [
        Nav,
        h("main", { className: "closet-container" }, [Toolbar, GridOrEmpty, Pager]),
    ]);
}