import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import pg from "pg";

// 1. 기본 데이터(Seed) 가져오기
import { initialClothes, initialRegions } from "./seedData.js";

// 서비스 모듈
import { getRecommendations } from "./services/geminiService.js";
import {
  getWeatherByRequest,
  startWeatherScheduler,
} from "./services/WeatherService.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const { Pool } = pg;

// 2. DB 연결 설정
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// 3. DB 초기화 및 데이터 주입 함수
const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // [DB] 기존 테이블 초기화 (배포 시 스키마 충돌 방지 및 이미지 싱크 맞춤)
    console.log("[DB] 기존 테이블 스키마 재설정을 위해 초기화를 진행합니다...");
    await client.query("DROP TABLE IF EXISTS clothes CASCADE");
    await client.query("DROP TABLE IF EXISTS regions CASCADE");

    // (1) 옷 테이블 생성
    await client.query(`
      CREATE TABLE clothes (
        id TEXT PRIMARY KEY, 
        name TEXT,
        type TEXT,
        brand TEXT,
        sub_type TEXT,
        thickness TEXT,
        colors TEXT[],
        features TEXT[],
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // (2) 지역 테이블 생성
    await client.query(`
      CREATE TABLE regions (
        reg_id TEXT PRIMARY KEY,
        area TEXT,
        name TEXT
      );
    `);

    // (3) 추천 결과 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS recommendations (
        date_key TEXT PRIMARY KEY,
        data JSONB
      );
    `);

    // (4) 캘린더 테이블
    await client.query(`
      CREATE TABLE IF NOT EXISTS calendar (
        id SERIAL PRIMARY KEY,
        data JSONB
      );
    `);

    // ---------------------------------------------------------
    // 4. 데이터 주입 (Seeding) 로직
    // ---------------------------------------------------------

    // (1) 옷 데이터 넣기
    console.log("[DB] 옷 초기 데이터를 주입합니다...");
    
    const insertClothQuery = `
      INSERT INTO clothes (id, name, type, brand, sub_type, thickness, colors, features, image_url, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    for (const cloth of initialClothes) {
      await client.query(insertClothQuery, [
        String(cloth.id),
        cloth.name,
        cloth.type,
        cloth.brand || "브랜드 미지정",
        cloth.subType || "",
        cloth.thickness || "",
        cloth.colors || [],
        cloth.features || [],
        cloth.imageUrl,
        cloth.createdAt || new Date()
      ]);
    }
    console.log(`[DB] 옷 ${initialClothes.length}개 주입 완료!`);

    // (2) 지역 데이터 넣기
    console.log("[DB] 지역 초기 데이터를 주입합니다...");
    
    const insertRegionQuery = `
      INSERT INTO regions (reg_id, area, name)
      VALUES ($1, $2, $3)
    `;

    for (const reg of initialRegions) {
      await client.query(insertRegionQuery, [
        String(reg.regId),
        reg.area,
        reg.name
      ]);
    }
    console.log(`[DB] 지역 ${initialRegions.length}개 주입 완료!`);

    await client.query('COMMIT'); 
    console.log("[DB] 초기화 및 데이터 주입 성공");

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("[DB] 초기화 실패:", err);
  } finally {
    client.release();
  }
};

// 서버 시작 시 DB 초기화 실행
initDB();

// 미들웨어 설정
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// =========================================================
// [수정됨] 이미지 업로드 설정 (Render 서버 로컬 저장소)
// =========================================================

// 1. 현재 서버 폴더 내부에 'uploads' 폴더 생성 (서버 시작 시 자동 생성)
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 2. '/uploads' 경로로 요청이 오면 파일 제공 (정적 파일 서빙)
app.use('/uploads', express.static(UPLOAD_DIR));
// 기존 public 폴더도 서빙 유지 (기본 이미지 등)
app.use(express.static(path.join(__dirname, "..", "public")));

// 3. Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // 파일명 중복 방지를 위해 timestamp + random 사용
    const ext = path.extname(file.originalname);
    const uniqueName = `cloth-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage: storage });

console.log("===========================================");
console.log("[Backend Boot] AI Closet Stylist Server (DB Mode)");
console.log(`- NODE_ENV: ${process.env.NODE_ENV || "development"}`);
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
    db: "Connected",
    time: new Date().toISOString(),
  });
});

