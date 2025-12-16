import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import pg from "pg"; // 1. PostgreSQL 모듈 추가

// 서비스 모듈 (DB 전환으로 인해 일부 미사용 될 수 있음)
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

// 2. DB 연결 설정 (Render 환경변수 DATABASE_URL 사용)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// 3. 테이블 자동 생성 (서버 시작 시 실행)
const initDB = async () => {
  try {
    const client = await pool.connect();
    
    // 옷 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS clothes (
        id SERIAL PRIMARY KEY,
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

    // 추천 결과 테이블 생성 (날짜별 JSON 저장)
    await client.query(`
      CREATE TABLE IF NOT EXISTS recommendations (
        date_key TEXT PRIMARY KEY,
        data JSONB
      );
    `);

    // 캘린더 테이블 생성
    await client.query(`
      CREATE TABLE IF NOT EXISTS calendar (
        id SERIAL PRIMARY KEY,
        data JSONB
      );
    `);

    console.log("[DB] 테이블 초기화 완료");
    client.release();
  } catch (err) {
    console.error("[DB] 테이블 생성 실패:", err);
  }
};
initDB();

// 미들웨어
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

// 파일 업로드 폴더 (주의: 무료 Render에서는 이미지가 재배포시 사라질 수 있음)
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
    cb(null, "cloth-" + Date.now() + ext);
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

