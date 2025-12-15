import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Closet from "./closet";
import AIRecommend from "./AIRecommend";
import AIResult from "./AIResult";
import UploadCloth from "./UploadCloth";
import CalendarPage from "./CalendarPage";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
    <BrowserRouter>
        <Routes>
            <Route path="/" element={<App />} />
            <Route path="/closet" element={<Closet />} />
            <Route path="/closet/upload" element={<UploadCloth />} />
            <Route path="/AI" element={<AIRecommend />} />
            <Route path="/AI/result" element={<AIResult />} />
            <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
    </BrowserRouter>
);