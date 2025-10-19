// src/components/VideoInput.jsx
import { useEffect, useRef, useState } from "react";
import { createLandmarker } from "../lib/pose";
import { diagnoseFrame, pushDepthFrame, summarizeDepth } from "../lib/depth";
import { TH } from "../config";

// 스켈레톤 연결 정의
const POSE_EDGES = [
  // 상체
  [11, 12], [11, 13], [12, 14], [13, 15], [14, 16], [15, 17], [16, 18],
  // 몸통
  [11, 23], [12, 24], [23, 24],
  // 다리
  [23, 25], [25, 27], [27, 29], [29, 31],
  [24, 26], [26, 28], [28, 30], [30, 32],
];

// 포즈 랜드마크 + 스켈레톤 그리기
function drawPose(
  ctx,
  lm,
  vw,
  vh,
  { ptR = 3, alpha = 0.9, visTh = 0.5, strokePx = 2 } = {}
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = strokePx;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // 연결선
  ctx.beginPath();
  for (const [a, b] of POSE_EDGES) {
    const pa = lm[a], pb = lm[b];
    if (!pa || !pb) continue;
    if ((pa.visibility ?? 1) < visTh || (pb.visibility ?? 1) < visTh) continue;
    const ax = pa.x * vw, ay = pa.y * vh;
    const bx = pb.x * vw, by = pb.y * vh;
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
  }
  ctx.strokeStyle = "rgba(0, 200, 255, 0.9)";
  ctx.stroke();

  // 포인트
  for (let i = 0; i < lm.length; i++) {
    const p = lm[i];
    if (!p) continue;
    if ((p.visibility ?? 1) < visTh) continue;
    const x = p.x * vw, y = p.y * vh;
    ctx.beginPath();
    ctx.arc(x, y, ptR, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 255, 120, 0.9)";
    ctx.fill();
  }
  ctx.restore();
}

