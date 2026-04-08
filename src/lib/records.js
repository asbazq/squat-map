const STORAGE_KEY = "squat-map-records-v3";

export const REGIONS = [
  "\uC11C\uC6B8",
  "\uACBD\uAE30",
  "\uC778\uCC9C",
  "\uAC15\uC6D0",
  "\uCDA9\uBD81",
  "\uCDA9\uB0A8",
  "\uC138\uC885",
  "\uB300\uC804",
  "\uACBD\uBD81",
  "\uB300\uAD6C",
  "\uC804\uBD81",
  "\uC804\uB0A8",
  "\uAD11\uC8FC",
  "\uACBD\uB0A8",
  "\uC6B8\uC0B0",
  "\uBD80\uC0B0",
  "\uC81C\uC8FC",
];

export const DEFAULT_REGION = "\uC11C\uC6B8";

export const REGION_COORDS = {
  "\uC11C\uC6B8": { lat: 37.5665, lng: 126.978 },
  "\uACBD\uAE30": { lat: 37.4138, lng: 127.5183 },
  "\uC778\uCC9C": { lat: 37.4563, lng: 126.7052 },
  "\uAC15\uC6D0": { lat: 37.8228, lng: 128.1555 },
  "\uCDA9\uBD81": { lat: 36.6357, lng: 127.4917 },
  "\uCDA9\uB0A8": { lat: 36.5184, lng: 126.8 },
  "\uC138\uC885": { lat: 36.48, lng: 127.289 },
  "\uB300\uC804": { lat: 36.3504, lng: 127.3845 },
  "\uACBD\uBD81": { lat: 36.4919, lng: 128.8889 },
  "\uB300\uAD6C": { lat: 35.8714, lng: 128.6014 },
  "\uC804\uBD81": { lat: 35.7175, lng: 127.153 },
  "\uC804\uB0A8": { lat: 34.8679, lng: 126.991 },
  "\uAD11\uC8FC": { lat: 35.1595, lng: 126.8526 },
  "\uACBD\uB0A8": { lat: 35.4606, lng: 128.2132 },
  "\uC6B8\uC0B0": { lat: 35.5384, lng: 129.3114 },
  "\uBD80\uC0B0": { lat: 35.1796, lng: 129.0756 },
  "\uC81C\uC8FC": { lat: 33.4996, lng: 126.5312 },
};

function normalizeRecord(record) {
  return {
    ...record,
    region: REGIONS.includes(record.region) ? record.region : DEFAULT_REGION,
    locationName: REGIONS.includes(record.region) ? record.region : DEFAULT_REGION,
    recordKg: Number(record.recordKg),
    latitude: null,
    longitude: null,
  };
}

function sortByCreatedDesc(records) {
  return [...records].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function migrateLegacyRecords(records) {
  return records.filter(Boolean).map((record) => {
    const fallbackRegion = deriveRegionFromCoords(Number(record.latitude), Number(record.longitude));
    const region = REGIONS.includes(record.region) ? record.region : fallbackRegion;
    return normalizeRecord({ ...record, region, locationName: region });
  });
}

export function deriveRegionFromCoords(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return DEFAULT_REGION;
  let bestRegion = DEFAULT_REGION;
  let bestDistance = Infinity;
  for (const [region, coords] of Object.entries(REGION_COORDS)) {
    const distance = Math.hypot(latitude - coords.lat, longitude - coords.lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRegion = region;
    }
  }
  return bestRegion;
}

export function loadRecords() {
  if (typeof window === "undefined") return [];
  try {
    const nextRaw = window.localStorage.getItem(STORAGE_KEY);
    if (nextRaw) {
      const parsed = JSON.parse(nextRaw);
      if (Array.isArray(parsed)) return sortByCreatedDesc(parsed.map(normalizeRecord));
    }
    const legacySources = ["squat-map-records-v2", "squat-map-records-v1"];
    for (const key of legacySources) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      const migrated = sortByCreatedDesc(migrateLegacyRecords(parsed));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return [];
  } catch {
    return [];
  }
}

function persistRecords(records) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function generateRecordId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }

  return `record-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function saveRecord(record) {
  const nextRecord = normalizeRecord({
    id: generateRecordId(),
    createdAt: new Date().toISOString(),
    ...record,
    locationName: record.region,
    latitude: null,
    longitude: null,
  });
  const current = loadRecords();
  const next = [nextRecord, ...current];
  persistRecords(next);
  return nextRecord;
}

export function deleteRecord(recordId) {
  if (typeof window === "undefined" || !recordId) return [];
  const next = loadRecords().filter((record) => record.id !== recordId);
  persistRecords(next);
  return next;
}

export function computeRankings(records) {
  const sorted = [...records].sort((a, b) => {
    if (b.recordKg !== a.recordKg) return b.recordKg - a.recordKg;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  return {
    national: sorted.slice(0, 10),
    byRegion: Object.fromEntries(REGIONS.map((region) => [region, sorted.filter((record) => record.region === region).slice(0, 10)])),
  };
}

export function computeRegionLeaders(records) {
  return REGIONS.map((region) => {
    const leader = [...records].filter((record) => record.region === region).sort((a, b) => b.recordKg - a.recordKg)[0];
    return leader ? { region, ...leader } : null;
  }).filter(Boolean);
}

export function buildSubmissionFromAnalysis(result) {
  if (!result) return null;
  return {
    canSubmit: result.summary === "PASS" || result.pass > 0,
    verification: {
      summary: result.summary,
      pass: result.pass,
      fail: result.fail,
      unsure: result.unsure ?? 0,
      depthRatioMax: result.depthRatioMax ?? null,
      reps: result.reps ?? [],
      threshold: result.threshold,
      hold: result.hold,
      verifiedAt: new Date().toISOString(),
    },
  };
}

export function getRegionPins(records) {
  return Object.fromEntries(REGIONS.map((region) => [region, sortByCreatedDesc(records.filter((record) => record.region === region))]));
}

export function getRegionMapData(records) {
  return REGIONS.map((region) => {
    const items = records.filter((record) => record.region === region);
    const leader = [...items].sort((a, b) => b.recordKg - a.recordKg)[0] ?? null;
    return {
      region,
      position: REGION_COORDS[region],
      count: items.length,
      leader,
      recent: sortByCreatedDesc(items).slice(0, 5),
    };
  });
}
