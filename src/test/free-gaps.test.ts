import { describe, it, expect } from "vitest";
import { fillFreeGaps } from "@/lib/freeGaps";
import type { CalEvent } from "@/lib/events";

const ev = (s: string, e: string): CalEvent => ({ id: s, athlete_id: "a", event_type: "zavod", title: "X", start_date: s, end_date: e });

describe("fillFreeGaps", () => {
  it("fills days between events and up to range end", () => {
    const out = fillFreeGaps([ev("2026-11-08", "2026-11-22"), ev("2026-12-01", "2026-12-12")], "2026-11-06", "2026-12-15");
    const free = out.filter((e) => e.event_type === "volno").map((e) => [e.start_date, e.end_date]);
    expect(free).toEqual([
      ["2026-11-06", "2026-11-07"],
      ["2026-11-23", "2026-11-30"],
      ["2026-12-13", "2026-12-15"],
    ]);
  });
  it("adds no gap between back-to-back or overlapping events", () => {
    const out = fillFreeGaps([ev("2027-02-19", "2027-02-21"), ev("2027-02-22", "2027-02-28"), ev("2027-02-20", "2027-02-23")], "2027-02-19", "2027-02-28");
    expect(out.filter((e) => e.event_type === "volno")).toHaveLength(0);
  });
});
