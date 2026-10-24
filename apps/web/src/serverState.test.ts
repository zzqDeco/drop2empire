import { describe, expect, it } from "vitest";
import type { DashboardStateResp, RaidSessionDTO, RaidUpdateResp, RaidZoneViewDTO } from "@drop2empire/api-client";
import { advanceChannelingProgress, belongsToSession, mergeServerUpdate } from "./serverState";

const zone = (id: number, exploredCount = 0) => ({ id, exploredCount, tiles: [] }) as unknown as RaidZoneViewDTO;
const state = (revision: number, raidId = "raid-b") => ({
  revision, player: { handle: "alice" },
  raidLoadout: { activeSession: { raidId, zones: [zone(0), zone(1)], playerX: 4 } },
}) as DashboardStateResp;
const update = (revision: number, raidId = "raid-b") => ({
  revision, playerHandle: "alice",
  raidLoadout: { activeSession: { raidId, zones: [zone(1, 12)], playerX: 5 } as RaidSessionDTO },
}) as RaidUpdateResp;

describe("authoritative response ordering", () => {
  it("accepts the login response establishing a new session but rejects responses after logout", () => {
    expect(belongsToSession({ ...state(12), sessionToken: "new" }, null, "new")).toBe(true);
    expect(belongsToSession(state(12), "old", null)).toBe(false);
    expect(belongsToSession(update(12), "old", "new")).toBe(false);
  });
  it("ignores delayed polling and raid replies from before the latest mutation", () => {
    const current = state(12);
    expect(mergeServerUpdate(current, state(11, "raid-a"))).toBe(current);
    expect(mergeServerUpdate(current, update(10, "raid-a"))).toBe(current);
  });
  it("retains previously visited zones while updating the current zone", () => {
    const merged = mergeServerUpdate(state(12), update(13));
    expect(merged?.raidLoadout.activeSession?.zones.map(z => z.exploredCount)).toEqual([0, 12]);
    expect(merged?.raidLoadout.activeSession?.playerX).toBe(5);
  });
  it("does not merge another account or revive state after logout", () => {
    const current = state(12);
    expect(mergeServerUpdate(null, update(13))).toBeNull();
    expect(mergeServerUpdate(current, { ...update(13), playerHandle: "bob" })).toBe(current);
  });
  it("clears active session on settlement and does not carry old zones into a new raid", () => {
    const completed = { ...update(13), raidLoadout: { ...update(13).raidLoadout, activeSession: undefined } };
    expect(mergeServerUpdate(state(12), completed)?.raidLoadout.activeSession).toBeUndefined();
    expect(mergeServerUpdate(state(12), update(13, "raid-c"))?.raidLoadout.activeSession?.zones.map(z => z.id)).toEqual([1]);
  });
  it("defers channel completion at 99% while an in-flight raid command is pending", () => {
    const ch = { startedAt: 1000, durationMs: 1100, progressPct: 50 };
    const held = advanceChannelingProgress(ch, 2200, true);
    expect(held?.progressPct).toBe(99);
    const completed = advanceChannelingProgress(held, 2300, false);
    expect(completed?.progressPct).toBe(100);
  });
});
