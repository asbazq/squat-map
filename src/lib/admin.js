const SESSION_KEY = "squat-map-admin-session-v1";
const REVIEW_QUEUE_KEY = "squat-map-admin-review-queue-v1";
const ADMIN_PASSWORD = "squat-admin-2026";

export function isAdminAuthenticated() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(SESSION_KEY) === "true";
}

export function loginAdmin(password) {
  if (password !== ADMIN_PASSWORD) return false;
  window.sessionStorage.setItem(SESSION_KEY, "true");
  return true;
}

export function logoutAdmin() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_KEY);
}

export function loadReviewQueue() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REVIEW_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveReviewQueue(queue) {
  window.localStorage.setItem(REVIEW_QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueReviewRecords(recordIds) {
  if (!recordIds.length) return loadReviewQueue();
  const current = loadReviewQueue();
  const merged = [...new Set([...recordIds, ...current])];
  saveReviewQueue(merged);
  return merged;
}

export function removeReviewRecord(recordId) {
  const next = loadReviewQueue().filter((id) => id !== recordId);
  saveReviewQueue(next);
  return next;
}
