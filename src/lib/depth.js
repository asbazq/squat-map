// src/lib/depth.js
import { VIS_TH, TH, HOLD, SIDE_PX, SIDE_RATIO } from "../config";

// --- landmark indices (MediaPipe) ---
const LHIP=23, RHIP=24, LKNEE=25, RKNEE=26, LSHOULDER=11, RSHOULDER=12, LANKLE=27, RANKLE=28;
const PROFILE_SIDE_RATIO = 0.6; // allow slightly lower px when depth spread is strong

// --- helpers ---
function visiblePoint(lm, idx, W, H){
  const p = lm?.[idx];
  if (!p || (p.visibility ?? 1) < VIS_TH) return null;
  return { x: p.x * W, y: p.y * H };
}
function measureLeg(lm, hipIdx, kneeIdx, W, H){
  const hip = visiblePoint(lm, hipIdx, W, H);
  const knee = visiblePoint(lm, kneeIdx, W, H);
  if (!hip || !knee) return null;
  const femur = Math.hypot(hip.x - knee.x, hip.y - knee.y);
  if (!femur) return null;
  const depthRaw = hip.y - knee.y;
  const signed = depthRaw / femur;
  // Normalize so standing is near 0 and depth increases as hip descends.
  const depth = Math.max(0, signed + 1);
  return { femur, depth };
}
function pickBestLeg(lm, W, H){
  const right = measureLeg(lm, RHIP, RKNEE, W, H);
  const left  = measureLeg(lm, LHIP, LKNEE, W, H);
  if (!right && !left) return null;
  if (!right) return { side:"left", ...left };
  if (!left)  return { side:"right", ...right };
  return right.femur >= left.femur
    ? { side:"right", ...right }
    : { side:"left", ...left };
}
function sideScore(lm, W, H){
  const pairs = [
    [LSHOULDER, RSHOULDER],
    [LHIP, RHIP],
    [LANKLE, RANKLE]
  ];

  const scale = Math.max(W || 0, H || 0, 1);
  let dxMax = 0;
  let dzMax = 0;
  let ratioMax = 0;

  for (const [aIdx, bIdx] of pairs) {
    const a = lm?.[aIdx];
    const b = lm?.[bIdx];
    if (!a || !b) continue;
    const dxPx = Math.abs((a.x ?? 0) - (b.x ?? 0)) * (W || scale);
    const dzPx = Math.abs((a.z ?? 0) - (b.z ?? 0)) * scale * 5;
    dxMax = Math.max(dxMax, dxPx);
    dzMax = Math.max(dzMax, dzPx);
    const ratio = dxPx / (dzPx + 1); // prefer big horizontal spread with shallow depth difference
    ratioMax = Math.max(ratioMax, ratio);
  }

  return { dx: dxMax, dz: dzMax, ratio: ratioMax };
}

function profileDepthSpreadPx(lm, W, H) {
  const pairs = [
    [LSHOULDER, RSHOULDER],
    [LHIP, RHIP],
    [LANKLE, RANKLE]
  ];
  const scale = Math.max(W || 0, H || 0, 1);
  let spread = 0;
  for (const [aIdx, bIdx] of pairs) {
    const a = lm?.[aIdx];
    const b = lm?.[bIdx];
    if (!a || !b) continue;
    const dzPx = Math.abs((a.z ?? 0) - (b.z ?? 0)) * scale * 5;
    spread = Math.max(spread, dzPx);
  }
  return spread;
}

// --- main depth streaming ---
export function pushDepthFrame(landmarks, W, H, out){
  if (!landmarks?.length){ out.push(null); return; }
  const side = sideScore(landmarks, W, H);
  const profilePx = profileDepthSpreadPx(landmarks, W, H);
  const sideOk = (side.dx >= SIDE_PX && side.ratio >= SIDE_RATIO) || profilePx >= SIDE_PX * PROFILE_SIDE_RATIO;
  if (!sideOk){ out.push(null); return; }
  const leg = pickBestLeg(landmarks, W, H);
  out.push(leg && Number.isFinite(leg.depth) ? leg.depth : null);
}

// --- debug/diagnostic info for overlay ---
export function diagnoseFrame(lm, W, H){
  if (!lm?.length) return { ok:false, reason:"no-pose" };

  const side = sideScore(lm, W, H);
  const profilePx = profileDepthSpreadPx(lm, W, H);
  const sideOk = (side.dx >= SIDE_PX && side.ratio >= SIDE_RATIO) || profilePx >= SIDE_PX * PROFILE_SIDE_RATIO;
  if (!sideOk) return { ok:false, reason:"side-too-small", side, profilePx };

  const leg = pickBestLeg(lm, W, H);
  if (!leg) return { ok:false, reason:"low-visibility", side };

  if (!Number.isFinite(leg.depth) || !Number.isFinite(leg.femur)){
    return { ok:false, reason:"insufficient-points", side };
  }

  return { ok:true, reason:"ok", side, profilePx, femur: leg.femur, depth: leg.depth };
}

