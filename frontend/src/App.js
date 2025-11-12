import "./App.css";
import { useNavigate } from "react-router-dom";

function App() {
    const navigate = useNavigate();
    const goToCloset = () => navigate("/closet");
    const goTOAIRecommend = () => navigate("/AI");

    return (
        <div className="App" style={{ textAlign: "center", marginTop: "20%" }}>
            <h1>AI Closet Stylist</h1>
            <button onClick={goToCloset} className="go-btn">
                옷장으로 이동
            </button>
            <button onClick={goTOAIRecommend} className="go-btn">
                AI 추천
            </button>
        </div>
    );
}

export default App;
