import React from "react";
import ClosetUpload from "./components/ClosetUpload";
import ClosetList from "./components/ClosetList";
import RecommendView from "./components/RecommendView";
import "./App.css";

export default function App() {
    return (
        <div className="container">
            <header>
                <h1>👕 AI Closet Stylist</h1>
            </header>

            <main>
                <section>
                    <ClosetUpload />
                </section>
                <section>
                    <ClosetList />
                </section>
                <section>
                    <RecommendView />
                </section>
            </main>
        </div>
    );
}
