import { describe, expect, it } from "vitest";
import type {
  DashboardStateResp,
  RaidSessionDTO,
  RaidUpdateResp,
  RaidZoneViewDTO,
  ResourceLineDTO,
} from "@drop2empire/api-client";
import {
  advanceChannelingProgress,
  applySnapshotUpdate,
  belongsToSession,
  mergeServerUpdate,
} from "./serverState";

const zone = (id: number, exploredCount = 0) =>
  ({ id, exploredCount, tiles: [] }) as unknown as RaidZoneViewDTO;

const state = (
  revision: number,
  raidId = "raid-b",
  waterMilli = 1000,
) =>
  ({
    revision,
    player: { handle: "alice" },
    resources: [{ key: "water", amountMilli: waterMilli } as ResourceLineDTO],
    raidLoadout: {
      activeSession: { raidId, zones: [zone(0), zone(1)], playerX: 4 },
    },
  }) as DashboardStateResp;

const update = (revision: number, raidId = "raid-b", playerX = 5) =>
  ({
    revision,
    playerHandle: "alice",
    raidLoadout: {
      activeSession: {
        raidId,
        zones: [zone(1, 12)],
        playerX,
      } as RaidSessionDTO,
    },
  }) as RaidUpdateResp;

describe("authoritative response ordering", () => {
  it("accepts the login response establishing a new session but rejects responses after logout", () => {
    expect(
      belongsToSession({ ...state(12), sessionToken: "new" }, null, "new"),
    ).toBe(true);
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
    expect(
      merged?.raidLoadout.activeSession?.zones.map((z) => z.exploredCount),
    ).toEqual([0, 12]);
    expect(merged?.raidLoadout.activeSession?.playerX).toBe(5);
  });

  it("does not merge another account or revive state after logout", () => {
    const current = state(12);
    expect(mergeServerUpdate(null, update(13))).toBeNull();
    expect(
      mergeServerUpdate(current, { ...update(13), playerHandle: "bob" }),
    ).toBe(current);
  });

  it("clears active session on settlement and does not carry old zones into a new raid", () => {
    const completed = {
      ...update(13),
      raidLoadout: { ...update(13).raidLoadout, activeSession: undefined },
    };
    expect(
      mergeServerUpdate(state(12), completed)?.raidLoadout.activeSession,
    ).toBeUndefined();
    expect(
      mergeServerUpdate(state(12), update(13, "raid-c"))?.raidLoadout
        .activeSession?.zones.map((z) => z.id),
    ).toEqual([1]);
  });

  it("merges delayed full dashboard inventory when raid delta already advanced revision (#17)", () => {
    const rev10 = state(10, "raid-b", 1000);
    const afterRaid12 = mergeServerUpdate(rev10, update(12, "raid-b", 7));
    expect(afterRaid12?.revision).toBe(12);
    expect(afterRaid12?.raidLoadout.activeSession?.playerX).toBe(7);

    // Delayed rev11 full response arrives with updated water=2000 but older raid playerX=4
    const rev11Full = state(11, "raid-b", 2000);
    const merged = mergeServerUpdate(afterRaid12, rev11Full);
    expect(merged?.revision).toBe(12);
    expect(merged?.resources[0].amountMilli).toBe(2000);
    expect(merged?.raidLoadout.activeSession?.playerX).toBe(7);

    // Stale rev10 or rev11 duplicate after merge is ignored
    expect(mergeServerUpdate(merged, state(10, "raid-b", 500))).toBe(merged);
    expect(mergeServerUpdate(merged, state(11, "raid-b", 2000))).toBe(merged);
  });

  it("does not resurrect an ended raid when a pre-settlement full snapshot arrives late (#17)", () => {
    const rev10 = state(10, "raid-b", 1000);
    const settled12: RaidUpdateResp = {
      revision: 12,
      playerHandle: "alice",
      raidLoadout: {
        ...rev10.raidLoadout,
        activeSession: undefined,
      },
    };
    const afterSettle = mergeServerUpdate(rev10, settled12);
    expect(afterSettle?.raidLoadout.activeSession).toBeUndefined();

    const lateRev11 = state(11, "raid-b", 2000);
    const merged = mergeServerUpdate(afterSettle, lateRev11);
    expect(merged?.resources[0].amountMilli).toBe(2000);
    expect(merged?.raidLoadout.activeSession).toBeUndefined();
  });

  it("preserves lastSyncAtMs when a stale full snapshot is rejected (#20)", () => {
    const snap10 = applySnapshotUpdate(
      null,
      state(10, "raid-b", 1000),
      "tok-alice",
      5000,
    );
    expect(snap10?.lastSyncAtMs).toBe(5000);

    const afterStale9 = applySnapshotUpdate(
      snap10,
      state(9, "raid-b", 900),
      "tok-alice",
      5900,
    );
    expect(afterStale9).toBe(snap10);
    expect(afterStale9?.lastSyncAtMs).toBe(5000);
  });

  it("defers channel completion at 99% while an in-flight raid command is pending", () => {
    const ch = { startedAt: 1000, durationMs: 1100, progressPct: 50 };
    const held = advanceChannelingProgress(ch, 2200, true);
    expect(held?.progressPct).toBe(99);
    const completed = advanceChannelingProgress(held, 2300, false);
    expect(completed?.progressPct).toBe(100);
  });
});