// 1) 제미나이 추천 및 데이터 저장
app.post("/api/recommend", async (req, res) => {
  console.log("[API] 추천 요청 시작");
  try {
    const { clothes = [], selected = {}, period } = req.body;
    
    // AI 서비스 호출
    const recs = await getRecommendations(req, selected, clothes, period);
    
    if (Array.isArray(recs) && recs.length > 0) {
        await saveRecommendationsToDB(recs, period);
        console.log("[SUCCESS] 추천 완료 및 DB 저장 성공");
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
app.get("/api/recommend/result", async (req, res) => {
  try {
    const { date, startDate, endDate, mode } = req.query;

    if (mode === "map" && startDate && endDate) {
        const result = await pool.query(
            "SELECT date_key, data FROM recommendations WHERE date_key BETWEEN $1 AND $2",
            [startDate, endDate]
        );
        const resultMap = {};
        result.rows.forEach(row => {
            resultMap[row.date_key] = row.data;
        });
        return res.json(resultMap);
    }

    let result = [];
    if (startDate && endDate) {
        const dbRes = await pool.query(
            "SELECT date_key, data FROM recommendations WHERE date_key BETWEEN $1 AND $2",
            [startDate, endDate]
        );
        dbRes.rows.forEach(row => {
            const enrichedData = row.data.map(item => ({...item, date: row.date_key}));
            result.push(...enrichedData);
        });
    } else {
        const targetDate = date || new Date().toISOString().split('T')[0];
        const dbRes = await pool.query(
            "SELECT data FROM recommendations WHERE date_key = $1",
            [targetDate]
        );
        result = dbRes.rows.length > 0 ? dbRes.rows[0].data : [];
    }

    res.json(result);
  } catch (e) {
    console.error("추천 결과 조회 오류:", e);
    res.status(500).json({ error: "데이터를 불러오지 못했습니다." });
  }
});

// DB 저장 도우미 함수
async function saveRecommendationsToDB(recs, period) {
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
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (strStart === strEnd) {
             await client.query(
                `INSERT INTO recommendations (date_key, data) VALUES ($1, $2)
                 ON CONFLICT (date_key) DO UPDATE SET data = $2`,
                [strStart, JSON.stringify(recs)]
             );
        } else {
            let currentDate = new Date(startDate);
             for (let i = 0; i < recs.length; i++) {
                if (currentDate <= endDate) {
                    const key = formatDate(currentDate);
                    const dayData = [recs[i]]; 
                    
                    await client.query(
                        `INSERT INTO recommendations (date_key, data) VALUES ($1, $2)
                         ON CONFLICT (date_key) DO UPDATE SET data = $2`,
                        [key, JSON.stringify(dayData)]
                      );
                    currentDate.setDate(currentDate.getDate() + 1);
                }
             }
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("DB 저장 실패:", e);
    } finally {
        client.release();
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
    const result = await pool.query("SELECT data FROM calendar ORDER BY id DESC LIMIT 1");
    if (result.rows.length > 0) {
        res.json(result.rows[0].data);
    } else {
        res.json({});
    }
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
    
    await pool.query("DELETE FROM calendar"); 
    await pool.query("INSERT INTO calendar (data) VALUES ($1)", [JSON.stringify(events)]);

    res.json({ success: true, message: "일정이 저장되었습니다." });
  } catch (e) {
    console.error("캘린더 저장 오류:", e);
    res.status(500).json({ error: "일정을 저장하지 못했습니다." });
  }
});

// 4) 옷 목록 조회
app.get("/api/clothes", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM clothes ORDER BY created_at DESC");
        const formatted = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            type: row.type,
            brand: row.brand,
            subType: row.sub_type,
            thickness: row.thickness,
            colors: row.colors,
            features: row.features,
            imageUrl: row.image_url,
            createdAt: row.created_at
        }));
        res.json(formatted);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "읽기 오류" });
    }
});

