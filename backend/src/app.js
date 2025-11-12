import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db } from "./firebase.js";
import { getRecommendations } from "./services/geminiService.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// ✅ Firestore Admin에서는 이렇게 사용해야 함
const clothesRef = db.collection("clothes");

app.get("/", (_req, res) => {
    res.json({ status: "ok", service: "AI Closet Stylist (Firebase)" });
});




// 옷 목록 조회
app.get("/api/clothes", async (_req, res) => {
    try {
        const snapshot = await clothesRef.get();
        const clothes = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));
        res.json(clothes);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 옷 추가
app.post("/api/clothes", async (req, res) => {
    try {
        const { name, type, color, imageUrl } = req.body;
        if (!name || !imageUrl)
            return res
                .status(400)
                .json({ error: "name and imageUrl required" });

        // ✅ Admin SDK에서는 addDoc() 대신 add() 사용
        const ref = await clothesRef.add({
            name,
            type,
            color,
            imageUrl,
            createdAt: new Date(),
        });

        res.status(201).json({ id: ref.id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// AI 추천
app.post("/api/recommend", async (req, res) => {
    try {
        const { clothes = [], weather = { temp: 22, weather: "Clear" } } =
            req.body;
        const recs = await getRecommendations(
            weather.temp,
            weather.weather,
            clothes
        );
        res.json({ weather, recommendations: recs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
    console.log(`[server] running on http://localhost:${PORT}`)
);
