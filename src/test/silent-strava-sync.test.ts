import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startSilentStravaSync, SILENT_SYNC_INTERVAL_MS } from "@/lib/silentStravaSync";

describe("silent automatic Strava sync", () => {
  let stop: (() => void) | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T14:04:00Z"));
    localStorage.clear();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });
  afterEach(() => { stop?.(); stop = undefined; vi.restoreAllMocks(); vi.useRealTimers(); });

  it("imports on opening without pressing Profile sync", async () => {
    const sync = vi.fn().mockResolvedValue("ok");
    localStorage.setItem("strava_last_silent_sync", String(Date.now()));
    stop = startSilentStravaSync("athlete", sync);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("does not count a failed attempt as success and retries after a minute", async () => {
    const sync = vi.fn().mockResolvedValueOnce("error").mockResolvedValue("ok");
    stop = startSilentStravaSync("athlete", sync);
    await vi.advanceTimersByTimeAsync(1000);
    expect(localStorage.getItem("pallbi.strava.lastSuccess:athlete")).toBeNull();
    await vi.advanceTimersByTimeAsync(120000);
    expect(sync).toHaveBeenCalledTimes(2);
    expect(Number(localStorage.getItem("pallbi.strava.lastSuccess:athlete"))).toBeGreaterThan(0);
  });

  it.each(["pageshow", "focus", "online"])("checks on mobile resume event %s", async (event) => {
    const sync = vi.fn().mockResolvedValue("ok");
    stop = startSilentStravaSync("athlete", sync);
    await vi.advanceTimersByTimeAsync(1000);
    vi.setSystemTime(Date.now() + SILENT_SYNC_INTERVAL_MS);
    window.dispatchEvent(new Event(event));
    await vi.advanceTimersByTimeAsync(0);
    expect(sync).toHaveBeenCalledTimes(2);
  });

  it("never overlaps syncs or syncs while hidden/offline", async () => {
    const sync = vi.fn(() => new Promise<"ok">(() => {}));
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    stop = startSilentStravaSync("athlete", sync);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sync).not.toHaveBeenCalled();
    online.mockReturnValue(true);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    window.dispatchEvent(new Event("online"));
    expect(sync).not.toHaveBeenCalled();
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(120000);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it("keeps successful cooldowns separate for each account", async () => {
    localStorage.setItem("pallbi.strava.lastSuccess:other", String(Date.now()));
    const sync = vi.fn().mockResolvedValue("ok");
    stop = startSilentStravaSync("athlete", sync);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sync).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("focus"));
    expect(sync).toHaveBeenCalledTimes(1);
  });
});