// src/components/VideoInput.jsx
import { useEffect, useRef, useState } from "react";
import { createLandmarker } from "../lib/pose";
import { diagnoseFrame, pushDepthFrame, summarizeDepth } from "../lib/depth";
import { TH } from "../config";

// 얼굴 모자이크 구현 메모
// - 추적: MediaPipe PoseLandmarker의 detectForVideo(...) 결과 랜드마크 사용
// - 영역: FACE_IDXS 랜드마크로 얼굴 박스를 계산
// - 모자이크: Canvas 2D로 축소 후 재확대(imageSmoothingEnabled=false)하여 픽셀화
// - 참고: 별도 모자이크 전용 라이브러리는 사용하지 않음

// 스켈레톤 연결 정의
const POSE_EDGES = [
  [11, 12], [11, 13], [12, 14], [13, 15], [14, 16], [15, 17], [16, 18],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31],
  [24, 26], [26, 28], [28, 30], [30, 32],
];
const FOOT_IDXS = new Set([27, 28, 29, 30, 31, 32]);
const FACE_IDXS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// 포즈 랜드마크 + 스켈레톤 그리기
function drawPose(ctx, lm, vw, vh, { ptR = 3, alpha = 0.9, visTh = 0.5, strokePx = 2 } = {}) {
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

function drawFaceMosaic(ctx, source, lm, vw, vh, {
  visTh = 0.35,
  pixelSize = 14,
  padScale = 0.8,
  minBox = 36,
  scratchCanvas = null
} = {}) {
  // source: 원본 프레임(video/canvas), lm: pose landmarks
  // 다른 프로젝트에서도 detectForVideo 랜드마크만 있으면 재사용 가능
  if (!ctx || !source || !lm?.length || !vw || !vh) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const idx of FACE_IDXS) {
    const p = lm[idx];
    if (!p) continue;
    if ((p.visibility ?? 1) < visTh) continue;
    const x = p.x * vw;
    const y = p.y * vh;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return;

  const rawW = Math.max(minBox, maxX - minX);
  const rawH = Math.max(minBox, maxY - minY);
  const pad = Math.max(rawW, rawH) * padScale;

  const left = Math.max(0, Math.floor(minX - pad));
  const top = Math.max(0, Math.floor(minY - pad));
  const right = Math.min(vw, Math.ceil(maxX + pad));
  const bottom = Math.min(vh, Math.ceil(maxY + pad));
  const boxW = Math.max(1, right - left);
  const boxH = Math.max(1, bottom - top);

  const sampleW = Math.max(1, Math.floor(boxW / pixelSize));
  const sampleH = Math.max(1, Math.floor(boxH / pixelSize));

  const tmp = scratchCanvas || document.createElement("canvas");
  tmp.width = sampleW;
  tmp.height = sampleH;
  const tctx = tmp.getContext("2d");
  if (!tctx) return;
  tctx.imageSmoothingEnabled = false;
  tctx.clearRect(0, 0, sampleW, sampleH);
  tctx.drawImage(source, left, top, boxW, boxH, 0, 0, sampleW, sampleH);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, sampleW, sampleH, left, top, boxW, boxH);
  ctx.restore();
}