export default function VideoInput() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const rafRef = useRef(0);
  const vfcIdRef = useRef(0);
  const urlRef = useRef(null);

  // 타임스탬프/타임라인 관리
  const lastTsRef = useRef(0);
  const lastMediaTimeRef = useRef(0);
  const anchorRef = useRef(0);
  const startPerfMsRef = useRef(0);
  const startMediaSRef = useRef(0);

  const [, setLandmarker] = useState(null);
  const landmarkerRef = useRef(null);
  const landmarkerLoadRef = useRef(false);
  const depthSeriesRef = useRef([]);
  const [result, setResult] = useState(null);
  const [hint, setHint] = useState("파일을 선택하세요 (권장: H.264 MP4, 720p+)");
  const [lastDiag, setLastDiag] = useState(null);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitForDimensions(video, { tries = 30, delay = 33 } = {}) {
    for (let i = 0; i < tries; i++) {
      if (video.videoWidth > 0 && video.videoHeight > 0) return true;
      await sleep(delay);
    }
    return false;
  }

  async function startPlayback(video) {
    try {
      video.muted = true;
      video.playsInline = true;
      await video.play();
      return true;
    } catch (e) {
      console.warn("play() blocked by browser:", e);
      setHint("재생 버튼(▶)을 눌러주세요.");
      return false;
    }
  }

  function cancelLoops() {
    cancelAnimationFrame(rafRef.current);
    const v = videoRef.current;
    if (v?.cancelVideoFrameCallback && vfcIdRef.current) {
      try {
        v.cancelVideoFrameCallback(vfcIdRef.current);
      } catch {}
    }
  }

  function scheduleNextFrame() {
    const v = videoRef.current;
    if (!v) return;
    if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
      vfcIdRef.current = v.requestVideoFrameCallback(step);
    } else {
      rafRef.current = requestAnimationFrame((t) => step(t, null));
    }
  }

  function resetTimestamps() {
    startPerfMsRef.current = Math.round(performance.now());
    startMediaSRef.current = videoRef.current?.currentTime ?? 0;
    lastTsRef.current = 0;
    lastMediaTimeRef.current = 0;
  }

  async function resetLandmarkerIfNeeded() {
    const lm = landmarkerRef.current;
    if (!lm) return;
    try {
      await lm.reset?.();
      await lm.setOptions?.({ runningMode: "VIDEO" });
    } catch {}
  }

  async function recreateLandmarker() {
    if (landmarkerLoadRef.current) {
      // wait for ongoing creation
      while (landmarkerLoadRef.current) {
        await sleep(16);

      }
      return landmarkerRef.current;
    }

    landmarkerLoadRef.current = true;
    try {
      const current = landmarkerRef.current;
      try {
        await current?.close?.();
      } catch {}

      const fresh = await createLandmarker();
      landmarkerRef.current = fresh;
      setLandmarker(fresh);
      return fresh;
    } catch (err) {
      console.error(err);
      setHint("엔진 재초기화 실패: 콘솔 로그를 확인하세요.");
      return null;
    } finally {
      landmarkerLoadRef.current = false;
    }
  }

  function appendDepth(values) {
    if (!values.length) {
      const prev = depthSeriesRef.current;
      return prev.length ? prev[prev.length - 1] : null;
    }
    let merged = depthSeriesRef.current.concat(values);
    if (merged.length > 2000) {
      merged = merged.slice(-1000);
    }
    depthSeriesRef.current = merged;
    return merged[merged.length - 1] ?? null;
  }

  // 메인 루프 (rVFC 우선, rAF 폴백)
  const step = (_when, _metadata) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.ended) return;

    const vw = video.videoWidth | 0;
    const vh = video.videoHeight | 0;
    if (vw === 0 || vh === 0 || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      scheduleNextFrame();
      return;
    }

    // 안전한 timestamp 만들기
    let mediaS = typeof _metadata?.mediaTime === "number" ? _metadata.mediaTime : video.currentTime;

    if (mediaS < lastMediaTimeRef.current) {
      resetLandmarkerIfNeeded();
      resetTimestamps();
      lastMediaTimeRef.current = mediaS;
    }

    let ts = Math.round(
      (mediaS - startMediaSRef.current) * 1000 + (startPerfMsRef.current - anchorRef.current)
    );
    if (ts <= lastTsRef.current) ts = lastTsRef.current + 1; // 단조 증가

    lastTsRef.current = ts;
    lastMediaTimeRef.current = mediaS;

    const lmInstance = landmarkerRef.current;
    if (!lmInstance) {
      scheduleNextFrame();
      return;
    }

    let res;
    try {
      res = lmInstance.detectForVideo(video, ts);
    } catch (err) {
      console.error("detectForVideo error", err);
      scheduleNextFrame();
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(vw * dpr);
    const targetH = Math.round(vh * dpr);
    if (canvas.width !== targetW) canvas.width = targetW;
    if (canvas.height !== targetH) canvas.height = targetH;

    const rect = video.getBoundingClientRect();
    const cssW = `${rect.width || vw}px`;
    const cssH = `${rect.height || vh}px`;
    if (canvas.style.width !== cssW) canvas.style.width = cssW;
    if (canvas.style.height !== cssH) canvas.style.height = cssH;

    const ctx = canvas.getContext("2d");
    ctx.save();
    if (ctx.resetTransform) ctx.resetTransform();
    else ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const landmarks = res.landmarks ?? res.poseLandmarks ?? [];
    const fontPx = Math.round(Math.min(48, Math.max(20, vw * 0.05)));
    const textX = Math.round(Math.max(12, vw * 0.02));
    const textY = textX;

    if (landmarks.length) {
      const lm = landmarks[0];

      // 스켈레톤/포인트 오버레이
      const scaleBase = Math.min(vw, vh) || 1;
      const ptR = Math.max(4, Math.min(10, scaleBase * 0.01));
      const strokePx = Math.max(2, ptR * 0.6);
      drawPose(ctx, lm, vw, vh, { ptR, visTh: 0.5, strokePx });

      // 진단/깊이계산
      const diag = diagnoseFrame(lm, vw, vh);
      setLastDiag(diag);

      const next = [];
      pushDepthFrame(lm, vw, vh, next);
      const last = appendDepth(next);

      // HUD 텍스트

      ctx.fillStyle = last == null ? "orange" : last >= TH ? "green" : "red";
      ctx.font = `${fontPx}px system-ui`;
      ctx.textBaseline = "top";
      ctx.fillText(
        last == null
          ? `UNSURE (${diag?.reason || "?"})`
          : `depth_ratio: ${last.toFixed(2)} (${diag?.reason || "ok"})`,
        textX,
        textY
      );
    } else {
      appendDepth([null]);
      setLastDiag({ ok: false, reason: "no-pose" });
      ctx.fillStyle = "orange";
      ctx.font = `${fontPx}px system-ui`;
      ctx.textBaseline = "top";
      ctx.fillText("No pose / UNSURE", textX, textY);
    }

    ctx.restore();
    scheduleNextFrame();
  };

  // 엔진 로딩 + 정리
  useEffect(() => {
    let cancelled = false;
    landmarkerLoadRef.current = true;
    (async () => {
      try {
        const lm = await createLandmarker();
        if (cancelled) {
          await lm?.close?.();
          return;
        }
        landmarkerRef.current = lm;
        setLandmarker(lm);
      } catch (e) {
        console.error(e);
        setHint("엔진 로드 실패: 콘솔 로그를 확인하세요.");
      } finally {
        landmarkerLoadRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
      cancelLoops();
      const v = videoRef.current;
      if (v?.srcObject) {
        v.srcObject.getTracks().forEach((t) => t.stop());
        v.srcObject = null;
      }
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      landmarkerRef.current?.close?.();
      landmarkerRef.current = null;
    };
  }, []);

  // 파일 선택 처리
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    cancelLoops();
    setHint("엔진 초기화 중…");

    const freshLandmarker = await recreateLandmarker();
    if (!freshLandmarker) {
      return;
    }

    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    const url = URL.createObjectURL(file);
    urlRef.current = url;

    setResult(null);
    depthSeriesRef.current = [];
    setLastDiag(null);
    setHint("재생 중…");

    const v = videoRef.current;
    v.srcObject = null;
    v.src = url;

    anchorRef.current = Math.round(performance.now());
    resetTimestamps();

    v.onseeked = async () => {
      await resetLandmarkerIfNeeded();
      resetTimestamps();
    };
    v.onplay = () => {
      anchorRef.current = Math.round(performance.now());
      resetTimestamps();
    };

    v.oncanplay = async () => {
      cancelLoops();
      const okDims = await waitForDimensions(v);
      const played = await startPlayback(v);
      if (okDims && played) {
        scheduleNextFrame();
      } else {
        setHint("영상 해상도를 읽지 못했습니다. 다른 파일(권장: H.264 MP4/720p+)로 시도해 주세요.");
      }
    };

    v.onended = () => {
      cancelLoops();
      const r = summarizeDepth(depthSeriesRef.current);
      setResult(r);
      setHint("완료");
    };
  };

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <div>
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={onFile}
        />
        <div style={{ position: "relative", marginTop: 8 }}>
          <video
            ref={videoRef}
            controls
            playsInline
            style={{ maxWidth: 560, width: "100%" }}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          />
        </div>
        <div style={{ marginTop: 8, color: "#666" }}>
          {hint}
          {lastDiag ? (
            <div style={{ marginTop: 4 }}>
              reason: <b>{lastDiag.reason}</b>
              {lastDiag.side != null && <> · side(px): {Math.round(lastDiag.side)}</>}
              {lastDiag.femur != null && <> · femur(px): {Math.round(lastDiag.femur)}</>}
              {lastDiag.depth != null && <> · depth: {lastDiag.depth.toFixed(2)}</>}
            </div>
          ) : null}
        </div>
      </div>

      <pre
        style={{
          minWidth: 260,
          maxWidth: 420,
          color:
            result?.summary === "PASS"
              ? "green"
              : result?.summary === "FAIL"
              ? "red"
              : "orange",
        }}
      >
{result ? `SUMMARY: ${result.summary}
PASS: ${result.pass} | FAIL: ${result.fail}
TH: ${result.threshold} | HOLD: ${result.hold}
max depth_ratio: ${result.depthRatioMax?.toFixed?.(2) ?? '-'}
` : "Ready."}
      </pre>
    </div>
  );
}