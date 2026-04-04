const DB_NAME = "squat-map-videos";
const STORE_NAME = "videos";
const DB_VERSION = 1;
const MAX_WIDTH = 480;
const MAX_HEIGHT = 854;
const TARGET_FPS = 18;
const TARGET_BITRATE = 450000;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run(mode, handler) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = handler(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error);
  });
}

function pickMimeType() {
  const candidates = [
    "video/webm;codecs=vp8",
    "video/webm",
    "video/webm;codecs=vp9",
  ];
  const probe = document.createElement("video");

  return candidates.find((mime) => (
    window.MediaRecorder?.isTypeSupported?.(mime) &&
    probe.canPlayType(mime.replace(";codecs=", "; codecs="))
  )) ?? "";
}

function loadVideoMetadata(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    video.onloadedmetadata = () => resolve({ video, cleanup });
    video.onerror = () => {
      cleanup();
      reject(new Error("video metadata load failed"));
    };
  });
}

function canPlayBlob(blob) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(blob);

    const done = (result) => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
      resolve(result);
    };

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    video.onloadedmetadata = () => done(true);
    video.onerror = () => done(false);
  });
}

function waitForPlayback(video) {
  return new Promise((resolve) => {
    video.onended = () => resolve();
  });
}

function fitSize(width, height) {
  const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height, 1);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

async function compressVideo(file) {
  if (!file || !file.type?.startsWith("video/")) return null;
  if (!window.MediaRecorder) return file;

  const { video, cleanup } = await loadVideoMetadata(file);
  const { width, height } = fitSize(video.videoWidth || MAX_WIDTH, video.videoHeight || MAX_HEIGHT);
  const mimeType = pickMimeType();
  if (!mimeType) {
    cleanup();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    cleanup();
    return file;
  }

  const stream = canvas.captureStream(TARGET_FPS);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: TARGET_BITRATE,
  });
  const chunks = [];

  recorder.ondataavailable = (event) => {
    if (event.data?.size) chunks.push(event.data);
  };

  const stopped = new Promise((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = (event) => reject(event?.error || new Error("video compression failed"));
  });

  let rafId = 0;
  const draw = () => {
    if (video.paused || video.ended) return;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(video, 0, 0, width, height);
    rafId = requestAnimationFrame(draw);
  };

  try {
    recorder.start(250);
    await video.play();
    draw();
    await waitForPlayback(video);
    cancelAnimationFrame(rafId);
    if (recorder.state !== "inactive") recorder.stop();
    await stopped;

    const blob = new Blob(chunks, { type: mimeType });
    if (!blob.size || blob.size < 1024) return file;
    return (await canPlayBlob(blob)) ? blob : file;
  } catch {
    return file;
  } finally {
    cancelAnimationFrame(rafId);
    try { video.pause(); } catch {}
    cleanup();
  }
}

export async function saveVideo(recordId, file) {
  if (!recordId || !file) return;
  const compressed = await compressVideo(file);
  await run("readwrite", (store) => store.put(compressed, recordId));
}

export async function getVideo(recordId) {
  if (!recordId) return null;
  return run("readonly", (store) => store.get(recordId));
}

export async function deleteVideo(recordId) {
  if (!recordId) return;
  await run("readwrite", (store) => store.delete(recordId));
}
