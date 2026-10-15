import { describe, it, expect } from "vitest";
import { computeReadiness } from "@/lib/readiness";

describe("computeReadiness", () => {
  it("returns null when nothing is filled", () => {
    expect(computeReadiness({})).toBeNull();
  });

  it("HR only: score comes purely from HR deviation, flagged hrOnly", () => {
    const r = computeReadiness({ morningHr: 55, baselineHr: 50 });
    expect(r).not.toBeNull();
    expect(r!.hrOnly).toBe(true);
    expect(r!.score).toBe(50); // 70 - 5*4
  });

  it("HR only at baseline gives neutral 70", () => {
    const r = computeReadiness({ morningHr: 50, baselineHr: 50 });
    expect(r!.score).toBe(70);
    expect(r!.hrOnly).toBe(true);
  });

  it("subjective only: average of ratings, not flagged hrOnly", () => {
    const r = computeReadiness({ sleep: 1, fatigue: 1, soreness: 1 });
    expect(r!.score).toBe(100);
    expect(r!.hrOnly).toBe(false);
  });

  it("full data: 50% HR + 50% subjective average", () => {
    // HR at baseline -> 70; all ratings best -> 100; result = 85
    const r = computeReadiness({ morningHr: 50, baselineHr: 50, sleep: 1, fatigue: 1, soreness: 1 });
    expect(r!.score).toBe(85);
    expect(r!.hrOnly).toBe(false);
  });

  it("missing subjective values never get a default — partial ratings average only filled ones", () => {
    const r = computeReadiness({ sleep: 5 }); // worst sleep only -> 0
    expect(r!.score).toBe(0);
    expect(r!.level).toBe("alert");
  });
});
