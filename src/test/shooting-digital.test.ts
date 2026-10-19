import { describe, expect, it } from "vitest";
import { collectDigitalShootingEntries, collectShootingEntries, missDistribution, shootingStats } from "@/lib/shooting";

describe("digital shooting analytics", () => {
  const entries = collectDigitalShootingEntries([{
    session_date: "2026-10-19", stance: "prone", intensity: "i3",
    shots: [{ x: 0, y: 0 }, { x: 22.5, y: 0 }, { x: 30, y: 0 }],
  }]);
  it("uses the actual shot count and calculates hit/miss percentages", () => {
    expect(shootingStats(entries)).toMatchObject({ shots: 3, hits: 2, misses: 1 });
    expect(shootingStats(entries).accuracy).toBeCloseTo(200 / 3);
  });
  it("carries training intensity into filters and the miss direction map", () => {
    expect(entries.filter(e => e.intensity === "i3")).toHaveLength(1);
    expect(entries.filter(e => e.intensity === "i1")).toHaveLength(0);
    expect(missDistribution(entries)[3]).toBe(1);
  });
  it("combines digital entries with five-shot block sets without inventing timings", () => {
    const blockEntries = collectShootingEntries([{ block_date: "2026-10-19", shooting_sets: [{ stance: "standing", misses: 1, total_seconds: 25 }] }]);
    expect(shootingStats([...entries, ...blockEntries])).toMatchObject({ shots: 8, hits: 6, misses: 2, accuracy: 75, avgFirstShot: null, avgTotal: 25 });
  });
  it("counts ten digital misses instead of capping them at five", () => {
    const allMisses = collectDigitalShootingEntries([{ session_date: "2026-10-19", stance: "standing", shots: Array.from({ length: 10 }, () => ({ x: 60, y: 0 })) }]);
    expect(shootingStats(allMisses)).toMatchObject({ shots: 10, misses: 10, hits: 0, accuracy: 0 });
  });
});