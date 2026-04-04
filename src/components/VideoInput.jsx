import { useEffect, useRef, useState } from "react";
import { createLandmarker } from "../lib/pose";
import { diagnoseFrame, pushDepthFrame, summarizeDepth } from "../lib/depth";
import { TH } from "../config";

const POSE_EDGES = [
  [11, 12], [11, 13], [12, 14], [13, 15], [14, 16], [15, 17], [16, 18],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31],
  [24, 26], [26, 28], [28, 30], [30, 32],
];
const FOOT_IDXS = new Set([27, 28, 29, 30, 31, 32]);
const FACE_IDXS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function drawPose(ctx, lm, vw, vh, { ptR = 3, alpha = 0.9, visTh = 0.5, strokePx = 2 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = strokePx;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const [a, b] of POSE_EDGES) {
    const pa = lm[a];
    const pb = lm[b];
    if (!pa || !pb) continue;
    if ((pa.visibility ?? 1) < visTh || (pb.visibility ?? 1) < visTh) continue;
    ctx.moveTo(pa.x * vw, pa.y * vh);
    ctx.lineTo(pb.x * vw, pb.y * vh);
  }
  ctx.strokeStyle = "rgba(0, 200, 255, 0.9)";
  ctx.stroke();
  for (let i = 0; i < lm.length; i += 1) {
    const p = lm[i];
    if (!p || (p.visibility ?? 1) < visTh) continue;
    ctx.beginPath();
    ctx.arc(p.x * vw, p.y * vh, ptR, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 255, 120, 0.9)";
    ctx.fill();
  }
  ctx.restore();
}

