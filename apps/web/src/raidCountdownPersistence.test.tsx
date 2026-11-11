// @vitest-environment jsdom
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type DashboardStateResp } from "@drop2empire/api-client";
import { WastelandRaidPanel } from "./WastelandRaidPanel";
import type { ServerUpdate } from "./serverState";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

interface MountedView {
  container: HTMLDivElement;
  rerender: (ui: ReactElement) => void;
  unmount: () => void;
}

const activeMounts: MountedView[] = [];

function mountView(ui: ReactElement): MountedView {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | null = createRoot(container);
  act(() => {
    root?.render(ui);
  });
  const handle: MountedView = {
    container,
    rerender(nextUi: ReactElement) {
      act(() => {
        root?.render(nextUi);
      });
    },
    unmount() {
      if (!root) return;
      const current = root;
      root = null;
      act(() => {
        current.unmount();
      });
      container.remove();
    },
  };
  activeMounts.push(handle);
  return handle;
}

function buildActiveRaidState(
  overrides: Partial<
    NonNullable<DashboardStateResp["raidLoadout"]["activeSession"]>
  > = {},
): DashboardStateResp {
  const width = 5;
  const height = 5;
  const tiles = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let kind = "floor";
      if (x === 3 && y === 2) kind = "extract_deep";
      if (x === 2 && y === 2) kind = "chest_wood";
      tiles.push({
        x,
        y,
        kind,
        looted: false,
        enemyHp: 0,
        enemyMaxHp: 0,
        enemyAtk: 0,
      });
    }
  }

  return {
    revision: 12,
    equippedCosmetics: {
      avatarFrame: "",
      lordCoat: "",
      bannerTint: "",
      relicAura: "",
    },
    resources: {
      water: 10000,
      wood: 10000,
      charcoal: 5000,
      stone: 5000,
      flint: 2000,
      food: 10000,
      iron: 0,
      tools: 0,
      weapons: 0,
    },
    raidLoadout: {
      equippedWeapon: "",
      equippedArmor: "",
      equippedBoots: "",
      equippedSafeBox: "",
      equippedPotions: ["", ""],
      ownedGear: [],
      ownedCosmetics: [],
      consumableStocks: {},
      totalAtk: 15,
      totalDef: 6,
      totalMaxHp: 120,
      backpackCapacity: 8,
      safeSlotCount: 2,
      moveCooldownMs: 320,
      draftCandidates: [],
      selectedBuffs: [],
      activeSession: {
        raidId: "raid-persist-1",
        lastCommandSeq: 3,
        currentZoneId: 0,
        playerX: 1,
        playerY: 2,
        facing: "right",
        hp: 105,
        maxHp: 120,
        atk: 15,
        def: 6,
        timeRemainingMs: 60_000,
        galeRemainingMs: 40_000,
        scavRemainingMs: 20_000,
        channelRemainingMs: 0,
        effectiveMoveCooldownMs: 320,
        cheatDeathActive: false,
        usedPotionKeys: [],
        backpack: [],
        safeBox: [],
        activeChestDrops: [],
        activeContainerTitle: "",
        logs: ["进入荒原斥候远征"],
        zones: [
          {
            id: 0,
            name: "黑曜裂谷外围",
            width,
            height,
            tiles,
          },
        ],
        ...overrides,
      },
    },
  } as unknown as DashboardStateResp;
}

