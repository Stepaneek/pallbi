import { describe, it, expect } from "vitest";
import { BLACK_DIAMETER_MM, appendZeroingShot, clockHour, corrections, formatClock, groupCenter, offsetMm, isTargetHit } from "@/lib/zeroing";

describe("zeroing", () => {
  it("counts prone shots on the 45 mm black centre boundary as hits and outside as misses", () => {
    expect(isTargetHit({ x: 22.5, y: 0 }, "prone")).toBe(true);
    expect(isTargetHit({ x: 22.51, y: 0 }, "prone")).toBe(false);
    expect(isTargetHit({ x: 20, y: 20 }, "prone")).toBe(false);
  });
  it("counts standing shots on the 115 mm black centre boundary as hits and outside as misses", () => {
    expect(isTargetHit({ x: 0, y: 57.5 }, "standing")).toBe(true);
    expect(isTargetHit({ x: 0, y: 57.51 }, "standing")).toBe(false);
  });
  it("black diameters are 45 mm prone and 115 mm standing", () => {
    expect(BLACK_DIAMETER_MM).toEqual({ prone: 45, standing: 115 });
  });
  it("accepts shots 1–10 and rejects the eleventh", () => {
    let shots: { x: number; y: number }[] = [];
    for (let i = 0; i < 10; i++) shots = appendZeroingShot(shots, { x: i, y: 0 });
    expect(shots).toHaveLength(10);
    expect(appendZeroingShot(shots, { x: 99, y: 99 })).toEqual(shots);
  });
  it("rounds clock direction to half hours", () => {
    expect(formatClock(clockHour({ x: 10, y: 10 }))).toBe("1:30");
  });
  it("group center is the mean of shots", () => {
    expect(groupCenter([{ x: 2, y: 4 }, { x: 4, y: 8 }])).toEqual({ x: 3, y: 6 });
  });
  it("offset distance", () => expect(offsetMm({ x: 3, y: 4 })).toBe(5));
  it("clock directions", () => {
    expect(clockHour({ x: 0, y: 10 })).toBe(12);
    expect(clockHour({ x: 10, y: 0 })).toBe(3);
    expect(clockHour({ x: 0, y: -10 })).toBe(6);
    expect(clockHour({ x: 10, y: 10 })).toBe(1.5);
  });
  it("high-right group → click down and left at 1.5 mm/click", () => {
    expect(corrections({ x: 4.5, y: 3 }, 1.5)).toEqual({ vertical: -2, horizontal: -3 });
  });
});