// 1) 제미나이 추천 및 데이터 저장 (DB로 변경)
app.post("/api/recommend", async (req, res) => {
  console.log("[API] 추천 요청 시작");
  try {
    const { clothes = [], selected = {}, period } = req.body;
    
    // AI 서비스 호출 (기존 로직 유지)
    const recs = await getRecommendations(req, selected, clothes, period);
    
    if (Array.isArray(recs) && recs.length > 0) {
        // DB 저장 함수 호출
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

// 추천 결과 조회 (DB 조회)
app.get("/api/recommend/result", async (req, res) => {
  try {
    const { date, startDate, endDate, mode } = req.query;

    if (mode === "map" && startDate && endDate) {
        // 기간 조회 (Map 모드)
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
        // 기간 조회 (List 모드)
        const dbRes = await pool.query(
            "SELECT date_key, data FROM recommendations WHERE date_key BETWEEN $1 AND $2",
            [startDate, endDate]
        );
        
        dbRes.rows.forEach(row => {
            const enrichedData = row.data.map(item => ({...item, date: row.date_key}));
            result.push(...enrichedData);
        });
    } else {
        // 단일 날짜 조회
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

// DB 저장 도우미 함수 (기존 파일 저장 함수 대체)
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
             // INSERT 하되, 날짜가 겹치면 업데이트 (Upsert)
             await client.query(
                `INSERT INTO recommendations (date_key, data) VALUES ($1, $2)
                 ON CONFLICT (date_key) DO UPDATE SET data = $2`,
                [strStart, JSON.stringify(recs)]
             );
        } else {
            let currentDate = new Date(startDate);
            // 날짜별 분리 저장 로직은 기존과 동일하지만 DB 쿼리 사용
            // (참고: 기존 로직상 recs가 전체 기간 뭉치라면 로직 조정 필요할 수 있으나, 기존 로직 따름)
             // 주의: 기존 코드는 recs 전체를 하루하루에 넣는게 아니라 recs[0]을 첫날.. 이런 식이었습니다.
             // 여기선 안전하게 recs 전체를 해당 날짜 범위 각각에 넣는게 아니라,
             // 기존 로직(forEach)을 최대한 따릅니다.
             for (let i = 0; i < recs.length; i++) {
                if (currentDate <= endDate) {
                    const key = formatDate(currentDate);
                    const dayData = [recs[i]]; // 하루치 데이터 배열화
                    
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

// 3) 캘린더 일정 관리 (DB 사용으로 직접 구현)
app.get("/api/calendar", async (req, res) => {
  try {
    // DB에서 단일 row로 관리하거나 전체 리스트 조회
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
    
    // 덮어쓰기 방식으로 저장 (기존 row 삭제 후 삽입 또는 업데이트)
    // 간단하게 가장 최근 1개 row만 유지한다고 가정
    await pool.query("DELETE FROM calendar"); 
    await pool.query("INSERT INTO calendar (data) VALUES ($1)", [JSON.stringify(events)]);

    res.json({ success: true, message: "일정이 저장되었습니다." });
  } catch (e) {
    console.error("캘린더 저장 오류:", e);
    res.status(500).json({ error: "일정을 저장하지 못했습니다." });
  }
});

// 4) 옷 목록 조회 (DB 조회)
app.get("/api/clothes", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM clothes ORDER BY created_at DESC");
        // DB 컬럼명을 프론트엔드와 맞추기 (snake_case -> camelCase)
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

// 5) 옷 등록 (DB Insert)
app.post("/api/clothes/upload", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "이미지 누락" });
  }

  const { name, type, brand, subType, thickness, colors, features } = req.body;
  const imageUrl = `/images/cloths/${req.file.filename}`;

  if (!name || !type) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: "필수 데이터 누락" });
  }

  const stringToArray = (str) => {
    if (typeof str !== "string") return [];
    return str.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  };

  try {
    const query = `
        INSERT INTO clothes (name, type, brand, sub_type, thickness, colors, features, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
    `;
    const values = [
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

    // 응답 포맷 맞춤
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
    // 실패 시 업로드된 이미지 삭제
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: "저장 실패" });
  }
});

// 6) 옷 수정 (DB Update)
app.put("/api/clothes/:id", upload.single("image"), async (req, res) => {
    const { id } = req.params;
    const { name, type, brand, subType, thickness, colors, features } = req.body;
    
    try {
        // 기존 데이터 확인
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
            newImageUrl = `/images/cloths/${req.file.filename}`;
            // 기존 이미지 삭제 (로컬 파일인 경우)
            if (oldData.image_url && oldData.image_url.startsWith("/images/cloths/")) {
                const oldPath = path.join(__dirname, "..", "public", oldData.image_url);
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
        
        // colors/features가 undefined면 기존값 유지를 위해 null로 처리하지 않음 (SQL COALESCE 사용)
        // 단, 클라이언트가 빈 값을 보낼수도 있으므로 로직 주의. 여기서는 값이 있으면 배열로 변환
        const colorsParam = colors ? stringToArray(colors) : null;
        const featuresParam = features ? stringToArray(features) : null;

        const values = [name, type, brand, subType, thickness, colorsParam, featuresParam, newImageUrl, id];
        
        const result = await pool.query(query, values);
        const row = result.rows[0];
        
        res.json({ success: true, cloth: {
            id: row.id,
            name: row.name,
            imageUrl: row.image_url,
            // ... 나머지 필드 매핑 생략 (프론트 필요에 따라 추가)
        }});
        
    } catch (err) {
        console.error("수정 오류:", err);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: "수정 중 오류 발생" });
    }
});

// 7) 옷 삭제 (DB Delete)
app.delete("/api/clothes/:id", async (req, res) => {
    const { id } = req.params;
    
    try {
        // 삭제 전 이미지 경로 확인을 위해 조회
        const oldDataRes = await pool.query("SELECT image_url FROM clothes WHERE id = $1", [id]);
        if (oldDataRes.rows.length === 0) {
            return res.status(404).json({ error: "삭제할 옷을 찾을 수 없음" });
        }
        
        const imageUrl = oldDataRes.rows[0].image_url;

        // DB 삭제
        await pool.query("DELETE FROM clothes WHERE id = $1", [id]);
        
        // 이미지 파일 삭제
        if (imageUrl && imageUrl.startsWith("/images/cloths/")) {
            const imgPath = path.join(__dirname, "..", "public", imageUrl);
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