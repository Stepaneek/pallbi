import { describe, it, expect } from "vitest";
import { clockHour, corrections, groupCenter, offsetMm } from "@/lib/zeroing";

describe("zeroing", () => {
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
