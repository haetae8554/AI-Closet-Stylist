import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

// 서비스 모듈 임포트
import { getRecommendations } from "./services/geminiService.js";
import {
  getWeatherByRequest,
  startWeatherScheduler,
} from "./services/WeatherService.js";

import { 
  getCalendarEvents, 
  saveCalendarEvents 
} from "./services/CalendarService.js";

dotenv.config();

// ES Module 환경 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 미들웨어 설정
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

// 파일 업로드 폴더 설정
const UPLOAD_DIR = path.join(__dirname, "..", "public", "images", "cloths");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 추천 데이터 저장 폴더 설정
const DATA_DIR = path.join(__dirname, "../data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const REC_FILE_PATH = path.join(DATA_DIR, "recommendations.json");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, "cloth-" + Date.now() + ext);
  },
});
const upload = multer({ storage: storage });

// 서버 부트 로그
console.log("===========================================");
console.log("[Backend Boot] AI Closet Stylist Server");
console.log(`- NODE_ENV: ${process.env.NODE_ENV || "development"}`);
console.log(`- Local Storage: ${UPLOAD_DIR}`);
console.log("===========================================\n");

// 스케줄러 실행
startWeatherScheduler();

// API Routes

// 기본 상태 체크
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "AI Closet Stylist Backend",
    time: new Date().toISOString(),
  });
});

// 1) 제미나이 추천 및 데이터 저장
app.post("/api/recommend", async (req, res) => {
  try {
    const { clothes = [], selected = {}, period } = req.body;
    
    // 제미나이 서비스 호출
    const recs = await getRecommendations(req, selected, clothes, period);
    
    // 데이터 저장 로직 수행
    saveRecommendationsToFile(recs, period);

    res.json({ success: true, message: "추천 완료 및 저장됨" });
  } catch (e) {
    console.error("추천 생성 중 오류:", e);
    res.status(500).json({ error: e.message });
  }
});

// 추천 결과 조회 (Frontend에서 호출)
app.get("/api/recommend/result", (req, res) => {
  try {
    const { date } = req.query; // 조회할 날짜 (YYYY-MM-DD)
    
    if (!fs.existsSync(REC_FILE_PATH)) {
      return res.json([]); 
    }

    const fileData = fs.readFileSync(REC_FILE_PATH, "utf8");
    const allData = JSON.parse(fileData);

    // 특정 날짜 요청 시 해당 날짜 데이터 반환, 없으면 빈 배열
    const targetDate = date || new Date().toISOString().split('T')[0];
    const result = allData[targetDate] || [];

    res.json(result);
  } catch (e) {
    console.error("추천 결과 조회 오류:", e);
    res.status(500).json({ error: "데이터를 불러오지 못했습니다." });
  }
});

// 추천 데이터 저장 헬퍼 함수
function saveRecommendationsToFile(recs, period) {
  try {
    let allData = {};
    if (fs.existsSync(REC_FILE_PATH)) {
      const existing = fs.readFileSync(REC_FILE_PATH, "utf8");
      allData = JSON.parse(existing);
    }

    const startDate = period?.start ? new Date(period.start) : new Date();
    const endDate = period?.end ? new Date(period.end) : new Date();
    
    // 날짜 포맷팅 함수 (YYYY-MM-DD)
    const formatDate = (d) => d.toISOString().split('T')[0];

    // 단일 날짜 요청 여부 확인
    const isSingleDay = formatDate(startDate) === formatDate(endDate);

    if (isSingleDay) {
      // 단일 날짜는 해당 날짜 키에 전체 배열(옵션 3개)을 덮어씀
      const key = formatDate(startDate);
      allData[key] = recs;
    } else {
      // 다중 날짜는 날짜별로 하나씩 매핑하여 덮어씀
      let currentDate = new Date(startDate);
      recs.forEach((rec) => {
        if (currentDate <= endDate) {
          const key = formatDate(currentDate);
          // 다중 날짜 요청일 경우 배열로 감싸서 저장 통일성 유지
          allData[key] = [rec]; 
          currentDate.setDate(currentDate.getDate() + 1);
        }
      });
    }

    fs.writeFileSync(REC_FILE_PATH, JSON.stringify(allData, null, 2), "utf8");
    console.log("추천 데이터 파일 저장 완료");
  } catch (err) {
    console.error("파일 저장 실패:", err);
  }
}

// 2) 날씨 정보
app.get("/api/weather/current", async (req, res) => {
  try {
    const result = await getWeatherByRequest(req);
    res.json(result);
  } catch (e) {
    console.error("날씨 조회 오류:", e);
    res.status(500).json({ error: "날씨 정보를 가져오지 못했습니다." });
  }
});

// 3) 캘린더 일정 관리
app.get("/api/calendar", async (req, res) => {
  try {
    const events = await getCalendarEvents();
    res.json(events);
  } catch (e) {
    console.error("캘린더 로드 오류:", e);
    res.status(500).json({ error: "일정을 불러오지 못했습니다." });
  }
});

app.post("/api/calendar", async (req, res) => {
  try {
    const events = req.body;
    if (!events || typeof events !== 'object') {
       return res.status(400).json({ error: "잘못된 데이터 형식입니다." });
    }
    await saveCalendarEvents(events);
    res.json({ success: true, message: "일정이 저장되었습니다." });
  } catch (e) {
    console.error("캘린더 저장 오류:", e);
    res.status(500).json({ error: "일정을 저장하지 못했습니다." });
  }
});

// 4) 옷 목록 조회
app.get("/api/clothes", (req, res) => {
  const filePath = path.join(__dirname, "../data", "clothes.json");

  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        return res.status(404).json({ error: "파일 없음" });
      }
      return res.status(500).json({ error: "읽기 오류" });
    }
    res.json(JSON.parse(data));
  });
});

// 5) 옷 등록 및 이미지 업로드
app.post("/api/clothes/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "이미지 누락" });
  }

  const { name, type, brand, subType, thickness, colors, features } = req.body;
  const imageUrl = `/images/cloths/${req.file.filename}`;

  if (!name || !type || !["아우터", "상의", "하의", "신발"].includes(type)) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "데이터 유효성 실패" });
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

    res.json({ success: true, cloth: newCloth });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: "저장 실패" });
  }
});

// 서버 시작
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});