// 5) 옷 등록 (수정됨: 전체 URL 저장)
app.post("/api/clothes/upload", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "이미지 누락" });
  }

  const { name, type, brand, subType, thickness, colors, features } = req.body;
  
  // [변경] http://도메인/uploads/파일명 형태로 전체 URL 생성
  const protocol = req.protocol; // 'http' or 'https'
  const host = req.get('host');  // 'localhost:3000' or 'myapp.onrender.com'
  const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

  // ID 생성
  const newId = Date.now().toString();

  if (!name || !type) {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "필수 데이터 누락" });
  }

  const stringToArray = (str) => {
    if (typeof str !== "string") return [];
    return str.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  };

  try {
    const query = `
        INSERT INTO clothes (id, name, type, brand, sub_type, thickness, colors, features, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
    `;
    const values = [
        newId,
        name, 
        type, 
        brand || "브랜드 미지정", 
        subType || "", 
        thickness || "", 
        stringToArray(colors), 
        stringToArray(features), 
        imageUrl
    ];

    const result = await pool.query(query, values);
    const row = result.rows[0];

    const newCloth = {
        id: row.id,
        name: row.name,
        type: row.type,
        brand: row.brand,
        subType: row.sub_type,
        thickness: row.thickness,
        colors: row.colors,
        features: row.features,
        imageUrl: row.image_url,
        createdAt: row.created_at
    };

    res.json({ success: true, cloth: newCloth });
  } catch (err) {
    console.error("DB 저장 실패:", err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: "저장 실패" });
  }
});

// 6) 옷 수정 (수정됨: 파일 교체 시 경로 처리)
app.put("/api/clothes/:id", upload.single("image"), async (req, res) => {
    const { id } = req.params;
    const { name, type, brand, subType, thickness, colors, features } = req.body;
    
    try {
        const oldDataRes = await pool.query("SELECT * FROM clothes WHERE id = $1", [id]);
        if (oldDataRes.rows.length === 0) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: "옷 정보를 찾을 수 없음" });
        }
        const oldData = oldDataRes.rows[0];
        
        const stringToArray = (str) => {
            if (typeof str !== "string") return [];
            return str.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
        };

        // 이미지 처리
        let newImageUrl = oldData.image_url;
        if (req.file) {
            const protocol = req.protocol;
            const host = req.get('host');
            newImageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

            // 기존 파일 삭제 (URL에 '/uploads/'가 포함된 경우만)
            if (oldData.image_url && oldData.image_url.includes('/uploads/')) {
                const oldFileName = oldData.image_url.split('/uploads/')[1];
                const oldPath = path.join(UPLOAD_DIR, oldFileName);
                if (fs.existsSync(oldPath)) {
                    try { fs.unlinkSync(oldPath); } catch(e) {}
                }
            }
        }

        const query = `
            UPDATE clothes 
            SET name = COALESCE($1, name),
                type = COALESCE($2, type),
                brand = COALESCE($3, brand),
                sub_type = COALESCE($4, sub_type),
                thickness = COALESCE($5, thickness),
                colors = COALESCE($6, colors),
                features = COALESCE($7, features),
                image_url = $8
            WHERE id = $9
            RETURNING *
        `;
        
        const colorsParam = colors ? stringToArray(colors) : null;
        const featuresParam = features ? stringToArray(features) : null;

        const values = [name, type, brand, subType, thickness, colorsParam, featuresParam, newImageUrl, id];
        
        const result = await pool.query(query, values);
        const row = result.rows[0];
        
        res.json({ success: true, cloth: {
            id: row.id,
            name: row.name,
            imageUrl: row.image_url,
        }});
        
    } catch (err) {
        console.error("수정 오류:", err);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: "수정 중 오류 발생" });
    }
});

// 7) 옷 삭제 (수정됨: 파일 삭제 처리)
app.delete("/api/clothes/:id", async (req, res) => {
    const { id } = req.params;
    
    try {
        const oldDataRes = await pool.query("SELECT image_url FROM clothes WHERE id = $1", [id]);
        if (oldDataRes.rows.length === 0) {
            return res.status(404).json({ error: "삭제할 옷을 찾을 수 없음" });
        }
        
        const imageUrl = oldDataRes.rows[0].image_url;

        await pool.query("DELETE FROM clothes WHERE id = $1", [id]);
        
        // 로컬 이미지 파일 삭제
        if (imageUrl && imageUrl.includes('/uploads/')) {
            const oldFileName = imageUrl.split('/uploads/')[1];
            const imgPath = path.join(UPLOAD_DIR, oldFileName);
            if (fs.existsSync(imgPath)) {
                try { fs.unlinkSync(imgPath); } catch(e) {}
            }
        }
        
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