function drawFaceMosaic(ctx, source, lm, vw, vh, { visTh = 0.35, pixelSize = 14, padScale = 0.8, minBox = 36, scratchCanvas = null } = {}) {
  if (!ctx || !source || !lm?.length || !vw || !vh) return;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const idx of FACE_IDXS) {
    const p = lm[idx];
    if (!p || (p.visibility ?? 1) < visTh) continue;
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

function smoothLandmarksForRender(curr, prev, W, H) {
  if (!curr?.length) return null;
  if (!prev?.length) return curr.map((p) => ({ ...p }));
  const out = new Array(curr.length);
  const minDim = Math.max(1, Math.min(W || 1, H || 1));
  const footMaxJumpN = 72 / minDim;
  const bodyMaxJumpN = 96 / minDim;
  for (let i = 0; i < curr.length; i += 1) {
    const c = curr[i];
    const p = prev[i];
    if (!c) { out[i] = c; continue; }
    if (!p) { out[i] = { ...c }; continue; }
    const isFoot = FOOT_IDXS.has(i);
    const alpha = isFoot ? 0.85 : 0.9;
    const maxJump = isFoot ? footMaxJumpN : bodyMaxJumpN;
    let dx = (c.x ?? 0) - (p.x ?? 0);
    let dy = (c.y ?? 0) - (p.y ?? 0);
    const dist = Math.hypot(dx, dy);
    if (dist > maxJump && dist > 0) {
      const ratio = maxJump / dist;
      dx *= ratio;
      dy *= ratio;
    }
    const vis = c.visibility ?? 1;
    const prevVis = p.visibility ?? 1;
    const visAlphaBoost = vis < 0.5 || prevVis < 0.5 ? 0.95 : alpha;
    out[i] = {
      ...c,
      x: (p.x ?? 0) + visAlphaBoost * dx,
      y: (p.y ?? 0) + visAlphaBoost * dy,
      z: (p.z ?? 0) + visAlphaBoost * ((c.z ?? 0) - (p.z ?? 0)),
      visibility: c.visibility,
    };
  }
  return out;
}

export default function VideoInput({ onAnalysisComplete }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const currentFileRef = useRef(null);
  const rafRef = useRef(0);
  const urlRef = useRef(null);
  const downloadUrlRef = useRef(null);
  const [, setLandmarker] = useState(null);
  const landmarkerRef = useRef(null);
  const landmarkerLoadRef = useRef(false);
  const depthSeriesRef = useRef([]);
  const renderLmRef = useRef(null);
  const [result, setResult] = useState(null);
  const [hint, setHint] = useState("파일을 선택하거나 아래 영역에 드래그해 주세요. 권장: 측면 60~90도");
  const [lastDiag, setLastDiag] = useState(null);
  const [fileLabel, setFileLabel] = useState("");
  const [drag, setDrag] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isFaceMosaic, setIsFaceMosaic] = useState(false);
  const isFaceMosaicRef = useRef(false);
  const lastDiagUpdateAtRef = useRef(0);
  const faceMosaicCanvasRef = useRef(null);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  useEffect(() => {
    isFaceMosaicRef.current = isFaceMosaic;
  }, [isFaceMosaic]);

  useEffect(() => {
    if (!faceMosaicCanvasRef.current) faceMosaicCanvasRef.current = document.createElement("canvas");
  }, []);

  async function waitForDimensions(video, { tries = 30, delay = 33 } = {}) {
    for (let i = 0; i < tries; i += 1) {
      if (video.videoWidth > 0 && video.videoHeight > 0) return true;
      await sleep(delay);
    }
    return false;
  }

  function cancelLoops() { cancelAnimationFrame(rafRef.current); }
  function scheduleNextFrame() { rafRef.current = requestAnimationFrame(() => step()); }

  function pickRecorderMimeType() {
    const list = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    for (const mime of list) if (window.MediaRecorder?.isTypeSupported?.(mime)) return mime;
    return "";
  }

  function sanitizeBaseName(name) {
    const base = (name || "video").replace(/\.[^.]+$/, "");
    return base.replace(/[\\/:*?"<>|]+/g, "_");
  }

  async function exportSkeletonVideo() {
    if (isExporting) return;
    if (!urlRef.current) { setHint("먼저 영상을 업로드해 주세요."); return; }
    if (!window.MediaRecorder) { setHint("이 브라우저는 영상 내보내기를 지원하지 않습니다."); return; }
    setIsExporting(true);
    setHint("스켈레톤 영상 생성 중...");
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
        const cleanup = () => { exportVideo.onloadedmetadata = null; exportVideo.onerror = null; };
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
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 6000000 } : { videoBitsPerSecond: 6000000 });
      const chunks = [];
      recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
      const stopped = new Promise((resolve, reject) => {
        recorder.onstop = () => resolve();
        recorder.onerror = (event) => reject(event?.error || new Error("recorder failed"));
      });
      const finished = new Promise((resolve) => { exportVideo.onended = () => resolve(); });
      const draw = () => {
        if (!exportVideo || exportVideo.paused || exportVideo.ended) return;
        const ts = Math.round(performance.now());
        let res = null;
        try { res = exportLandmarker.detectForVideo(exportVideo, ts); } catch (error) { console.error("export detectForVideo error", error); }
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
          if (isFaceMosaicRef.current) drawFaceMosaic(ctx, exportCanvas, lm, vw, vh, { scratchCanvas: faceMosaicCanvasRef.current });
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
        const label = showDepth == null ? `depth_ratio: - (${reason})` : `depth_ratio: ${showDepth.toFixed(2)} (${reason})`;
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
      const anchor = document.createElement("a");
      anchor.href = downloadUrlRef.current;
      anchor.download = `${sanitizeBaseName(fileLabel)}_skeleton.webm`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setHint("다운로드 완료");
    } catch (error) {
      console.error(error);
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
    try { await lm.reset?.(); await lm.setOptions?.({ runningMode: "VIDEO" }); } catch {}
  }

  async function recreateLandmarker() {
    if (landmarkerLoadRef.current) {
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
    } catch (error) {
      console.error(error);
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
    if (merged.length > 2000) merged = merged.slice(-1000);
    depthSeriesRef.current = merged;
    return merged[merged.length - 1] ?? null;
  }

  const step = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused || video.ended) return;
    try {
      const vw = video.videoWidth | 0;
      const vh = video.videoHeight | 0;
      if (vw === 0 || vh === 0 || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      const ts = Math.round(performance.now());
      const lmInstance = landmarkerRef.current;
      if (!lmInstance) return;
      let res;
      try { res = lmInstance.detectForVideo(video, ts); } catch (error) { console.error("detectForVideo error", error); return; }
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
      const targetW = Math.round(vw * dpr);
      const targetH = Math.round(vh * dpr);
      if (canvas.width !== targetW) canvas.width = targetW;
      if (canvas.height !== targetH) canvas.height = targetH;
      const boxW = video.clientWidth || vw;
      const boxH = video.clientHeight || vh;
      const videoAspect = vw / vh;
      const boxAspect = boxW / boxH;
      const drawW = boxAspect > videoAspect ? boxH * videoAspect : boxW;
      const drawH = boxAspect > videoAspect ? boxH : boxW / videoAspect;
      const parent = canvas.parentElement;
      const offsetLeft = parent ? Math.max(0, (parent.clientWidth - drawW) / 2) : 0;
      const offsetTop = parent ? Math.max(0, (parent.clientHeight - drawH) / 2) : 0;
      const cssW = `${drawW}px`;
      const cssH = `${drawH}px`;
      if (canvas.style.width !== cssW) canvas.style.width = cssW;
      if (canvas.style.height !== cssH) canvas.style.height = cssH;
      const cssLeft = `${offsetLeft}px`;
      const cssTop = `${offsetTop}px`;
      if (canvas.style.left !== cssLeft) canvas.style.left = cssLeft;
      if (canvas.style.top !== cssTop) canvas.style.top = cssTop;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
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
        const lmForRender = smoothLandmarksForRender(lm, renderLmRef.current, vw, vh) ?? lm;
        renderLmRef.current = lmForRender;
        if (isFaceMosaicRef.current) drawFaceMosaic(ctx, video, lmForRender, vw, vh, { scratchCanvas: faceMosaicCanvasRef.current });
        const scaleBase = Math.min(vw, vh) || 1;
        const ptR = Math.max(2, Math.min(7, scaleBase * 0.007));
        const strokePx = Math.max(1.5, ptR * 0.5);
        drawPose(ctx, lmForRender, vw, vh, { ptR, visTh: 0.6, strokePx });
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
        ctx.fillText(last == null ? `UNSURE (${diag?.reason || "?"})` : `depth_ratio: ${last.toFixed(2)} (${diag?.reason || "ok"})`, textX, textY);
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
    } catch (error) {
      console.error("step loop error", error);
    } finally {
      const v = videoRef.current;
      if (v && !v.paused && !v.ended) scheduleNextFrame();
    }
  };

  useEffect(() => {
    let cancelled = false;
    landmarkerLoadRef.current = true;
    (async () => {
      try {
        const lm = await createLandmarker();
        if (cancelled) { await lm?.close?.(); return; }
        landmarkerRef.current = lm;
        setLandmarker(lm);
      } catch (error) {
        console.error(error);
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
        v.srcObject.getTracks().forEach((track) => track.stop());
        v.srcObject = null;
      }
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
      if (downloadUrlRef.current) { URL.revokeObjectURL(downloadUrlRef.current); downloadUrlRef.current = null; }
      landmarkerRef.current?.close?.();
      landmarkerRef.current = null;
    };
  }, []);

  const handleFiles = async (files) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type?.startsWith("video/")) { setHint("비디오 파일만 지원합니다."); return; }
    currentFileRef.current = file;
    setFileLabel(file.name);
    cancelLoops();
    setHint("엔진 초기화 중...");
    const freshLandmarker = await recreateLandmarker();
    if (!freshLandmarker) return;
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    setResult(null);
    depthSeriesRef.current = [];
    renderLmRef.current = null;
    setLastDiag(null);
    setHint("재생 중...");
    const v = videoRef.current;
    v.srcObject = null;
    v.src = url;
    v.onseeked = async () => {
      await resetLandmarkerIfNeeded();
      if (!v.paused && !v.ended) { cancelLoops(); scheduleNextFrame(); }
    };
    const resumeTracking = async () => {
      if (v.currentTime <= 0.05) {
        depthSeriesRef.current = [];
        renderLmRef.current = null;
        setResult(null);
        setHint("재생 중...");
        await resetLandmarkerIfNeeded();
      }
      cancelLoops();
      scheduleNextFrame();
    };
    v.onplay = resumeTracking;
    v.onplaying = resumeTracking;
    v.onpause = () => { cancelLoops(); };
    v.oncanplay = async () => {
      const okDims = await waitForDimensions(v);
      setHint(okDims ? "재생 버튼을 눌러 분석을 시작하세요." : "영상 해상도를 읽지 못했습니다. 다른 파일로 다시 시도해 주세요.");
    };
    v.onended = () => {
      cancelLoops();
      const nextResult = summarizeDepth(depthSeriesRef.current);
      setResult(nextResult);
      onAnalysisComplete?.(nextResult, currentFileRef.current);
      setHint(nextResult.summary === "PASS" ? "풀스쿼트 인증 통과" : "기록 저장 전 PASS가 필요합니다.");
      v.currentTime = 0;
    };
  };

  const onFile = async (event) => {
    await handleFiles(event.target.files);
    event.target.value = "";
  };
  const onDragOver = (event) => { event.preventDefault(); setDrag(true); };
  const onDragLeave = () => setDrag(false);
  const onDrop = async (event) => {
    event.preventDefault();
    setDrag(false);
    if (event.dataTransfer?.files?.length) await handleFiles(event.dataTransfer.files);
  };

  const resultClassName = result?.summary === "PASS" ? "video-result pass" : result?.summary === "FAIL" ? "video-result fail" : "video-result";

  return (
    <div className="video-layout">
      <div className="video-actions">
        <div className="uploader">
          <input id="videoFile" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={onFile} className="uploader-input" />
          <label className="btn-upload" htmlFor="videoFile">영상 선택</label>
          <button type="button" className="btn-upload" onClick={exportSkeletonVideo} disabled={!urlRef.current || isExporting}>
            {isExporting ? "생성 중..." : "스켈레톤 다운로드"}
          </button>
          <button type="button" className="secondary-btn" onClick={() => setIsFaceMosaic((prev) => !prev)}>
            {isFaceMosaic ? "얼굴 모자이크 ON" : "얼굴 모자이크 OFF"}
          </button>
          <span className="file-name">{fileLabel || "선택된 파일이 없습니다"}</span>
        </div>
      </div>

      <div
        className={`drop${drag ? " drag" : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") document.getElementById("videoFile")?.click();
        }}
        aria-label="여기로 영상을 드래그하거나 Enter로 파일 선택 창을 여세요"
      >
        <div className="drop-title">여기로 스쿼트 영상을 드래그하세요</div>
        <div className="drop-tip">또는 위의 영상 선택 버튼으로 파일을 고르세요.</div>
        <div className="drop-accept">지원 형식: mp4 / webm / mov</div>
      </div>

      <div className="video-stage">
        <video ref={videoRef} controls playsInline />
        <canvas ref={canvasRef} />
      </div>

      <div className="video-meta">
        <div>{hint}</div>
        {lastDiag ? (
          <div>
            reason: <strong>{lastDiag.reason}</strong>
            {lastDiag.femur != null ? <> · femur(px): {Math.round(lastDiag.femur)}</> : null}
            {lastDiag.depth != null ? <> · depth: {lastDiag.depth.toFixed(2)}</> : null}
          </div>
        ) : null}
      </div>

      <pre className={resultClassName}>
{result ? `SUMMARY: ${result.summary}
PASS: ${result.pass} | FAIL: ${result.fail} | UNSURE: ${result.unsure ?? 0}
TH: ${result.threshold} | HOLD: ${result.hold}
max depth_ratio: ${result.depthRatioMax?.toFixed?.(2) ?? "-"}
${result.reps?.length ? `\n${result.reps.map((rep) => `REP ${rep.index}: ${rep.status} (peak=${rep.peak.toFixed(2)}, hold=${rep.hold})`).join("\n")}` : "\nREP: none"}
` : "Ready."}
      </pre>
    </div>
  );
}
