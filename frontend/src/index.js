import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import App from "./App"; 
import Closet from "./closet"; 
import ClosetDetail from "./closet_detail"; 
import UploadCloth from "./UploadCloth";
import CalendarPage from "./CalendarPage";

// AI 관련 컴포넌트 임포트
import AIRecommend from "./AIRecommend";
import AIResult from "./AIResult"; // 즉시 결과 확인용
import RecommendationResultPage from "./RecommendationResultPage"; // 캘린더 기록용

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
    <BrowserRouter>
        <Routes>
            {/* 메인 화면 */}
            <Route path="/" element={<App />} />
            <Route path="/calendar" element={<CalendarPage />} />
            
            {/* 옷장 관련 */}
            <Route path="/closet" element={<Closet />} />
            <Route path="/closet/detail" element={<ClosetDetail />} />
            <Route path="/closet/upload" element={<UploadCloth />} />
            
            {/* AI 관련 흐름 */}
            <Route path="/AI" element={<AIRecommend />} />           {/* 1. 입력 및 추천 요청 */}
            <Route path="/AI/daily" element={<AIResult />} />       {/* 2. 방금 받은 결과 확인 */}
            <Route path="/AI/result" element={<RecommendationResultPage />} /> {/* 3. 캘린더 히스토리 */}
            
        </Routes>
    </BrowserRouter>
);