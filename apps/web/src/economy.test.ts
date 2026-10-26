import { afterEach, describe, expect, it, vi } from "vitest";
import { api, type DashboardStateResp } from "@drop2empire/api-client";
import { economyCommand, fixedInput } from "./economy";

afterEach(() => vi.restoreAllMocks());
describe("economy commands and fixed-point inputs", () => {
  it("parses decimal money exactly and rejects unsafe quantities", () => {
    expect(fixedInput("0.0001", 4)).toBe(1);
    expect(fixedInput("900719925474.0991", 4)).toBe(Number.MAX_SAFE_INTEGER);
    for (const value of [
      "-1",
      "Infinity",
      "1e12",
      "0.00001",
      "900719925474.0992",
    ])
      expect(() => fixedInput(value, 4)).toThrow();
  });
  it("fences IPO, crafting and votes with the authoritative shared command sequence", async () => {
    const call = vi
      .spyOn(api, "economyAction")
      .mockResolvedValue({} as DashboardStateResp);
    const state = { settlement: { commandSeq: 41 } } as DashboardStateResp;
    await economyCommand(state, "subscribe", {
      target: "alloy",
      quantity: 100,
      commandSeq: 1,
    });
    expect(call).toHaveBeenCalledWith(
      expect.objectContaining({
        commandSeq: 42,
        action: "subscribe",
        target: "alloy",
        quantity: 100,
      }),
    );
  });
});
