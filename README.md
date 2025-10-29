# AI Closet Stylist

## 1. Title  
**AI Closet Stylist** — 사용자의 옷장 데이터를 기반으로, 날씨에 맞춰 AI가 오늘의 코디를 추천해주는 웹 애플리케이션

---

## 2. Abstract  
AI Closet Stylist는 사용자가 직접 등록한 옷 정보를 바탕으로, OpenWeatherMap API에서 가져온 현재 날씨 데이터를 분석하여 AI가 코디를 제안하는 웹 서비스입니다.  
Gemini 1.5 Flash 모델을 활용해 색상, 계절감, 스타일 밸런스를 종합적으로 고려한 추천 결과를 제공합니다.  
간단한 인터페이스를 통해 옷 등록, 추천 받기, 추천 결과 확인을 수행할 수 있으며, 개인화된 AI 코디 경험을 제공합니다.

---

## 3. Project Image  
![AI Closet Stylist Diagram](docs/ai_closet_stylist_flow.png)  
> 위 이미지는 시스템 흐름도 또는 서비스 화면 캡처로 교체 예정.

---

## 4. Project Schedule  

| 단계 | 기간 | 주요 내용 |
| --- | --- | --- |
| 1단계 | 11월 1일 ~ 11월 10일 | React 기본 UI 설계 및 옷 등록 기능 구현 |
| 2단계 | 11월 11일 ~ 11월 20일 | Node.js 서버 및 API 연동 (OpenWeatherMap, Gemini) |
| 3단계 | 11월 21일 ~ 11월 30일 | AI 코디 추천 로직 구현 및 프론트엔드 연결 |
| 4단계 | 12월 1일 ~ 12월 10일 | UI 개선, 데이터 저장(SQLite) 기능 추가 |
| 5단계 | 12월 11일 ~ 12월 17일 | 테스트 및 README/배포 준비 (최종 마감) |

> **프로젝트 마감일:** Wednesday, December 17th

---

## 5. Team Roles & Development Areas  

| 이름 | 역할 | 주요 담당 영역 |
| --- | --- | --- |
| 이용진 | --- | --- |
| 구현민 | --- | --- |
| 한태윤 | --- | --- |
| 예시  | Frontend 개발 | React 컴포넌트 설계, Tailwind CSS 스타일링, 결과 UI 구성 |
| 예시  | Backend 개발 | Node.js + Express 서버 구축, API 연동, 데이터 파이프라인 설계 |
| 예시  | AI 연동 | Gemini 1.5 Flash API 설계, 프롬프트 엔지니어링, JSON 파싱 로직 |
| 예시  | 데이터 관리 | SQLite/JSON 기반 데이터베이스 설계 및 저장 로직 |
| 예시  | 총괄 및 문서화 | 일정 관리, 테스트 및 README 작성 |

---

## 6. Technologies Used  

| 영역 | 기술 | 설명 |
| --- | --- | --- |
| Frontend | React, Tailwind CSS | 사용자 인터페이스 구현 |
| Backend | Node.js, Express | REST API 서버 구축 |
| AI Engine | Google Gemini 1.5 Flash API | 코디 추천 생성 모델 |
| Weather API | OpenWeatherMap API | 날씨 데이터 수집 |
| Database | SQLite (또는 JSON) | 옷장 데이터 저장 |
| 기타 | GitHub, Vercel | 버전 관리 및 배포 환경 |

---

## 7. System Flow Overview  

사용자 → 옷 등록 → 서버 저장
↓
[추천받기 버튼 클릭]
↓
서버: 날씨 API로 현재 기온 가져옴
↓
Gemini 1.5 Flash에 프롬프트 전달:
"오늘 21도, 옷 리스트 중 코디 3개 추천해줘"
↓
Gemini → 코디 조합 + 설명(JSON) 반환
↓
React 프론트에서 코디 목록 + 설명 표시





---

## 8. Example Prompt  

오늘의 날씨는 맑고 22도야.
내 옷장에는 다음 옷들이 있어:

라이트 그레이 후드

흑청 자켓

진청 데님 팬츠

화이트 스니커즈
이 중에서 색상 밸런스와 날씨를 고려해 코디 3개 추천해줘.
각 코디는 상의/하의/신발로 구성하고, JSON 형식으로 출력해줘.


---

## 9. Future Plan  
- 계절별 추천 강화 (예: “겨울 외투 포함” 옵션)  
- 사용자별 선호 색상/스타일 학습 기능 추가  
- 다국어 지원 및 모바일 UI 최적화  

---




# 노션
[노션](https://www.notion.so/28c2ec12d123814797d1c7b0b3d764a3)