// --- smoother & robust rep summarizer ---
function median5(a,i){
  const w=[a[i-2],a[i-1],a[i],a[i+1],a[i+2]].filter(v=>v!=null).slice().sort((x,y)=>x-y);
  if (w.length<3) return a[i];
  return w[(w.length/2)|0];
}
function ma3(a,i){
  const w=[a[i-1],a[i],a[i+1]].filter(v=>v!=null);
  if (!w.length) return null;
  return w.reduce((s,v)=>s+v,0)/w.length;
}

export function summarizeDepth(series, opts={}){
  const TH_HIGH = opts.TH_HIGH ?? TH;           // pass threshold
  const TH_LOW  = opts.TH_LOW  ?? (TH * 0.85);  // hysteresis lower
  const HOLD_N  = opts.HOLD_N  ?? HOLD;         // hold frames
  const MIN_GAP = opts.MIN_GAP ?? 12;           // cooldown frames
  const MIN_PROM= opts.MIN_PROM?? 0.04;         // min peak prominence

  if (!series.length) {
    return {
      summary: "UNSURE",
      pass: 0,
      fail: 0,
      unsure: 0,
      reps: [],
      threshold: TH_HIGH,
      hold: HOLD_N
    };
  }

  // 1) smoothing: median5 -> ma3
  const s = series.slice();
  for (let i=0;i<s.length;i++){
    if (s[i]==null) continue;
    const m = i>1 && i<s.length-2 ? median5(s,i) : s[i];
    s[i] = m;
  }
  const t = s.map((v,i)=> (v==null? null : (i>0 && i<s.length-1 ? ma3(s,i): v)));

  let pass = 0, fail = 0, unsure = 0;
  let depthMax = null;
  const reps = [];

  // 2) peak detection with hysteresis & prominence
  for (let i=2; i<t.length-2; i++){
    const w = [t[i-2],t[i-1],t[i],t[i+1],t[i+2]];
    const c = t[i];
    if (c==null) continue;
    const isPeak = w.every((v,idx)=> idx===2 || v==null || c >= v);
    if (!isPeak) continue;
    if (c < TH_LOW) continue;

    const L = Math.max(0, i-10), R = Math.min(t.length-1, i+10);
    let leftMin=Infinity, rightMin=Infinity;
    for (let k=L; k<i; k++) if (t[k]!=null) leftMin = Math.min(leftMin, t[k]);
    for (let k=i+1; k<=R; k++) if (t[k]!=null) rightMin= Math.min(rightMin, t[k]);
    const base = Math.max(isFinite(leftMin)?leftMin:0, isFinite(rightMin)?rightMin:0);
    const prom = c - base;
    if (prom < MIN_PROM) continue;

    let hold=0;
    for (let k=i-2; k<=i+2; k++){
      const v = t[k];
      if (v!=null && v >= TH_LOW) hold++;
    }

    let status;
    if (c >= TH_HIGH && hold >= HOLD_N) status = "PASS";
    else if (hold >= Math.max(1, HOLD_N - 1)) status = "FAIL";
    else status = "UNSURE";

    reps.push({
      index: reps.length + 1,
      frame: i,
      status,
      peak: c,
      hold
    });

    if (status === "PASS") pass++;
    else if (status === "FAIL") fail++;
    else unsure++;

    depthMax = depthMax == null ? c : Math.max(depthMax, c);
    i += status === "PASS" ? MIN_GAP : Math.max(4, (MIN_GAP / 2) | 0);
  }

  if (depthMax == null) {
    for (const v of t) {
      if (v != null) {
        depthMax = depthMax == null ? v : Math.max(depthMax, v);
      }
    }
  }

  let summary;
  if (pass > 0 && fail === 0 && unsure === 0) summary = "PASS";
  else if (pass > 0 || fail > 0) summary = "MIXED";
  else summary = depthMax != null ? "FAIL" : "UNSURE";

  return {
    summary,
    pass,
    fail,
    unsure,
    reps,
    threshold: TH_HIGH,
    hold: HOLD_N,
    depthRatioMax: depthMax ?? undefined
  };
}


