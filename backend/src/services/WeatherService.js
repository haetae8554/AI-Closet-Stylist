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

// 파일 경로 (읽기 전용인 regions.json만 유지)
// 주의: 배포 시 data/regions.json 파일이 깃허브에 올라가 있어야 합니다!
const REGION_JSON_PATH = path.resolve(__dirname, "../../data/regions.json");

// 캐시 설정
const LAND_TTL_MS = 3 * 60 * 60 * 1000;
const LAND_FCST_BASE = "https://apihub.kma.go.kr/api/typ01/url/fct_afs_dl.php";
const WARN_BASE = "https://apihub.kma.go.kr/api/typ01/url/wrn_reg.php";
const LAND_COLS = [
  "REG_ID", "TM_FC", "TM_EF", "MOD", "NE", "STN", "C", "MAN_ID",
  "MAN_FC", "W1", "T", "W2", "TA", "ST", "SKY", "PREP", "WF",
];
const BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23];

// [변경] 파일 대신 메모리(변수)에 캐시 저장
// 서버가 꺼지면 사라지지만, 어차피 무료 서버 파일도 사라지므로 성능상 이득입니다.
let landCache = {
    lastUpdated: null,
    regions: {}
};

let regionMeta = null;
let schedulerStarted = false;

// 숫자 두 자리
function pad2(n) {
  return n < 10 ? "0" + n : String(n);
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

  // 무료 플랜 사용 시 http 요청 제한이 있을 수 있으니 예외처리 필요
  try {
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
  } catch (e) {
      console.error("IP 위치 조회 실패:", e);
      return { ...DEFAULT_LOCATION, ip };
  }
}

// regions.json 로드 (파일 읽기)
function loadRegionMeta() {
  if (regionMeta) return;

  // 배포 환경에서 파일이 없는 경우를 대비
  if (!fs.existsSync(REGION_JSON_PATH)) {
    console.error("regions.json 파일 없음 - GitHub에 data 폴더가 올라갔는지 확인하세요.");
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

// 단기예보 API 호출
async function fetchLandFcst(regId) {
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

  return { regId, items, raw: parsed.raw };
}

// [변경] 파일 캐시 함수 삭제 (loadLandCacheFromFile, saveLandCacheToFile)
// 대신 메모리 변수 landCache를 직접 사용

// regId 기준 단기예보 조회 (메모리 캐시 사용)
async function getLandFcstByRegId(regId) {
  const now = Date.now();
  
  // 메모리 캐시 확인
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

  // API 호출
  const data = await fetchLandFcst(regId);
  const info = getRegionInfoByRegId(regId);

  const regionEntry = {
    regId,
    name: info?.name || "",
    updatedAt: now,
    items: data.items,
  };

  // 메모리에 저장
  if (!landCache.regions) landCache.regions = {};
  landCache.regions[regId] = regionEntry;
  landCache.lastUpdated = now;

  return regionEntry;
}

// 특보 조회
export async function getWarn() {
  // 특보는 실시간성이 중요하므로 캐시 없이 호출하거나 짧은 캐시 적용
  // 여기서는 기존 로직대로 매번 호출
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

  console.log("[KMA] 스케줄러 초기 캐시 로딩 (메모리)");

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