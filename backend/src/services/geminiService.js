
import { GEMINI_API_KEY } from "../config.js";

export async function getRecommendations(temp, weather, clothes) {
  if (!GEMINI_API_KEY) {
    const tops = clothes.filter(c => c.type === "top");
    const bottoms = clothes.filter(c => c.type === "bottom");
    const shoes = clothes.filter(c => c.type === "shoes");
    const pick = (arr, i) => arr[i % arr.length]?.name || null;
    return [0,1,2].map(i => ({
      outfit: {
        top: pick(tops, i),
        bottom: pick(bottoms, i),
        shoes: pick(shoes, i)
      },
      reason: `Temp ${temp}℃, ${weather} 날씨에 맞는 코디 #${i+1}`
    }));
  }
  const body = {
    contents: [{
      role: "user",
      parts: [{
        text: `오늘의 날씨는 ${weather}, ${temp}도야. 내 옷장: ${JSON.stringify(clothes)}. 색상 밸런스와 날씨를 고려해 코디 3개 추천해줘. JSON으로만.`
      }]
    }]
  };
  const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + GEMINI_API_KEY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  try { return JSON.parse(text); } catch { return [{ outfit: {}, reason: text }]; }
}
