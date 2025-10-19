// src/lib/pose.js
const { PoseLandmarker, FilesetResolver } = window;

export async function createLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
  );

  const landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
    },
    runningMode: "VIDEO",
    numPoses: 1,
    // 감지 민감도 완화
    minPoseDetectionConfidence: 0.2,
    minPosePresenceConfidence: 0.2,
    minTrackingConfidence: 0.2
  });

  // 안전하게 VIDEO로 한번 더 고정
  await landmarker.setOptions({ runningMode: "VIDEO" });
  return landmarker;
}

/**
 * VIDEO 모드 첫 프레임 전, 이미지 모드로 한 프레임 '워밍업' 후 VIDEO로 재전환
 * 일부 환경에서 VIDEO 첫 detectForVideo가 빈 결과를 내는 문제를 줄여줍니다.
 */
export async function warmUpOnce(landmarker, videoEl) {
  // 비디오 치수 확보
  const vw = videoEl.videoWidth | 0, vh = videoEl.videoHeight | 0;
  if (vw === 0 || vh === 0) return;

  // 오프스크린 캔버스에 현재 프레임 복사
  const off = document.createElement("canvas");
  off.width = vw; off.height = vh;
  const octx = off.getContext("2d");
  octx.drawImage(videoEl, 0, 0, vw, vh);

  // IMAGE 모드로 전환 → detect 한 번 → 다시 VIDEO
  await landmarker.setOptions({ runningMode: "IMAGE" });
  try {
    // detect()는 HTMLCanvasElement도 입력으로 받습니다
    landmarker.detect(off);
  } catch (e) {
    // 실패하더라도 워밍업 목적이라 무시
    console.warn("warmUpOnce detect(image) failed:", e);
  }
  await landmarker.setOptions({ runningMode: "VIDEO" });
}
