import "./app.css";
import VideoInput from "./components/VideoInput";

export default function App() {
  return (
    <main className="app">
      <header className="hero">
        <h1>Squat Depth · Client-side</h1>
        <p>
          브라우저에서 MediaPipe Pose Landmarker로 힙/무릎 키포인트를 추출하고
          <strong> depth_ratio</strong> 기반으로 <strong>PASS/FAIL/UNSURE</strong>를 판정합니다.
        </p>
      </header>

      <section className="panel">
        <div className="panel-header">
          <h2>Video / Webcam</h2>
          <span className="hint">권장 각도: 측면 60°~90°</span>
        </div>
        <div className="panel-body">
          <VideoInput />
        </div>
      </section>
    </main>
  );
}
