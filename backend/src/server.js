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

// 추천 데이터 저장 경로 설정
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

// ==========================================
// [API Routes]
// ==========================================

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
  console.log("[API] 추천 요청 시작");
  try {
    const { clothes = [], selected = {}, period } = req.body;
    
    // 제미나이 서비스 호출
    const recs = await getRecommendations(req, selected, clothes, period);
    
    // 결과가 배열인지 확인
    if (Array.isArray(recs) && recs.length > 0) {
        // 파일 저장 로직 실행
        saveRecommendationsToFile(recs, period);
        console.log("[SUCCESS] 추천 완료 및 JSON 파일 저장 성공");
    } else {
        console.warn("[WARN] 생성된 추천 결과가 비어있습니다.");
    }

    res.json({ success: true, message: "추천 완료", recommendations: recs });
  } catch (e) {
    console.error("[ERROR] 추천 생성 중 오류:", e);
    res.status(500).json({ error: e.message });
  }
});

// [수정] 추천 결과 조회 (캘린더용 포맷 지원)
app.get("/api/recommend/result", (req, res) => {
  try {
    const { date, startDate, endDate, mode } = req.query; // mode 추가

    if (!fs.existsSync(REC_FILE_PATH)) {
      return res.json(mode === "map" ? {} : []);
    }

    const fileData = fs.readFileSync(REC_FILE_PATH, "utf8");
    const allData = JSON.parse(fileData);

    // Case 1: 캘린더 뷰를 위해 날짜를 Key로 하는 객체 반환 (mode=map)
    if (mode === "map" && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const resultMap = {};

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const key = `${year}-${month}-${day}`;
            
            if (allData[key]) {
                resultMap[key] = allData[key];
            }
        }
        return res.json(resultMap);
    }

    // Case 2: 기존 로직 (배열 반환)
    let result = [];
    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const key = `${year}-${month}-${day}`;
            
            if (allData[key]) {
                // 프론트에서 날짜 구분을 위해 객체에 date 속성 주입하여 반환
                const enrichedData = allData[key].map(item => ({...item, date: key}));
                result.push(...enrichedData);
            }
        }
    } else {
        const targetDate = date || new Date().toISOString().split('T')[0];
        result = allData[targetDate] || [];
    }

    res.json(result);
  } catch (e) {
    console.error("추천 결과 조회 오류:", e);
    res.status(500).json({ error: "데이터를 불러오지 못했습니다." });
  }
});

// 파일 저장 함수
function saveRecommendationsToFile(recs, period) {
  try {
    let allData = {};
    
    // 기존 파일이 있으면 읽어오기
    if (fs.existsSync(REC_FILE_PATH)) {
      const existing = fs.readFileSync(REC_FILE_PATH, "utf8");
      try {
        allData = JSON.parse(existing);
      } catch (parseError) {
        allData = {};
      }
    }

    const startDate = period?.start ? new Date(period.start) : new Date();
    const endDate = period?.end ? new Date(period.end) : new Date();
    
    // 날짜 포맷 (YYYY-MM-DD)
    const formatDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const strStart = formatDate(startDate);
    const strEnd = formatDate(endDate);

    // 단일 날짜인지 확인
    if (strStart === strEnd) {
      // 단일 날짜: 해당 날짜 키에 전체 결과 덮어쓰기
      allData[strStart] = recs;
      console.log(`[SAVE] 단일 날짜 저장 (${strStart}): 코디 ${recs.length}개`);
    } else {
      // 여러 날짜: 결과 배열을 순서대로 날짜에 매핑
      let currentDate = new Date(startDate);
      
      recs.forEach((rec, index) => {
        // 날짜 범위 안인지 체크
        if (currentDate <= endDate) {
          const key = formatDate(currentDate);
          // 저장 시 구조 통일: 하루에 여러 추천이 있을 수 있으므로 배열로 저장
          allData[key] = [rec]; 
          
          // 다음 날짜로 이동
          currentDate.setDate(currentDate.getDate() + 1);
        }
      });
      console.log(`[SAVE] 다중 날짜 저장 (${strStart} ~ ${strEnd})`);
    }

    // 파일 쓰기
    fs.writeFileSync(REC_FILE_PATH, JSON.stringify(allData, null, 2), "utf8");
    
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});