describe("Issue #15: raid countdown & buff persistence across scene switches", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-11T08:00:00.000Z"));
  });

  afterEach(() => {
    while (activeMounts.length > 0) {
      activeMounts.pop()?.unmount();
    }
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("Repro 1: preserves elapsed raid countdown, gale buff, and scav buff across unmount/remount with zero network fetches", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const finishRaidSpy = vi.spyOn(api, "finishRaid");
    const runAction = vi.fn(async (fn: () => Promise<ServerUpdate>) => {
      await fn();
    });

    const raidSyncedAtMs = Date.now();
    const snapshot = buildActiveRaidState({
      timeRemainingMs: 60_000,
      galeRemainingMs: 40_000,
      scavRemainingMs: 20_000,
    });

    const firstMount = mountView(
      <WastelandRaidPanel
        state={snapshot}
        raidSyncedAtMs={raidSyncedAtMs}
        runAction={runAction}
      />,
    );

    expect(firstMount.container.textContent).toContain("沙暴倒计时60.0s");
    expect(firstMount.container.textContent).toContain("疾行 40.0s");
    expect(firstMount.container.textContent).toContain("速搜 20.0s");

    // Stay in raid scene for 5s -> 55s remaining
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(firstMount.container.textContent).toContain("沙暴倒计时55.0s");

    // Switch to settlement scene (unmounts WastelandRaidPanel while polling is paused)
    firstMount.unmount();

    // Spend 30s in settlement scene with ZERO network requests (total 35s elapsed)
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    // Return to scout scene with the same cached snapshot & raidSyncedAtMs
    const remount = mountView(
      <WastelandRaidPanel
        state={snapshot}
        raidSyncedAtMs={raidSyncedAtMs}
        runAction={runAction}
      />,
    );

    // Must immediately show 25.0s (never reset to 60.0s), gale 5.0s (40 - 35), scav expired (20 - 35 <= 0)
    expect(remount.container.textContent).not.toContain("沙暴倒计时60.0s");
    expect(remount.container.textContent).toContain("沙暴倒计时25.0s");
    expect(remount.container.textContent).toContain("疾行 5.0s");
    expect(remount.container.textContent).not.toContain("速搜");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(finishRaidSpy).not.toHaveBeenCalled();
    expect(runAction).not.toHaveBeenCalled();

    // Continues ticking down smoothly from 25.0s -> 24.0s
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(remount.container.textContent).toContain("沙暴倒计时24.0s");
  });

  it("Repro 2: immediately shows 0.0s and triggers finishRaid(MIA) once when returning after countdown expired away", async () => {
    const settledState = buildActiveRaidState();
    settledState.raidLoadout.activeSession = undefined;

    const finishRaidSpy = vi
      .spyOn(api, "finishRaid")
      .mockResolvedValue(settledState);

    let latestState = buildActiveRaidState({
      timeRemainingMs: 60_000,
      galeRemainingMs: 40_000,
      scavRemainingMs: 20_000,
    });
    const raidSyncedAtMs = Date.now();

    const runAction = vi.fn(async (fn: () => Promise<ServerUpdate>) => {
      const next = await fn();
      latestState = {
        ...latestState,
        raidLoadout: next.raidLoadout,
      };
    });

    // Render for 35s -> 25s remaining, then unmount
    const firstMount = mountView(
      <WastelandRaidPanel
        state={latestState}
        raidSyncedAtMs={raidSyncedAtMs}
        runAction={runAction}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(35_000);
    });
    expect(firstMount.container.textContent).toContain("沙暴倒计时25.0s");
    firstMount.unmount();

    // Advance 30s past the remaining 25s while in another scene (total 65s > 60s)
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(finishRaidSpy).not.toHaveBeenCalled();

    // Remount raid panel: must immediately display 0.0s (never reset to 60.0s) and settle MIA once
    const remount = mountView(
      <WastelandRaidPanel
        state={latestState}
        raidSyncedAtMs={raidSyncedAtMs}
        runAction={runAction}
      />,
    );

    expect(remount.container.textContent).not.toContain("沙暴倒计时60.0s");
    expect(remount.container.textContent).toContain("沙暴倒计时0.0s");

    await act(async () => {
      await Promise.resolve();
    });

    expect(finishRaidSpy).toHaveBeenCalledTimes(1);
    expect(finishRaidSpy).toHaveBeenCalledWith({
      raidId: "raid-persist-1",
      commandSeq: 4,
      status: "MIA",
    });

    // Even if more interval ticks fire before parent state swaps out, finishRaid is not spammed
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(finishRaidSpy).toHaveBeenCalledTimes(1);
  });

  it("recomputes countdown and buffs immediately on tab visibilitychange after background timer throttling", async () => {
    const settledState = buildActiveRaidState();
    settledState.raidLoadout.activeSession = undefined;
    const finishRaidSpy = vi
      .spyOn(api, "finishRaid")
      .mockResolvedValue(settledState);
    const runAction = vi.fn(async (fn: () => Promise<ServerUpdate>) => {
      await fn();
    });

    const raidSyncedAtMs = Date.now();
    const snapshot = buildActiveRaidState({
      timeRemainingMs: 60_000,
      galeRemainingMs: 40_000,
      scavRemainingMs: 20_000,
    });

    const view = mountView(
      <WastelandRaidPanel
        state={snapshot}
        raidSyncedAtMs={raidSyncedAtMs}
        runAction={runAction}
      />,
    );
    expect(view.container.textContent).toContain("沙暴倒计时60.0s");

    // Simulate browser suspending setInterval in background tab while wall clock jumps +35s
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    act(() => {
      vi.setSystemTime(raidSyncedAtMs + 35_000);
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(view.container.textContent).toContain("沙暴倒计时25.0s");
    expect(view.container.textContent).toContain("疾行 5.0s");
    expect(view.container.textContent).not.toContain("速搜");
    expect(finishRaidSpy).not.toHaveBeenCalled();

    // Jump wall clock past deadline (+30s more) and return to visible tab -> immediate 0.0s + MIA
    await act(async () => {
      vi.setSystemTime(raidSyncedAtMs + 65_000);
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    expect(view.container.textContent).toContain("沙暴倒计时0.0s");
    expect(finishRaidSpy).toHaveBeenCalledTimes(1);
    expect(finishRaidSpy).toHaveBeenCalledWith({
      raidId: "raid-persist-1",
      commandSeq: 4,
      status: "MIA",
    });
  });

  it("anchors extraction channelRemainingMs to raidSyncedAtMs across scene switches", async () => {
    const settledState = buildActiveRaidState();
    settledState.raidLoadout.activeSession = undefined;
    const finishRaidSpy = vi
      .spyOn(api, "finishRaid")
      .mockResolvedValue(settledState);
    const runAction = vi.fn(async (fn: () => Promise<ServerUpdate>) => {
      await fn();
    });

    const raidSyncedAtMs = Date.now();
    const snapshot = buildActiveRaidState({
      playerX: 3,
      playerY: 2,
      timeRemainingMs: 90_000,
      channelRemainingMs: 5_000,
    });

    // Advance 6s before remounting on extract_deep tile -> server channel window already completed
    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    const view = mountView(
      <WastelandRaidPanel
        state={snapshot}
        raidSyncedAtMs={raidSyncedAtMs}
        runAction={runAction}
      />,
    );

    const extractBtn = Array.from(
      view.container.querySelectorAll("button"),
    ).find(
      (btn) =>
        btn.textContent?.includes("撤离") &&
        !btn.textContent?.includes("放弃撤离"),
    );
    expect(extractBtn).toBeTruthy();

    await act(async () => {
      extractBtn?.click();
      await Promise.resolve();
    });

    expect(finishRaidSpy).toHaveBeenCalledTimes(1);
    expect(finishRaidSpy).toHaveBeenCalledWith({
      raidId: "raid-persist-1",
      commandSeq: 4,
      status: "EXTRACTED",
    });
  });

  it("does not start chest channeling when a move resyncs on 422 raid_sequence_conflict", async () => {
    const resyncedState = buildActiveRaidState({
      lastCommandSeq: 9,
      playerX: 2,
      playerY: 2,
      channelRemainingMs: 2_500,
    });

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: "raid_sequence_conflict",
            message: "sequence conflict",
            error: {
              code: "raid_sequence_conflict",
              message: "sequence conflict",
            },
          }),
          {
            status: 422,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(resyncedState), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    let pendingAction: Promise<void> = Promise.resolve();
    const runAction = vi.fn((fn: () => Promise<ServerUpdate>) => {
      pendingAction = fn().then(() => undefined);
      return pendingAction;
    });

    const raidSyncedAtMs = Date.now();
    const snapshot = buildActiveRaidState({
      playerX: 1,
      playerY: 2,
      timeRemainingMs: 60_000,
    });

    const view = mountView(
      <WastelandRaidPanel
        state={snapshot}
        raidSyncedAtMs={raidSyncedAtMs}
        runAction={runAction}
      />,
    );

    const stepRightBtn = Array.from(
      view.container.querySelectorAll("button"),
    ).find((btn) => btn.textContent?.includes("右移"));
    expect(stepRightBtn).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(400);
      stepRightBtn?.click();
      await Promise.resolve();
      await pendingAction;
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(view.container.textContent).not.toContain("正在搜索");
  });
});
