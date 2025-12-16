// backend/src/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

// 서비스 모듈
import { getRecommendations } from "./services/geminiService.js";
import { getWeatherByRequest, startWeatherScheduler } from "./services/WeatherService.js";
import { getCalendarEvents, saveCalendarEvents } from "./services/CalendarService.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 1. 미들웨어
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

// 2. Multer 설정
const UPLOAD_DIR = path.join(__dirname, "..", "public", "images", "cloths");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, "cloth-" + Date.now() + ext);
  },
});
const upload = multer({ storage: storage });

// 3. 부트 로그 및 스케줄러
console.log("===========================================");
console.log("[Backend Boot] AI Closet Stylist Server");
startWeatherScheduler();

// ==========================================
// [API Routes]
// ==========================================

app.get("/", (_req, res) => {
  res.json({ status: "ok", features: ["Gemini", "Weather", "Calendar"], time: new Date().toISOString() });
});

// 1) AI 추천 (핵심 수정됨)
app.post("/api/recommend", async (req, res) => {
  console.log("[BACKLOG] POST /api/recommend");
  try {
    // period 정보 수신
    const { clothes = [], selected = {}, period = {} } = req.body;
    
    // getRecommendations에 req 전체를 넘겨야 IP/Query(lat,lon) 확인 가능
    const recs = await getRecommendations(req, selected, clothes, period);
    
    res.json({ recommendations: recs });
  } catch (e) {
    console.error("[ERROR] recommend:", e);
    res.status(500).json({ error: e.message });
  }
});

// 2) 날씨
app.get("/api/weather/current", async (req, res) => {
  try {
    const result = await getWeatherByRequest(req);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: "날씨 정보를 가져오지 못했습니다." });
  }
});

// 3) 캘린더
app.get("/api/calendar", async (req, res) => {
  try {
    const events = await getCalendarEvents();
    res.json(events);
  } catch (e) {
    res.status(500).json({ error: "일정 로드 실패" });
  }
});

app.post("/api/calendar", async (req, res) => {
  try {
    const events = req.body;
    await saveCalendarEvents(events);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "일정 저장 실패" });
  }
});

// 4) 옷 목록 및 업로드
app.get("/api/clothes", (req, res) => {
  const filePath = path.join(__dirname, "../data", "clothes.json");
  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) return res.json([]); 
    res.json(JSON.parse(data));
  });
});

app.post("/api/clothes/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image" });
  
  const { name, type, brand, colors, features } = req.body;
  const imageUrl = `/images/cloths/${req.file.filename}`;
  const filePath = path.join(__dirname, "../data", "clothes.json");
  
  try {
    let clothes = [];
    if (fs.existsSync(filePath)) clothes = JSON.parse(fs.readFileSync(filePath, "utf8"));
    
    const newCloth = {
      id: Date.now().toString(),
      name, type, brand: brand || "",
      colors: typeof colors === 'string' ? colors.split(',') : [],
      features: typeof features === 'string' ? features.split(',') : [],
      imageUrl, createdAt: new Date().toISOString()
    };
    
    clothes.unshift(newCloth);
    fs.writeFileSync(filePath, JSON.stringify(clothes, null, 4), "utf8");
    res.json({ success: true, cloth: newCloth });
  } catch (e) {
    res.status(500).json({ error: "Upload failed" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[server] running on http://localhost:${PORT}`));