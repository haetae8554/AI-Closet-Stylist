// import logo from './logo.svg';
import './App.css';

function App() {
  return (
    <>
      <nav id="nav3">
        <a href="/">AI Closet</a>
        <ul>
          <li><a href="/">menu1</a></li>
          <li><a href="/">menu2</a></li>
          <li><a href="/">menu3</a></li>
          <li><a href="/">menu4</a></li>
          <li><a href="/">menu5</a></li>
        </ul>
        <select>
          <option>=test=</option>
          <option>=test=</option>
          <option>=test=</option>
        </select>
      </nav>

      <main className="clothes-area">
        <h2>My Closet</h2>
        <button className="registration-btn">
          옷 등록
        </button>

        <div className="main-dashboard">
          <section className="random-clothes-section">
            <h3>옷장</h3>
            <div className="placeholder-content">
              <p>옷장 정보를 받아와서<br />랜덤으로 띄워주는 영역</p>
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
          <button className="ai-recommend-btn">
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