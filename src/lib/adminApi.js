const SESSION_KEY = "squat-map-admin-session-v1";

async function readErrorMessage(response, fallbackMessage) {
  try {
    const payload = await response.json();
    return payload?.message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export function isAdminAuthenticated() {
  if (typeof window === "undefined") return false;
  return Boolean(window.sessionStorage.getItem(SESSION_KEY));
}

export function getAdminSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function loginAdmin(username, password) {
  const response = await fetch("/api/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "admin login failed"));
  }

  const payload = await response.json();
  if (!payload.authenticated) return false;

  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username, password }));
  return true;
}

export function logoutAdmin() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_KEY);
}

function buildAdminHeaders(adminSession) {
  const session = adminSession ?? getAdminSession();
  if (!session?.username || !session?.password) {
    throw new Error("admin credentials missing");
  }

  return {
    "X-Admin-Username": session.username,
    "X-Admin-Password": session.password,
  };
}

export async function fetchReviewQueue(adminSession) {
  const response = await fetch("/api/admin/review-queue", {
    headers: buildAdminHeaders(adminSession),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "review queue fetch failed"));
  }

  const payload = await response.json();
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function approveReviewRecord(recordId, adminSession) {
  const response = await fetch(`/api/admin/review-queue/${recordId}/approve`, {
    method: "POST",
    headers: buildAdminHeaders(adminSession),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "review approve failed"));
  }

  const payload = await response.json();
  return Array.isArray(payload.items) ? payload.items : [];
}

export async function rejectReviewRecord(recordId, adminSession) {
  const response = await fetch(`/api/admin/review-queue/${recordId}/reject`, {
    method: "POST",
    headers: buildAdminHeaders(adminSession),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "review reject failed"));
  }

  const payload = await response.json();
  return Array.isArray(payload.items) ? payload.items : [];
}