// 화면 표시 안정화용 스무딩 (판정 계산은 원본 랜드마크 사용)
function smoothLandmarksForRender(curr, prev, W, H) {
  if (!curr?.length) return null;
  if (!prev?.length) return curr.map((p) => ({ ...p }));

  const out = new Array(curr.length);
  const minDim = Math.max(1, Math.min(W || 1, H || 1));
  const footMaxJumpN = 72 / minDim;   // faster follow for foot motion
  const bodyMaxJumpN = 96 / minDim;   // reduce perceived lag on torso/arms

  for (let i = 0; i < curr.length; i++) {
    const c = curr[i];
    const p = prev[i];
    if (!c) { out[i] = c; continue; }
    if (!p) { out[i] = { ...c }; continue; }

    const isFoot = FOOT_IDXS.has(i);
    const alpha = isFoot ? 0.85 : 0.9; // high alpha = low latency
    const maxJump = isFoot ? footMaxJumpN : bodyMaxJumpN;

    let dx = (c.x ?? 0) - (p.x ?? 0);
    let dy = (c.y ?? 0) - (p.y ?? 0);
    const dist = Math.hypot(dx, dy);
    if (dist > maxJump && dist > 0) {
      const r = maxJump / dist;
      dx *= r;
      dy *= r;
    }

    const vis = c.visibility ?? 1;
    const prevVis = p.visibility ?? 1;
    const visAlphaBoost = vis < 0.5 || prevVis < 0.5 ? 0.95 : alpha;

    out[i] = {
      ...c,
      x: (p.x ?? 0) + visAlphaBoost * dx,
      y: (p.y ?? 0) + visAlphaBoost * dy,
      z: (p.z ?? 0) + visAlphaBoost * ((c.z ?? 0) - (p.z ?? 0)),
      visibility: c.visibility
    };
  }
  return out;
}

