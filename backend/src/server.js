// backend/src/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

// ---------------------------------------------------
// [서비스 모듈 임포트]
// ---------------------------------------------------
import { getRecommendations } from "./services/geminiService.js";
import {
  getWeatherByRequest,
  startWeatherScheduler,
} from "./services/WeatherService.js";

// [NEW] 캘린더 서비스 추가 (이 부분이 꼭 있어야 합니다!)
import { 
  getCalendarEvents, 
  saveCalendarEvents 
} from "./services/CalendarService.js";

dotenv.config();

// __dirname 설정 (ES Module 환경)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ==========================================
// 1. 미들웨어 설정
// ==========================================
app.use(cors());
app.use(express.json({ limit: "10mb" })); // 이미지/JSON 데이터 용량 넉넉히
app.use(express.static(path.join(__dirname, "..", "public"))); // 정적 파일 제공

// ==========================================
// 2. 파일 업로드 폴더 및 Multer 설정
// ==========================================
const UPLOAD_DIR = path.join(__dirname, "..", "public", "images", "cloths");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    // 파일명 중복 방지를 위해 타임스탬프 추가
    cb(null, "cloth-" + Date.now() + ext);
  },
});
const upload = multer({ storage: storage });

// ==========================================
// 3. 서버 부트 로그
// ==========================================
console.log("===========================================");
console.log("[Backend Boot] AI Closet Stylist Server");
console.log(`- NODE_ENV: ${process.env.NODE_ENV || "development"}`);
console.log(
  `- Gemini API 연결 상태: ${process.env.GEMINI_API_KEY ? "OK" : "없음"}`
);
console.log(
  `- KMA API Key: ${process.env.KMA_API_KEY ? "OK" : "없음"}`
);
console.log(`- Local Storage: ${UPLOAD_DIR}`);
console.log(`- Server Time: ${new Date().toLocaleString("ko-KR")}`);
console.log("===========================================\n");

// 4. 스케줄러 실행 (서버 시작 시 날씨 캐싱 시작)
startWeatherScheduler();

// ==========================================
// [API Routes]
// ==========================================

// [기본] 상태 체크
app.get("/", (_req, res) => {
  console.log("[BACKLOG] GET / 호출됨");
  res.json({
    status: "ok",
    service: "AI Closet Stylist Backend (Unified)",
    features: ["Gemini", "Weather", "Local JSON DB", "File Upload", "Calendar"],
    time: new Date().toISOString(),
  });
});

// ------------------------------------------
// 1) 제미나이 추천
// ------------------------------------------
app.post("/api/recommend", async (req, res) => {
  console.log("[BACKLOG] POST /api/recommend 요청 도착");
  try {
    const { clothes = [], selected = {} } = req.body;
    
    // req 객체를 전달하여 IP 기반 위치 정보 활용
    const recs = await getRecommendations(req, selected, clothes);
    
    res.json({ recommendations: recs });
  } catch (e) {
    console.error("[ERROR] recommend:", e);
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------------------
// 2) 날씨 정보 (IP 기반 -> 기상청)
// ------------------------------------------
app.get("/api/weather/current", async (req, res) => {
  // console.log("[BACKLOG] GET /api/weather/current 요청 도착");
  try {
    const result = await getWeatherByRequest(req);
    res.json(result);
  } catch (e) {
    console.error("[ERROR] weather:", e);
    res.status(500).json({ error: "날씨 정보를 가져오지 못했습니다." });
  }
});

// ------------------------------------------
// 3) 캘린더 일정 관리 (NEW - 추가된 부분)
// ------------------------------------------

// [GET] 일정 불러오기
app.get("/api/calendar", async (req, res) => {
  try {
    const events = await getCalendarEvents();
    res.json(events);
  } catch (e) {
    console.error("[ERROR] Calendar Load:", e);
    res.status(500).json({ error: "일정을 불러오지 못했습니다." });
  }
});

// [POST] 일정 저장하기 (전체 동기화)
app.post("/api/calendar", async (req, res) => {
  try {
    const events = req.body;
    
    // 데이터 유효성 체크
    if (!events || typeof events !== 'object') {
       return res.status(400).json({ error: "잘못된 데이터 형식입니다." });
    }

    await saveCalendarEvents(events);
    console.log("[Calendar] 일정 업데이트 완료");
    res.json({ success: true, message: "일정이 저장되었습니다." });
  } catch (e) {
    console.error("[ERROR] Calendar Save:", e);
    res.status(500).json({ error: "일정을 저장하지 못했습니다." });
  }
});


// ------------------------------------------
// 4) 옷 목록 조회 (Local JSON)
// ------------------------------------------
app.get("/api/clothes", (req, res) => {
  const filePath = path.join(__dirname, "../data", "clothes.json");

  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      console.error("파일 읽기 에러:", err);
      if (err.code === "ENOENT") {
        return res
          .status(404)
          .json({ error: "clothes.json 파일을 찾을 수 없습니다." });
      }
      return res.status(500).json({ error: "데이터를 읽을 수 없습니다." });
    }
    res.json(JSON.parse(data));
  });
});

// ------------------------------------------
// 5) 옷 등록 및 이미지 업로드
// ------------------------------------------
app.post("/api/clothes/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "이미지 파일이 누락되었습니다." });
  }

  const { name, type, brand, subType, thickness, colors, features } = req.body;
  const imageUrl = `/images/cloths/${req.file.filename}`;

  // 유효성 검사
  if (!name || !type || !["아우터", "상의", "하의", "신발"].includes(type)) {
    // 실패 시 업로드된 파일 삭제
    fs.unlinkSync(req.file.path);
    return res
      .status(400)
      .json({ error: "옷 이름이나 분류가 유효하지 않습니다." });
  }

  const filePath = path.join(__dirname, "../data", "clothes.json");

  try {
    let clothes = [];
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf8");
      clothes = JSON.parse(data);
    }

    const stringToArray = (str) => {
      if (typeof str !== "string") return [];
      return str.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
    };

    const newCloth = {
      id: Date.now().toString(),
      name: name,
      type: type,
      brand: brand || "브랜드 미지정",
      subType: subType || "",
      colors: stringToArray(colors),
      thickness: thickness || "",
      features: stringToArray(features),
      imageUrl: imageUrl,
      createdAt: new Date().toISOString(),
    };

    clothes.unshift(newCloth);
    
    fs.writeFileSync(filePath, JSON.stringify(clothes, null, 4), "utf8");

    console.log(`[UPLOAD] 신규 옷 등록 완료: ${name} (${type})`);
    res.json({ success: true, cloth: newCloth });
  } catch (err) {
    console.error("데이터 저장 실패:", err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      error: "데이터베이스 업데이트에 실패했습니다.",
    });
  }
});

// ==========================================
// [Server Start]
// ==========================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
  console.log("[BACKLOG] Server Startup Completed\n");
});