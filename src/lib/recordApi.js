import { DEFAULT_REGION, REGIONS } from "./records";

async function readErrorMessage(response, fallbackMessage) {
  try {
    const payload = await response.json();
    return payload?.message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

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

export async function fetchRecords() {
  const response = await fetch("/api/records");
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "records fetch failed"));
  }

  const payload = await response.json();
  return Array.isArray(payload) ? sortByCreatedDesc(payload.map(normalizeRecord)) : [];
}

export async function createRecord(record) {
  const response = await fetch("/api/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nickname: record.nickname,
      region: record.region,
      recordKg: record.recordKg,
      notes: record.notes,
      verification: record.verification,
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "record save failed"));
  }

  return normalizeRecord(await response.json());
}

export async function uploadReviewVideo(recordId, file) {
  if (!recordId || !file) {
    throw new Error("review video upload requires recordId and file");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`/api/records/${recordId}/review-video`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "review video upload failed"));
  }

  return response.json();
}

export async function removeRecord(recordId, adminSession) {
  if (!recordId || !adminSession?.username || !adminSession?.password) {
    throw new Error("admin credentials missing");
  }

  const response = await fetch(`/api/records/${recordId}`, {
    method: "DELETE",
    headers: {
      "X-Admin-Username": adminSession.username,
      "X-Admin-Password": adminSession.password,
    },
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "record delete failed"));
  }
}
