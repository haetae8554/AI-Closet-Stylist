import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./closet.css";

const h = React.createElement;
const FILTERS = ["전체", "상의", "아우터", "하의", "신발"];
const SORT_KEYS = ["정렬: 최신순", "정렬: 이름"];

function normalizeItem(raw, idx = 0) {
    const id = String(raw?.id ?? Date.now() + "-" + idx);
    const type = String(raw?.type ?? "").trim();
    const subType = String(raw?.subType ?? "").trim();
    const brand = String(raw?.brand ?? "").trim();
    const nameRaw = (raw?.name ?? "").trim();
    const name =
        nameRaw ||
        (brand && subType ? `${brand} ${subType}` : brand || subType || "");
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

function restoreFromURL(search, setters) {
    const params = new URLSearchParams(search);
    const type = params.get("type");
    const value = params.get("value");
    if (!type || !value) return;

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

export default function Closet() {
    const navigate = useNavigate();
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

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                setLoadErr("");
                const res = await fetch("http://localhost:3001/api/clothes");
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const normalized = (Array.isArray(data) ? data : []).map(
                    normalizeItem
                );
                setSourceItems(normalized);
            } catch (e) {
                console.error(e);
                setLoadErr("데이터 로드 실패");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    useEffect(() => {
        const onPop = () => {
            setFeatureFilter(null);
            setSubTypeFilter(null);
            setBrandFilter(null);
            setThicknessFilter(null);
            setFilter("전체");

            setTimeout(() => {
                restoreFromURL(window.location.search, {
                    setFeatureFilter,
                    setSubTypeFilter,
                    setBrandFilter,
                    setThicknessFilter,
                    setFilter,
                });
            }, 10);
        };

        window.addEventListener("popstate", onPop);

        restoreFromURL(window.location.search, {
            setFeatureFilter,
            setSubTypeFilter,
            setBrandFilter,
            setThicknessFilter,
            setFilter,
        });

        return () => window.removeEventListener("popstate", onPop);
    }, []);

    const counts = useMemo(() => {
        const map = { 전체: sourceItems.length };
        for (const t of FILTERS.slice(1))
            map[t] = sourceItems.filter((i) => i.type === t).length;
        return map;
    }, [sourceItems]);

    const filtered = useMemo(() => {
        let base = sourceItems;
        if (filter !== "전체") base = base.filter((i) => i.type === filter);
        if (featureFilter)
            base = base.filter((i) => i.features.includes(featureFilter));
        if (subTypeFilter)
            base = base.filter((i) => i.subType === subTypeFilter);
        if (brandFilter) base = base.filter((i) => i.brand === brandFilter);
        if (thicknessFilter)
            base = base.filter((i) => i.thickness === thicknessFilter);
        return base;
    }, [
        sourceItems,
        filter,
        featureFilter,
        subTypeFilter,
        brandFilter,
        thicknessFilter,
    ]);

    const sorted = useMemo(() => {
        const arr = [...filtered];
        const map = {
            "정렬: 최신순": (a, b) =>
                new Date(b.createdAt) - new Date(a.createdAt),
            "정렬: 이름": (a, b) =>
                String(a.name || "").localeCompare(String(b.name || ""), "ko"),
        };
        arr.sort(map[sortKey] || map["정렬: 최신순"]);
        return arr;
    }, [filtered, sortKey]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const pageSafe = Math.min(Math.max(1, page), totalPages);
    const paged = useMemo(() => {
        const start = (pageSafe - 1) * pageSize;
        return sorted.slice(start, start + pageSize);
    }, [sorted, pageSafe]);

    useEffect(
        () => setPage(1),
        [
            filter,
            sortKey,
            featureFilter,
            subTypeFilter,
            brandFilter,
            thicknessFilter,
        ]
    );

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
                                window.history.pushState(
                                    {},
                                    "",
                                    `?type=filter&value=${encodeURIComponent(
                                        f
                                    )}`
                                );
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
                onClick: () => navigate("/closet/upload"),
            },
            "옷 등록하기"
        ),
    ]);

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

    const Card = (item) =>
        h("article", { key: item.id, className: "pcard" }, [
            h(
                "div",
                { className: "pthumb" },
                h("img", {
                    src: item.imageUrl,
                    alt: item.name || "의류 이미지",
                    loading: "lazy",
                    onError: (e) => {
                        e.target.src = "/images/placeholder.png";
                    },
                })
            ),
            h("div", { className: "pmeta" }, [
                h(
                    "div",
                    {
                        className: "brand clickable",
                        onClick: () => {
                            setBrandFilter(item.brand);
                            window.history.pushState(
                                {},
                                "",
                                `?type=brand&value=${encodeURIComponent(
                                    item.brand
                                )}`
                            );
                        },
                    },
                    item.brand || "브랜드 미지정"
                ),
                h(
                    "div",
                    {
                        className: item.name ? "title" : "title empty-name",
                    },
                    item.name || "—"
                ),
            ]),

            h(
                "div",
                { className: "badges" },
                [
                    item.subType
                        ? h(
                              "span",
                              {
                                  className: "badge subtype",
                                  onClick: () => {
                                      setSubTypeFilter(item.subType);
                                      window.history.pushState(
                                          {},
                                          "",
                                          `?type=subType&value=${encodeURIComponent(
                                              item.subType
                                          )}`
                                      );
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
                                onClick: () => {
                                    setFeatureFilter(f);
                                    window.history.pushState(
                                        {},
                                        "",
                                        `?type=feature&value=${encodeURIComponent(
                                            f
                                        )}`
                                    );
                                },
                            },
                            `#${f}`
                        )
                    ),
                ].filter(Boolean)
            ),

            item.thickness
                ? h(
                      "div",
                      { className: "thickness-row" },
                      h(
                          "span",
                          {
                              className: "thickness clickable",
                              onClick: () => {
                                  setThicknessFilter(item.thickness);
                                  window.history.pushState(
                                      {},
                                      "",
                                      `?type=thickness&value=${encodeURIComponent(
                                          item.thickness
                                      )}`
                                  );
                              },
                          },
                          `두께감: ${item.thickness}`
                      )
                  )
                : null,

            h(
                "div",
                { className: "colors" },
                (item.colors || []).map((c, idx) =>
                    h("span", {
                        key: idx,
                        className: "cchip",
                        style: { background: c },
                        title: c,
                    })
                )
            ),
        ]);

    const GridOrEmpty =
        sorted.length > 0
            ? h(
                  "section",
                  { id: "productGrid", className: "product-grid" },
                  paged.map(Card)
              )
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
                  h(
                      "span",
                      { className: "page-info" },
                      `${pageSafe} / ${totalPages}`
                  ),
                  h(
                      "button",
                      {
                          disabled: pageSafe >= totalPages,
                          onClick: () =>
                              setPage((p) => Math.min(totalPages, p + 1)),
                      },
                      "다음"
                  ),
              ])
            : null;

    return h("div", { className: "closet-page" }, [
        Nav,
        h("main", { className: "closet-container" }, [
            Toolbar,
            GridOrEmpty,
            Pager,
        ]),
    ]);
}