export default function VideoInput() {
  // DOM 요소 참조: video는 원본 재생, canvas는 스켈레톤/텍스트 오버레이
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // 루프/URL 관리용 ref: 렌더 루프 핸들, 업로드 URL, 다운로드 URL
  const rafRef = useRef(0);
  const urlRef = useRef(null);
  const downloadUrlRef = useRef(null);

  // 랜드마커 인스턴스와 분석 버퍼
  const [, setLandmarker] = useState(null);
  const landmarkerRef = useRef(null);
  const landmarkerLoadRef = useRef(false);
  const depthSeriesRef = useRef([]);
  const renderLmRef = useRef(null);
  const [result, setResult] = useState(null);
  const [hint, setHint] = useState("파일을 선택하거나, 아래 영역에 드래그해 주세요 (권장: H.264 MP4, 720p+)");
  const [lastDiag, setLastDiag] = useState(null);

  // 업로더 UI 상태
  const [fileLabel, setFileLabel] = useState("");
  const [drag, setDrag] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isFaceMosaic, setIsFaceMosaic] = useState(false);
  const isFaceMosaicRef = useRef(false);
  const lastDiagUpdateAtRef = useRef(0);
  const faceMosaicCanvasRef = useRef(null);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  useEffect(() => {
    isFaceMosaicRef.current = isFaceMosaic;
  }, [isFaceMosaic]);

  useEffect(() => {
    if (!faceMosaicCanvasRef.current) {
      faceMosaicCanvasRef.current = document.createElement("canvas");
    }
  }, []);

  // 일부 브라우저에서 metadata 이후에도 width/height가 0인 경우가 있어 재시도
  async function waitForDimensions(video, { tries = 30, delay = 33 } = {}) {
    for (let i = 0; i < tries; i++) {
      if (video.videoWidth > 0 && video.videoHeight > 0) return true;
      await sleep(delay);
    }
    return false;
  }

  function cancelLoops() {
    // 변경: 단일 rAF 루프만 사용하므로 여기서 루프를 명확히 중단
    cancelAnimationFrame(rafRef.current);
  }

  function scheduleNextFrame() {
    // 변경: requestVideoFrameCallback 대신 rAF 단일 경로로 통일 (replay 안정성)
    rafRef.current = requestAnimationFrame((t) => step(t, null));
  }

  function pickRecorderMimeType() {
    // 브라우저가 지원하는 webm 코덱을 우선순위대로 선택
    const list = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    for (const mime of list) {
      if (window.MediaRecorder?.isTypeSupported?.(mime)) return mime;
    }
    return "";
  }

  function sanitizeBaseName(name) {
    const base = (name || "video").replace(/\.[^.]+$/, "");
    return base.replace(/[\\/:*?"<>|]+/g, "_");
  }

  async function exportSkeletonVideo() {
    // 현재 업로드된 영상을 다시 재생하면서
    // "원본 영상 + 스켈레톤 + depth_ratio 텍스트"를 새 webm으로 녹화한다.
    if (isExporting) return;
    if (!urlRef.current) { setHint("먼저 영상을 업로드해 주세요."); return; }
    if (!window.MediaRecorder) { setHint("이 브라우저는 영상 내보내기를 지원하지 않습니다."); return; }

    setIsExporting(true);
    setHint("스켈레톤 영상 생성 중…");

    let exportLandmarker = null;
    let exportVideo = null;
    let exportCanvas = null;
    let exportRaf = 0;
    let lastExportDepth = null;

    try {
      exportLandmarker = await createLandmarker();
      exportVideo = document.createElement("video");
      exportVideo.src = urlRef.current;
      exportVideo.playsInline = true;
      exportVideo.muted = true;
      exportVideo.preload = "auto";

      await new Promise((resolve, reject) => {
        const cleanup = () => {
          exportVideo.onloadedmetadata = null;
          exportVideo.onerror = null;
        };
        exportVideo.onloadedmetadata = () => { cleanup(); resolve(); };
        exportVideo.onerror = () => { cleanup(); reject(new Error("video metadata load failed")); };
      });

      const vw = exportVideo.videoWidth | 0;
      const vh = exportVideo.videoHeight | 0;
      if (!vw || !vh) throw new Error("invalid export video dimensions");

      exportCanvas = document.createElement("canvas");
      exportCanvas.width = vw;
      exportCanvas.height = vh;
      const ctx = exportCanvas.getContext("2d");
      if (!ctx) throw new Error("failed to create export canvas context");

      const stream = exportCanvas.captureStream(30);
      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType, videoBitsPerSecond: 6_000_000 } : { videoBitsPerSecond: 6_000_000 }
      );
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
      const stopped = new Promise((resolve, reject) => {
        recorder.onstop = () => resolve();
        recorder.onerror = (e) => reject(e?.error || new Error("recorder failed"));
      });

      const finished = new Promise((resolve) => {
        exportVideo.onended = () => resolve();
      });

      const draw = () => {
        if (!exportVideo || exportVideo.paused || exportVideo.ended) return;

        const ts = Math.round(performance.now());
        let res = null;
        try { res = exportLandmarker.detectForVideo(exportVideo, ts); }
        catch (err) { console.error("export detectForVideo error", err); }

        ctx.clearRect(0, 0, vw, vh);
        ctx.drawImage(exportVideo, 0, 0, vw, vh);

        const landmarks = res?.landmarks ?? res?.poseLandmarks ?? [];
        const fontPx = Math.round(Math.min(48, Math.max(20, vw * 0.05)));
        const textX = Math.round(Math.max(12, vw * 0.02));
        const textY = textX;
        let showDepth = lastExportDepth;
        let reason = "no-pose";

        if (landmarks.length) {
          const lm = landmarks[0];
          if (isFaceMosaicRef.current) {
            drawFaceMosaic(ctx, exportCanvas, lm, vw, vh, { scratchCanvas: faceMosaicCanvasRef.current });
          }
          const scaleBase = Math.min(vw, vh) || 1;
          const ptR = Math.max(2, Math.min(7, scaleBase * 0.007));
          const strokePx = Math.max(1.5, ptR * 0.5);
          drawPose(ctx, lm, vw, vh, { ptR, visTh: 0.6, strokePx });

          const diag = diagnoseFrame(lm, vw, vh);
          reason = diag?.reason || "ok";
          const tmp = [];
          pushDepthFrame(lm, vw, vh, tmp);
          const last = tmp[tmp.length - 1] ?? null;
          if (last != null) lastExportDepth = last;
          showDepth = last ?? lastExportDepth;
        }

        // Always render depth text in exported video so it is visible on every frame.
        const label = showDepth == null
          ? `depth_ratio: - (${reason})`
          : `depth_ratio: ${showDepth.toFixed(2)} (${reason})`;
        ctx.font = `${fontPx}px system-ui`;
        ctx.textBaseline = "top";
        const padX = Math.round(fontPx * 0.4);
        const padY = Math.round(fontPx * 0.25);
        const tw = Math.ceil(ctx.measureText(label).width);
        const th = Math.ceil(fontPx * 1.25);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(textX - padX, textY - padY, tw + padX * 2, th + padY * 2);
        ctx.fillStyle = showDepth == null ? "orange" : showDepth >= TH ? "#4cff66" : "#ff5f5f";
        ctx.fillText(label, textX, textY);

        exportRaf = requestAnimationFrame(draw);
      };

      recorder.start();
      await exportVideo.play();
      draw();
      await finished;
      cancelAnimationFrame(exportRaf);
      if (recorder.state !== "inactive") recorder.stop();
      await stopped;

      const blobType = recorder.mimeType || "video/webm";
      const blob = new Blob(chunks, { type: blobType });
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrlRef.current;
      a.download = `${sanitizeBaseName(fileLabel)}_skeleton.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setHint("다운로드 완료");
    } catch (err) {
      console.error(err);
      setHint("영상 내보내기 실패: 콘솔 로그를 확인하세요.");
    } finally {
      cancelAnimationFrame(exportRaf);
      try { exportVideo?.pause?.(); } catch {}
      try { exportLandmarker?.close?.(); } catch {}
      setIsExporting(false);
    }
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
      // 이미 로딩 중이면 기다림
      while (landmarkerLoadRef.current) await sleep(16);
      return landmarkerRef.current;
    }
    landmarkerLoadRef.current = true;
    try {
      const current = landmarkerRef.current;
      try { await current?.close?.(); } catch {}
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
    // 분석 프레임 결과를 누적하고, 메모리 증가를 막기 위해 길이를 제한한다.
    if (!values.length) {
      const prev = depthSeriesRef.current;
      return prev.length ? prev[prev.length - 1] : null;
    }
    let merged = depthSeriesRef.current.concat(values);
    if (merged.length > 2000) merged = merged.slice(-1000);
    depthSeriesRef.current = merged;
    return merged[merged.length - 1] ?? null;
  }

  // 메인 루프 (rVFC 우선, rAF 폴백)
  const step = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended) return;

    try {
      const vw = video.videoWidth | 0;
      const vh = video.videoHeight | 0;
      if (vw === 0 || vh === 0 || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

      // 변경: 복잡한 mediaTime 보정 대신, 항상 증가하는 performance.now()를 timestamp로 사용
      // replay/seek 시점에도 detectForVideo가 끊기지 않도록 단순화
      const ts = Math.round(performance.now());

      const lmInstance = landmarkerRef.current;
      if (!lmInstance) return;

      let res;
      // 실시간 포즈 추론 진입점: 트래킹 성능에 가장 큰 영향을 주는 구간
      try { res = lmInstance.detectForVideo(video, ts); }
      catch (err) { console.error("detectForVideo error", err); return; }

      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
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
      if (!ctx) return;
      ctx.save();
      if (ctx.resetTransform) ctx.resetTransform();
      else ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 런타임/버전 차이로 필드명이 다를 수 있어 둘 다 지원
      const landmarks = res.landmarks ?? res.poseLandmarks ?? [];
      const fontPx = Math.round(Math.min(48, Math.max(20, vw * 0.05)));
      const textX = Math.round(Math.max(12, vw * 0.02));
      const textY = textX;

      if (landmarks.length) {
        const lm = landmarks[0];
        const lmForRender = smoothLandmarksForRender(lm, renderLmRef.current, vw, vh) ?? lm;
        renderLmRef.current = lmForRender;
        if (isFaceMosaicRef.current) {
          drawFaceMosaic(ctx, video, lmForRender, vw, vh, { scratchCanvas: faceMosaicCanvasRef.current });
        }

        // 스켈레톤/포인트
        const scaleBase = Math.min(vw, vh) || 1;
        const ptR = Math.max(2, Math.min(7, scaleBase * 0.007));
        const strokePx = Math.max(1.5, ptR * 0.5);
        drawPose(ctx, lmForRender, vw, vh, { ptR, visTh: 0.6, strokePx });

        // 진단/깊이
        const diag = diagnoseFrame(lm, vw, vh);
        const now = performance.now();
        if (now - lastDiagUpdateAtRef.current >= 120) {
          setLastDiag(diag);
          lastDiagUpdateAtRef.current = now;
        }
        const next = [];
        pushDepthFrame(lm, vw, vh, next);
        const last = appendDepth(next);

        ctx.fillStyle = last == null ? "orange" : last >= TH ? "green" : "red";
        ctx.font = `${fontPx}px system-ui`;
        ctx.textBaseline = "top";
        ctx.fillText(
          last == null
            ? `UNSURE (${diag?.reason || "?"})`
            : `depth_ratio: ${last.toFixed(2)} (${diag?.reason || "ok"})`,
          textX, textY
        );
      } else {
        renderLmRef.current = null;
        appendDepth([null]);
        setLastDiag({ ok: false, reason: "no-pose" });
        ctx.fillStyle = "orange";
        ctx.font = `${fontPx}px system-ui`;
        ctx.textBaseline = "top";
        ctx.fillText("No pose / UNSURE", textX, textY);
      }

      ctx.restore();
    } catch (err) {
      console.error("step loop error", err);
    } finally {
      // 변경: 프레임 처리 중 예외가 나도 루프가 죽지 않게 finally에서 다음 프레임 예약
      const v = videoRef.current;
      if (v && !v.paused && !v.ended) scheduleNextFrame();
    }
  };

  // 엔진 로딩 + 정리
  useEffect(() => {
    let cancelled = false;
    landmarkerLoadRef.current = true;
    (async () => {
      try {
        const lm = await createLandmarker();
        if (cancelled) { await lm?.close?.(); return; }
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
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
      if (downloadUrlRef.current) { URL.revokeObjectURL(downloadUrlRef.current); downloadUrlRef.current = null; }
      landmarkerRef.current?.close?.();
      landmarkerRef.current = null;
    };
  }, []);

  // 공통 파일 처리
  const handleFiles = async (files) => {
    // 업로드 시점에 이전 상태(루프/결과/버퍼)를 정리하고
    // 새 영상에 맞춰 이벤트 핸들러를 다시 연결한다.
    const file = files?.[0];
    if (!file) return;
    if (!file.type?.startsWith("video/")) {
      setHint("비디오 파일만 지원합니다."); return;
    }
    setFileLabel(file.name);

    cancelLoops();
    setHint("엔진 초기화 중…");

    const freshLandmarker = await recreateLandmarker();
    if (!freshLandmarker) return;

    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    const url = URL.createObjectURL(file);
    urlRef.current = url;

    setResult(null);
    depthSeriesRef.current = [];
    renderLmRef.current = null;
    setLastDiag(null);
    setHint("재생 중…");

    const v = videoRef.current;
    v.srcObject = null;
    v.src = url;

    v.onseeked = async () => {
      // 변경: seek 후 landmarker 상태를 리셋하고, 재생 중이면 루프를 다시 붙임
      await resetLandmarkerIfNeeded();
      if (!v.paused && !v.ended) {
        cancelLoops();
        scheduleNextFrame();
      }
    };
    const resumeTracking = async () => {
      // 변경: 재생 시작/재개(onplay, onplaying) 시 공통 루틴으로 루프 재시작
      if (v.currentTime <= 0.05) {
        // 변경: 시작 지점 재생이면 이전 결과를 비우고 새 측정을 시작
        depthSeriesRef.current = [];
        renderLmRef.current = null;
        setResult(null);
        setHint("재생 중…");
        await resetLandmarkerIfNeeded();
      }
      cancelLoops();
      scheduleNextFrame();
    };
    // 변경: 브라우저별 이벤트 차이를 흡수하기 위해 onplay + onplaying 둘 다 연결
    v.onplay = resumeTracking;
    v.onplaying = resumeTracking;
    // 변경: pause 시 루프 즉시 중단 (중복 루프/정지 프레임 잔상 방지)
    v.onpause = () => { cancelLoops(); };

    v.oncanplay = async () => {
      const okDims = await waitForDimensions(v);
      if (!okDims) setHint("영상 해상도를 읽지 못했습니다. 다른 파일(권장: H.264 MP4/720p+)로 시도해 주세요.");
      // 변경: 자동재생 제거. 사용자가 직접 재생(▶)하도록 유도해 이벤트 충돌 방지
      if (okDims) setHint("재생 버튼(▶)을 눌러주세요.");
    };

    v.onended = () => {
      // 재생 종료 시 누적 depth 시계열을 요약해 최종 판정을 만든다.
      cancelLoops();
      const r = summarizeDepth(depthSeriesRef.current);
      setResult(r);
      setHint("완료");
      // 변경: 결과는 유지하고 플레이헤드만 0으로 되돌려 replay 시작을 안정화
      v.currentTime = 0;
    };
  };

  // input 변경
  const onFile = async (e) => {
    await handleFiles(e.target.files);
    e.target.value = ""; // 같은 파일 재선택 가능하도록
  };

  // 드래그&드롭 핸들러
  const onDragOver = (e) => { e.preventDefault(); setDrag(true); };
  const onDragLeave = () => setDrag(false);
  const onDrop = async (e) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer?.files?.length) {
      await handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <div>
        {/* 업로더: 숨긴 input + label 버튼 + 파일명 */}
        <div className="uploader">
          <input
            id="videoFile"
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={onFile}
            className="uploader-input"
          />
          <label className="btn-upload" htmlFor="videoFile">영상 선택</label>
          <button
            type="button"
            className="btn-upload"
            onClick={exportSkeletonVideo}
            disabled={!urlRef.current || isExporting}
            style={{ marginLeft: 8, opacity: (!urlRef.current || isExporting) ? 0.6 : 1 }}
          >
            {isExporting ? "생성 중..." : "스켈레톤 다운로드"}
          </button>
          <button
            type="button"
            className="btn-upload"
            onClick={() => setIsFaceMosaic((prev) => !prev)}
            style={{ marginLeft: 8 }}
          >
            {isFaceMosaic ? "얼굴 모자이크 ON" : "얼굴 모자이크 OFF"}
          </button>
          <span className="file-name">{fileLabel || "선택된 파일이 없습니다"}</span>
        </div>

        {/* 드래그&드롭 존 */}
        <div
          className={`drop${drag ? " drag" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e)=>{ if(e.key === "Enter" || e.key === " ") document.getElementById("videoFile")?.click(); }}
          aria-label="여기로 영상을 드래그하거나, Enter로 파일 선택 열기"
        >
          <div className="drop-title">여기로 영상을 드래그하세요</div>
          <div className="drop-tip">또는 위의 <b>영상 선택</b> 버튼을 눌러 파일을 고르세요.</div>
          <div className="drop-accept">지원: mp4 / webm / mov, 권장 720p+</div>
        </div>

        <div style={{ position: "relative", marginTop: 8 }}>
          <video ref={videoRef} controls playsInline style={{ maxWidth: 560, width: "100%" }} />
          <canvas
            ref={canvasRef}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
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
          color: result?.summary === "PASS" ? "green" : result?.summary === "FAIL" ? "red" : "orange",
        }}
      >
{result ? `SUMMARY: ${result.summary}
PASS: ${result.pass} | FAIL: ${result.fail} | UNSURE: ${result.unsure ?? 0}
TH: ${result.threshold} | HOLD: ${result.hold}
max depth_ratio: ${result.depthRatioMax?.toFixed?.(2) ?? '-'}
${result.reps?.length ? `\n${result.reps.map((r) => `REP ${r.index}: ${r.status} (peak=${r.peak.toFixed(2)}, hold=${r.hold})`).join("\n")}` : "\nREP: none"}
` : "Ready."}
      </pre>
    </div>
  );
}
