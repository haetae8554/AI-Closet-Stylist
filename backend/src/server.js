import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

// 서비스 모듈
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

// 미들웨어
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

// 파일 업로드 폴더
const UPLOAD_DIR = path.join(__dirname, "..", "public", "images", "cloths");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 추천 데이터 저장 경로
const DATA_DIR = path.join(__dirname, "../data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const REC_FILE_PATH = path.join(DATA_DIR, "recommendations.json");
const CLOTHES_FILE_PATH = path.join(DATA_DIR, "clothes.json");

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
    
    const recs = await getRecommendations(req, selected, clothes, period);
    
    if (Array.isArray(recs) && recs.length > 0) {
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

// 추천 결과 조회
app.get("/api/recommend/result", (req, res) => {
  try {
    const { date, startDate, endDate, mode } = req.query;

    if (!fs.existsSync(REC_FILE_PATH)) {
      return res.json(mode === "map" ? {} : []);
    }

    const fileData = fs.readFileSync(REC_FILE_PATH, "utf8");
    const allData = JSON.parse(fileData);

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
    
    const formatDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const strStart = formatDate(startDate);
    const strEnd = formatDate(endDate);

    if (strStart === strEnd) {
      allData[strStart] = recs;
      console.log(`[SAVE] 단일 날짜 저장 (${strStart}): 코디 ${recs.length}개`);
    } else {
      let currentDate = new Date(startDate);
      recs.forEach((rec, index) => {
        if (currentDate <= endDate) {
          const key = formatDate(currentDate);
          allData[key] = [rec]; 
          currentDate.setDate(currentDate.getDate() + 1);
        }
      });
      console.log(`[SAVE] 다중 날짜 저장 (${strStart} ~ ${strEnd})`);
    }

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
  fs.readFile(CLOTHES_FILE_PATH, "utf8", (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        return res.status(404).json({ error: "파일 없음" });
      }
      return res.status(500).json({ error: "읽기 오류" });
    }
    res.json(JSON.parse(data));
  });
});

// 5) 옷 등록
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

  try {
    let clothes = [];
    if (fs.existsSync(CLOTHES_FILE_PATH)) {
      const data = fs.readFileSync(CLOTHES_FILE_PATH, "utf8");
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
    fs.writeFileSync(CLOTHES_FILE_PATH, JSON.stringify(clothes, null, 4), "utf8");

    res.json({ success: true, cloth: newCloth });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: "저장 실패" });
  }
});

// 6) 옷 수정
app.put("/api/clothes/:id", upload.single("image"), (req, res) => {
    const { id } = req.params;
    const { name, type, brand, subType, thickness, colors, features } = req.body;
    
    try {
        if (!fs.existsSync(CLOTHES_FILE_PATH)) {
            return res.status(404).json({ error: "데이터 파일 없음" });
        }
        
        let clothes = JSON.parse(fs.readFileSync(CLOTHES_FILE_PATH, "utf8"));
        const index = clothes.findIndex(c => String(c.id) === String(id));
        
        if (index === -1) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: "옷 정보를 찾을 수 없음" });
        }
        
        const stringToArray = (str) => {
            if (typeof str !== "string") return [];
            return str.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
        };

        // 기존 정보 업데이트
        clothes[index].name = name || clothes[index].name;
        clothes[index].type = type || clothes[index].type;
        clothes[index].brand = brand || clothes[index].brand;
        clothes[index].subType = subType || clothes[index].subType;
        clothes[index].thickness = thickness || clothes[index].thickness;
        clothes[index].colors = colors ? stringToArray(colors) : clothes[index].colors;
        clothes[index].features = features ? stringToArray(features) : clothes[index].features;
        
        // 새 이미지가 업로드된 경우 교체
        if (req.file) {
            const oldImageUrl = clothes[index].imageUrl;
            clothes[index].imageUrl = `/images/cloths/${req.file.filename}`;
            
            // 기존 이미지 파일 삭제 시도 (로컬 파일인 경우)
            if (oldImageUrl && oldImageUrl.startsWith("/images/cloths/")) {
                const oldPath = path.join(__dirname, "..", "public", oldImageUrl);
                if (fs.existsSync(oldPath)) {
                    try { fs.unlinkSync(oldPath); } catch(e) { console.error("기존 이미지 삭제 실패:", e); }
                }
            }
        }
        
        fs.writeFileSync(CLOTHES_FILE_PATH, JSON.stringify(clothes, null, 4), "utf8");
        res.json({ success: true, cloth: clothes[index] });
        
    } catch (err) {
        console.error("수정 오류:", err);
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: "수정 중 오류 발생" });
    }
});

// 7) 옷 삭제
app.delete("/api/clothes/:id", (req, res) => {
    const { id } = req.params;
    
    try {
        if (!fs.existsSync(CLOTHES_FILE_PATH)) {
            return res.status(404).json({ error: "데이터 파일 없음" });
        }
        
        let clothes = JSON.parse(fs.readFileSync(CLOTHES_FILE_PATH, "utf8"));
        const target = clothes.find(c => String(c.id) === String(id));
        
        if (!target) {
            return res.status(404).json({ error: "삭제할 옷을 찾을 수 없음" });
        }
        
        // 이미지 파일 삭제 (로컬 경로인 경우)
        if (target.imageUrl && target.imageUrl.startsWith("/images/cloths/")) {
            const imgPath = path.join(__dirname, "..", "public", target.imageUrl);
            if (fs.existsSync(imgPath)) {
                try { fs.unlinkSync(imgPath); } catch(e) { console.error("이미지 삭제 실패:", e); }
            }
        }
        
        // 배열에서 제거
        clothes = clothes.filter(c => String(c.id) !== String(id));
        fs.writeFileSync(CLOTHES_FILE_PATH, JSON.stringify(clothes, null, 4), "utf8");
        
        res.json({ success: true, message: "삭제되었습니다." });
        
    } catch (err) {
        console.error("삭제 오류:", err);
        res.status(500).json({ error: "삭제 중 오류 발생" });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[server] running on http://localhost:${PORT}`);
});