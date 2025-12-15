// backend/src/services/WeatherService.js

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// 환경 변수
const KMA_KEY = process.env.KMA_API_KEY;
const GEO_API_BASE = "http://ip-api.com/json/";

// 기본 위치
const DEFAULT_LOCATION = {
  ip: "-",
  country: "Korea",
  region: "Seoul",
  city: "Seoul",
  lat: 37.5665,
  lon: 126.978,
};

// 예보 구역 기본값
const DEFAULT_REG_ID = "11B10101";

// 파일 경로
const REGION_JSON_PATH = path.resolve(__dirname, "../../data/regions.json");
const KMA_DATA_DIR = path.resolve(__dirname, "../../data/kma");
const LAND_FCST_CACHE_PATH = path.join(KMA_DATA_DIR, "land_fcst.json");

// 캐시 설정
const LAND_TTL_MS = 3 * 60 * 60 * 1000;
const LAND_FCST_BASE = "https://apihub.kma.go.kr/api/typ01/url/fct_afs_dl.php";
const WARN_BASE = "https://apihub.kma.go.kr/api/typ01/url/wrn_reg.php";
const LAND_COLS = [
  "REG_ID",
  "TM_FC",
  "TM_EF",
  "MOD",
  "NE",
  "STN",
  "C",
  "MAN_ID",
  "MAN_FC",
  "W1",
  "T",
  "W2",
  "TA",
  "ST",
  "SKY",
  "PREP",
  "WF",
];
const BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23];

let landCache = null;
let regionMeta = null;
let schedulerStarted = false;

// 디렉터리 생성
if (!fs.existsSync(KMA_DATA_DIR)) {
  fs.mkdirSync(KMA_DATA_DIR, { recursive: true });
}

// 숫자 두 자리
function pad2(n) {
  return n < 10 ? "0" + n : String(n);
}

// 날짜 포맷
function fmtDateTime(d, withMin = true) {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const h = pad2(d.getHours());
  if (!withMin) return `${y}${m}${day}${h}`;
  const min = pad2(d.getMinutes());
  return `${y}${m}${day}${h}${min}`;
}

