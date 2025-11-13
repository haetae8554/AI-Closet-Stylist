// src/App.js
import React from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";

function App() {
  const navigate = useNavigate();

  const goToCloset = () => navigate("/closet");
  const goToAI = () => navigate("/AI");

  return (
    <>
      {/* 🔹 메인 전용 Navbar (옷장/상세에서 쓰는 nav랑 일부러 다르게 유지) */}
      <nav id="nav3">
        <a href="/" className="logo">
          AI Closet
        </a>

        <ul>
          {/* 메인에서 옷장 / AI 페이지로만 이동 */}
          <li>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                goToCloset();
              }}
            >
              옷장
            </a>
          </li>
          <li>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                goToAI();
              }}
            >
              AI 추천
            </a>
          </li>
          <li>
            <a href="#">menu3</a>
          </li>
          <li>
            <a href="#">menu4</a>
          </li>
          <li>
            <a href="#">menu5</a>
          </li>
        </ul>

        <select>
          <option>=test=</option>
          <option>=test=</option>
          <option>=test=</option>
        </select>
      </nav>

      {/* 🔹 메인 페이지 내용 */}
      <main className="clothes-area">
        <h2>My Closet</h2>

        {/* 이 버튼도 실제로 /closet 으로 이동하게 연결 */}
        <button className="registration-btn" onClick={goToCloset}>
          옷장으로 이동
        </button>

        <div className="main-dashboard">
          <section className="random-clothes-section">
            <h3>옷장</h3>
            <div className="placeholder-content">
              <p>
                옷장 정보를 받아와서
                <br />
                랜덤으로 띄워주는 영역
              </p>
            </div>
          </section>

          <aside className="weather-section">
            <h3>오늘의 날씨</h3>
            <div className="placeholder-content">
              <p>날씨 정보</p>
            </div>
          </aside>
        </div>

        <section className="ai-section">
          {/* 여기서도 /AI 페이지로 라우팅 */}
          <button className="ai-recommend-btn" onClick={goToAI}>
            AI 추천 받기
          </button>
          <div className="ai-recommend-display">
            <p>AI가 추천하는 옷이 표시</p>
          </div>
        </section>
      </main>
    </>
  );
}

export default App;
