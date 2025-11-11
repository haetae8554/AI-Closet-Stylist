
# AI Closet Stylist — Firebase + Gemini Backend

Firebase Firestore/Storage + Gemini 1.5 Flash 연동용 간단 Node.js 서버 템플릿.

## ⚙️ 설치
```bash
npm install
cp .env.example .env
npm start
```

## 🌍 .env 예시
```
PORT=3001
GEMINI_API_KEY=your_gemini_key_here

FIREBASE_PROJECT_ID=ai-closet-stylist
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## 📡 주요 기능
| 라우트 | 설명 |
|---------|------|
| `GET /` | 서버 상태 확인 |
| `GET /api/clothes` | Firestore에서 옷 목록 조회 |
| `POST /api/clothes` | Firestore에 옷 데이터 추가 |
| `POST /api/recommend` | Firestore 데이터 기반 Gemini AI 추천 |
