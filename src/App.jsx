import VideoInput from "./components/VideoInput";

export default function App(){
  return (
    <main style={{padding:16}}>
      <h2>Squat Depth · Client-side (React)</h2>
      <p style={{maxWidth:680}}>
        브라우저에서 MediaPipe Pose Landmarker로 힙/무릎 키포인트를 추출하고
        depth_ratio 기반으로 PASS/FAIL/UNSURE를 판정합니다. 결과만 서버로 전송하면
        지도/랭킹에 반영할 수 있습니다.
      </p>
      <VideoInput/>
    </main>
  );
}
