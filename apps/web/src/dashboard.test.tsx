import { describe, expect, it } from "vitest";
import {
  formatClockMMSS,
  formatETA,
  formatGold,
  formatRate,
  formatResource,
} from "./format";

describe("Fixed-point numeric formatters (GDD 17.3)", () => {
  it("formats milli-resources and basis-gold without floating-point drift", () => {
    expect(formatResource(10000, 1)).toBe("10.0");
    expect(formatResource(20481000, 0)).toBe("20,481");
    expect(formatRate(2000)).toBe("+2.00/s");
    expect(formatRate(450)).toBe("+0.45/s");
    expect(formatGold(18500000, 2)).toBe("1,850.00");
  });

  it("formats ETA and clock strings deterministically", () => {
    expect(formatETA(0)).toBe("已就绪");
    expect(formatETA(-1)).toBe("需分配产出");
    expect(formatETA(42)).toBe("42s");
    expect(formatETA(148)).toBe("2m 28s");
    expect(formatClockMMSS(1798)).toBe("29:58");
  });
});
