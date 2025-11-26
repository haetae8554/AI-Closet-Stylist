
import dotenv from "dotenv";
dotenv.config();

export async function getRecommendations(selected, clothes) {
    const API_KEY = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

    const prompt = `
당신은 패션 코디 전문가입니다.
다음은 사용자가 보유한 옷 목록입니다 (JSON):
${JSON.stringify(clothes, null, 2)}

사용자가 고정한 옷(없으면 null):
${JSON.stringify(selected, null, 2)}

규칙:
1️⃣ 응답은 JSON 배열 형식이어야 합니다.
2️⃣ 각 객체는 "outer", "top", "bottom", "shoes"의 id를 포함합니다.
3️⃣ 선택된 항목은 그대로 두고, 나머지를 추천해주세요.
4️⃣ 예시는 다음과 같습니다:
[
  { "outer": "outer-001", "top": "top-003", "bottom": "pants-002", "shoes": "shoes-004" },
  { "outer": "outer-005", "top": "top-006", "bottom": "pants-007", "shoes": "shoes-008" }
]
5️⃣ 설명 문장 없이 JSON만 출력하세요.
`;

    const body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
    };

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    console.log("📥 Gemini 응답:", JSON.stringify(data, null, 2));

    // JSON만 추출
    const jsonStart = text.indexOf("[");
    const jsonEnd = text.lastIndexOf("]");
    const jsonPart = text.slice(jsonStart, jsonEnd + 1);
    return JSON.parse(jsonPart);
}