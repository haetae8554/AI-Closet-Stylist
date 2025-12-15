import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getRecommendations } from "./services/geminiService.js";
import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";
import multer from "multer";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

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

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (_req, res) => {
    res.json({ status: "ok", service: "AI Closet Stylist (Local JSON)" });
});

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
            return res
                .status(500)
                .json({ error: "데이터를 읽을 수 없습니다." });
        }
        res.json(JSON.parse(data));
    });
});

app.post("/api/clothes/upload", upload.single("image"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "이미지 파일이 누락되었습니다." });
    }

    const { name, type, brand, subType, thickness, colors, features } =
        req.body;
    const imageUrl = `/images/cloths/${req.file.filename}`;

    if (!name || !type || !["아우터", "상의", "하의", "신발"].includes(type)) {
        fs.unlinkSync(req.file.path);
        return res
            .status(400)
            .json({ error: "옷 이름이나 분류가 유효하지 않습니다." });
    }

    const filePath = path.join(__dirname, "../data", "clothes.json");

    try {
        const data = fs.readFileSync(filePath, "utf8");
        const clothes = JSON.parse(data);

        const stringToArray = (str) => {
            if (typeof str !== "string") return [];
            return str
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
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
        console.error("데이터 저장 실패:", err);
        fs.unlinkSync(req.file.path);
        res.status(500).json({
            error: "데이터베이스 업데이트에 실패했습니다.",
        });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
    console.log(`[server] running on http://localhost:${PORT}`)
);