// 최신 단기예보 기준시각 계산
function getLatestLandFcstTime() {
  const d = new Date();
  const h = d.getHours();

  let hour = 0;

  if (h < BASE_HOURS[0]) {
    d.setDate(d.getDate() - 1);
    hour = 23;
  } else {
    hour = BASE_HOURS.filter((bh) => bh <= h).pop();
  }

  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}${m}${day}${pad2(hour)}`;
}

// 응답 파싱
async function parseRes(res) {
  if (!res.ok) {
    throw new Error("기상청 응답 코드 오류: " + res.status);
  }

  const ct = res.headers.get("content-type") || "";

  // JSON 응답
  if (ct.includes("application/json")) {
    const j = await res.json();
    return { type: "json", data: j };
  }

  // 텍스트 응답
  const buf = await res.arrayBuffer();
  const isEucKr = /euc-kr|ks_c_5601/i.test(ct);
  const dec = new TextDecoder(isEucKr ? "euc-kr" : "utf-8");
  const txt = dec.decode(buf);

  const lines = txt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  return { type: "text", lines, raw: txt };
}

// 공통 호출
async function fetchKma(tag, url, opts) {
  try {
    const res = await fetch(url, opts);
    return await parseRes(res);
  } catch (e) {
    console.error("[KMA]", tag, "호출 오류", e);
    throw e;
  }
}

// 클라이언트 IP 추출
function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) {
    const ip = xff.split(",")[0].trim();
    if (ip) return ip.replace(/^::ffff:/, "");
  }

  const ip =
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.connection?.socket?.remoteAddress ||
    null;

  if (!ip) return null;
  return String(ip).replace(/^::ffff:/, "");
}

// 사설 IP 검사
function isLocalOrPrivateIp(ip) {
  if (!ip) return true;
  const v = ip.trim();
  if (v === "127.0.0.1" || v === "::1") return true;
  if (v.startsWith("10.")) return true;
  if (v.startsWith("192.168.")) return true;
  if (v.startsWith("172.")) {
    const n = Number(v.split(".")[1] || 0);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

// IP로 위치 조회
export async function getLocationFromRequest(req) {
  const rawIp = getClientIp(req);
  const ip = isLocalOrPrivateIp(rawIp) ? null : rawIp;

  if (!ip) {
    return {
      ...DEFAULT_LOCATION,
      ip: rawIp || DEFAULT_LOCATION.ip,
    };
  }

  const url = `${GEO_API_BASE}${ip}?fields=status,country,regionName,city,lat,lon,query`;

  const res = await fetch(url);
  if (!res.ok) {
    return { ...DEFAULT_LOCATION, ip };
  }

  const data = await res.json();
  if (data.status !== "success") {
    return { ...DEFAULT_LOCATION, ip };
  }

  return {
    ip: data.query,
    country: data.country,
    region: data.regionName,
    city: data.city,
    lat: data.lat,
    lon: data.lon,
  };
}

// regions.json 로드
function loadRegionMeta() {
  if (regionMeta) return;

  if (!fs.existsSync(REGION_JSON_PATH)) {
    console.error("regions.json 파일 없음");
    regionMeta = {
      defaultRegId: DEFAULT_REG_ID,
      cityToRegId: {},
      regionToRegId: {},
      regions: [],
    };
    return;
  }

  try {
    const txt = fs.readFileSync(REGION_JSON_PATH, "utf8");
    const j = JSON.parse(txt);
    regionMeta = {
      defaultRegId: j.defaultRegId || DEFAULT_REG_ID,
      cityToRegId: j.cityToRegId || {},
      regionToRegId: j.regionToRegId || {},
      regions: Array.isArray(j.regions) ? j.regions : [],
    };
  } catch (e) {
    console.error("regions.json 로드 실패", e);
    regionMeta = {
      defaultRegId: DEFAULT_REG_ID,
      cityToRegId: {},
      regionToRegId: {},
      regions: [],
    };
  }
}

// regId로 지역 정보 조회
function getRegionInfoByRegId(regId) {
  loadRegionMeta();
  if (!regionMeta || !Array.isArray(regionMeta.regions)) return null;
  const idStr = String(regId);
  return regionMeta.regions.find((r) => String(r.regId) === idStr) || null;
}

// 위치로 regId 찾기
function resolveRegIdFromLocation(loc) {
  loadRegionMeta();

  const city = String(loc?.city || "").trim();
  const region = String(loc?.region || "").trim();

  const ct = regionMeta.cityToRegId || {};
  const rt = regionMeta.regionToRegId || {};
  const list = regionMeta.regions || [];
  const fallback = regionMeta.defaultRegId || DEFAULT_REG_ID;

  let regId = null;

  if (city && ct[city]) regId = ct[city];
  if (!regId && region && city && rt[`${region} ${city}`]) regId = rt[`${region} ${city}`];
  if (!regId && region && rt[region]) regId = rt[region];
  if (!regId && city) {
    const f = list.find((r) => r.name === city);
    if (f) regId = f.regId;
  }

  if (!regId) regId = fallback;

  return regId;
}

// 단기예보 조회
async function fetchLandFcst(regId) {
  // 필요하면 tmfc 사용 가능
  getLatestLandFcstTime();

  const params = new URLSearchParams({
    reg: regId,
    disp: "0",
    help: "0",
    authKey: KMA_KEY,
  });

  const url = `${LAND_FCST_BASE}?${params.toString()}`;
  console.log("[KMA] land 요청", url);

  const res = await fetch(url);
  if (!res.ok) {
    console.error("[KMA] land HTTP 오류", res.status);
    return { items: [] };
  }

  const parsed = await parseRes(res);

  const items = [];

  for (const line of parsed.lines) {
    const parts = line.split(/\s+/);
    if (parts.length < LAND_COLS.length) continue;

    const o = {};
    for (let i = 0; i < LAND_COLS.length; i++) {
      const key = LAND_COLS[i];
      if (key === "WF") {
        o[key] = parts.slice(i).join(" ").replace(/^"|"$/g, "");
        break;
      } else {
        o[key] = (parts[i] ?? "").trim().replace(/^"|"$/g, "");
      }
    }
    items.push(o);
  }

  console.log("[KMA] land 파싱 개수", items.length);
  return { regId, items, raw: parsed.raw };
}

// 캐시 로드
function loadLandCacheFromFile() {
  if (landCache) return;
  if (!fs.existsSync(LAND_FCST_CACHE_PATH)) {
    landCache = { lastUpdated: null, regions: {} };
    return;
  }

  try {
    const txt = fs.readFileSync(LAND_FCST_CACHE_PATH, "utf8");
    const j = JSON.parse(txt);
    landCache = {
      lastUpdated: j.lastUpdated ?? null,
      regions: j.regions ?? {},
    };
  } catch (e) {
    console.error("[KMA] land 캐시 로드 실패", e);
    landCache = { lastUpdated: null, regions: {} };
  }
}

// 캐시 저장
function saveLandCacheToFile() {
  if (!landCache) return;
  try {
    fs.writeFileSync(
      LAND_FCST_CACHE_PATH,
      JSON.stringify(landCache, null, 2),
      "utf8"
    );
  } catch (e) {
    console.error("[KMA] land 캐시 저장 실패", e);
  }
}

// regId 기준 단기예보 조회
async function getLandFcstByRegId(regId) {
  const now = Date.now();
  loadLandCacheFromFile();

  const cached = landCache.regions?.[regId];

  if (
    cached &&
    cached.updatedAt &&
    now - cached.updatedAt < LAND_TTL_MS &&
    Array.isArray(cached.items) &&
    cached.items.length > 0
  ) {
    return cached;
  }

  const data = await fetchLandFcst(regId);
  const info = getRegionInfoByRegId(regId);

  const regionEntry = {
    regId,
    name: info?.name || "",
    updatedAt: now,
    items: data.items,
  };

  landCache.regions[regId] = regionEntry;
  landCache.lastUpdated = now;
  saveLandCacheToFile();

  return regionEntry;
}

// 특보 조회
export async function getWarn() {
  const url = `${WARN_BASE}?tmfc=0&authKey=${KMA_KEY}`;
  const parsed = await fetchKma("warn", url);
  return { data: parsed };
}

// 옷 추천용 날씨 묶음
export async function getClothesWeatherByLocation(loc) {
  loadRegionMeta();

  const regId = resolveRegIdFromLocation(loc);
  const regionInfo = getRegionInfoByRegId(regId);
  const cityName = regionInfo?.name || loc.city || "";

  const [land, warn] = await Promise.all([
    getLandFcstByRegId(regId),
    getWarn(),
  ]);

  return {
    location: {
      ip: loc.ip,
      city: cityName,
      lat: loc.lat,
      lon: loc.lon,
    },
    regId,
    regionName: cityName,
    region: regionInfo,
    landFcst: land,
    warn,
    regionMeta,
  };
}

// 요청 처리
export async function getWeatherByRequest(req) {
  const qLat = req.query?.lat;
  const qLon = req.query?.lon;

  let loc;
  if (
    qLat != null &&
    qLon != null &&
    !Number.isNaN(Number(qLat)) &&
    !Number.isNaN(Number(qLon))
  ) {
    loc = {
      ip: null,
      country: "Korea",
      region: "",
      city: "선택 위치",
      lat: Number(qLat),
      lon: Number(qLon),
    };
  } else {
    loc = await getLocationFromRequest(req);
  }

  const cw = await getClothesWeatherByLocation(loc);
  return cw;
}

// 스케줄러
export function startWeatherScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  loadRegionMeta();

  console.log("[KMA] 스케줄러 초기 캐시 로딩");

  (async () => {
    try {
      await getLandFcstByRegId(DEFAULT_REG_ID);
      console.log("[KMA] 서울 캐시 초기 로딩 완료");
    } catch (e) {
      console.error("[KMA] 서울 캐시 초기 로딩 실패", e);
    }
  })();

  setInterval(() => {
    console.log("[KMA] 서울 캐시 갱신");
    getLandFcstByRegId(DEFAULT_REG_ID).catch((e) =>
      console.error("[KMA] 서울 캐시 갱신 실패", e)
    );
  }, LAND_TTL_MS);

  console.log("[KMA] 스케줄러 시작");
}