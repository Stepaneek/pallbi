import type { SyncStatus } from "@/hooks/useStravaSync";

export const SILENT_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const RETRY_MS = 60 * 1000;

/** Browser lifecycle coordinator; only completed imports count as a successful sync. */
export function startSilentStravaSync(
  userId: string,
  sync: () => Promise<SyncStatus>,
) {
  const key = `pallbi.strava.lastSuccess:${userId}`;
  let stopped = false;
  let running = false;
  let retryAfter = 0;
  let lastSuccess = 0;
  try { lastSuccess = Number(localStorage.getItem(key)) || 0; } catch { /* private browsing */ }

  const check = async () => {
    const now = Date.now();
    if (stopped || running || document.visibilityState !== "visible" || !navigator.onLine) return;
    if (now < retryAfter || (lastSuccess > 0 && now - lastSuccess < SILENT_SYNC_INTERVAL_MS)) return;
    running = true;
    try {
      const result = await sync();
      if (result === "ok") {
        lastSuccess = Date.now();
        try { localStorage.setItem(key, String(lastSuccess)); } catch { /* use in-memory throttle */ }
      } else {
        retryAfter = Date.now() + RETRY_MS;
      }
    } catch {
      retryAfter = Date.now() + RETRY_MS;
    } finally {
      running = false;
    }
  };

  const start = window.setTimeout(check, 1000);
  const interval = window.setInterval(check, RETRY_MS);
  document.addEventListener("visibilitychange", check);
  window.addEventListener("pageshow", check);
  window.addEventListener("focus", check);
  window.addEventListener("online", check);
  return () => {
    stopped = true;
    window.clearTimeout(start);
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", check);
    window.removeEventListener("pageshow", check);
    window.removeEventListener("focus", check);
    window.removeEventListener("online", check);
  };
}