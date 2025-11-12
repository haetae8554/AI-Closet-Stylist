import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getRecommendations } from "./services/geminiService.js";
import fs from "fs";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ✅ 기본 상태 확인
app.get("/", (_req, res) => {
    res.json({ status: "ok", service: "AI Closet Stylist (Local JSON)" });
});

// ✅ AI 추천 (Gemini)
app.post("/api/recommend", async (req, res) => {
    try {
        const { clothes = [], selected = {} } = req.body;
        const recs = await getRecommendations(selected, clothes);
        res.json({ recommendations: recs });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// ✅ 서버 실행
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
    console.log(`[server] running on http://localhost:${PORT}`)
);
