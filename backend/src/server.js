// backend/src/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getRecommendations } from "./services/geminiService.js";
import {
    getWeatherByRequest,
    startWeatherScheduler,      // 추가
} from "./services/WeatherService.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

console.log("===========================================");
console.log("[Backend Boot] AI Closet Stylist Server");
console.log(`- NODE_ENV: ${process.env.NODE_ENV || "development"}`);
console.log(
    `- Gemini API 연결 상태: ${process.env.GEMINI_API_KEY ? "OK" : "없음"}`
);
console.log(
    `- KMA API Key: ${process.env.KMA_API_KEY ? "OK" : "없음"}`
);
console.log(`- Server Time: ${new Date().toLocaleString("ko-KR")}`);
console.log("===========================================\n");

// 서버 시작 시 날씨 스케줄러 실행
// (단기/초단기/실황 + 육상예보 통보문 캐시 미리 채우고 주기 갱신)
startWeatherScheduler();

app.get("/", (_req, res) => {
    console.log("[BACKLOG] GET /  호출됨");
    res.json({
        status: "ok",
        service: "AI Closet Stylist Backend",
        time: new Date().toISOString(),
    });
});

// 제미나이 추천
app.post("/api/recommend", async (req, res) => {
    console.log("[BACKLOG] POST /api/recommend 요청 도착");

    try {
        const { clothes = [], selected = {} } = req.body;
        const recs = await getRecommendations(selected, clothes);

        res.json({ recommendations: recs });
    } catch (e) {
        console.error("[ERROR] recommend:", e);
        res.status(500).json({ error: e.message });
    }
});

// 날씨 + 위치 (IP 기반 위치 → 기상청 예보)
app.get("/api/weather/current", async (req, res) => {
    console.log("[BACKLOG] GET /api/weather/current 요청 도착");

    try {
        const result = await getWeatherByRequest(req);

        console.log("[BACKLOG] 위치·날씨 성공:", {
            ip: result.location.ip,
            city: result.location.city,
            lat: result.location.lat,
            lon: result.location.lon,
            hasGrid: !!result.clothesWeather?.grid,
        });

        res.json(result);
    } catch (e) {
        console.error("[ERROR] weather:", e);
        res.status(500).json({ error: "날씨 정보를 가져오지 못했습니다." });
    }
});

// 서버 실행
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`[server] running on http://localhost:${PORT}`);
    console.log("[BACKLOG] Server Startup Completed\n");
});