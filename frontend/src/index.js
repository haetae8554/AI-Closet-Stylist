// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Closet from "./closet"; // 확장자 생략 OK
import AIRecommend from "./AIRecommend";
import AIResult from "./AIResult";

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
    <BrowserRouter>
        <Routes>
            <Route path="/" element={<App />} />
            <Route path="/closet" element={<Closet />} />
            <Route path="/AI" element={<AIRecommend />} />
            <Route path="/AI/result" element={<AIResult />} />
        </Routes>
    </BrowserRouter>
);
