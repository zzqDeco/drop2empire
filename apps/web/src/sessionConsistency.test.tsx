// @vitest-environment jsdom
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  type DashboardStateResp,
  type RaidUpdateResp,
} from "@drop2empire/api-client";
import { useGameSession } from "./hooks/useGameSession";
import { useLiveInterpolation } from "./hooks/useLiveInterpolation";
import { computeLiveWaterMetrics } from "./domain/settlementSelectors";

function makeDashboard(opts: {
  handle: string;
  revision: number;
  waterMilli?: number;
  waterNetRateMilli?: number;
  commandSeq?: number;
  facilityLevel?: number;
  raidPlayerX?: number;
  sessionToken?: string;
}): DashboardStateResp {
  return {
    revision: opts.revision,
    sessionToken: opts.sessionToken,
    player: {
      handle: opts.handle,
      isAdmin: false,
      populationTotal: 4,
      populationIdle: 2,
      housingCapacity: 8,
      goldBasis: 0,
      profession: "worker",
      professionName: "工匠",
      guildCode: "OBSIDIAN",
      guildName: "黑曜商会",
      activityPoints: 0,
      speedMultiplier: 1,
      simulatedElapsedSeconds: 60,
      totalManualClicks: 10,
      offlineAwardSummary: "",
    },
    resources: [
      {
        key: "water",
        name: "净水",
        tier: "basic",
        unlocked: true,
        amountMilli: opts.waterMilli ?? 1000,
        frozenMilli: 0,
        capacityMilli: 100_000,
        grossRatePerSecMilli: opts.waterNetRateMilli ?? 1000,
        drainRatePerSecMilli: 0,
        netRatePerSecMilli: opts.waterNetRateMilli ?? 1000,
        description: "",
      },
    ],
    settlement: {
      commandSeq: opts.commandSeq ?? 1,
      buildings: [],
      technologies: [],
      jobs: [],
      allocationPresets: [],
      edicts: [],
      expedition: {
        unlocked: false,
        active: false,
        remainingSeconds: 0,
        canClaim: false,
        summary: "",
        costs: [],
      },
      caravan: { unlocked: false, offers: [] },
      guideCode: "g1",
      guideTitle: "序章",
      guideText: "",
    },
    blueprints: [],
    installedEquipments: [],
    cosmetics: [],
    equippedCosmetics: {
      headgear: "",
      mantle: "",
      heldRelic: "",
      companion: "",
    },
    raidGears: [],
    raidLoadout: {
      weaponKey: "",
      armorKey: "",
      bootsKey: "",
      safeBoxKey: "",
      safeSlotCount: 2,
      equippedPotions: [],
      equippedBuffCards: [],
      draftPoolCards: [],
      rerollCosts: [],
      canReroll: false,
      totalMaxHp: 100,
      totalAtk: 10,
      totalDef: 2,
      moveCooldownMs: 300,
      raidDurationSeconds: 180,
      backpackCapacity: 8,
      activeSession:
        opts.raidPlayerX !== undefined
          ? ({
              raidId: "raid-1",
              lastCommandSeq: 1,
              channelRemainingMs: 0,
              currentZoneId: 0,
              playerX: opts.raidPlayerX,
              playerY: 1,
              facing: "right",
              hp: 100,
              maxHp: 100,
              atk: 10,
              def: 2,
              cheatDeathActive: false,
              timeRemainingMs: 60_000,
              effectiveMoveCooldownMs: 300,
              galeRemainingMs: 0,
              scavRemainingMs: 0,
              usedPotionKeys: [],
              backpack: [],
              safeBox: [],
              activeChestDrops: [],
              activeContainerTitle: "",
              logs: [],
              zonesVisitedCount: 1,
              chestsOpenedCount: 0,
              bossesKilledCount: 0,
              zones: [],
            } as NonNullable<DashboardStateResp["raidLoadout"]["activeSession"]>)
          : undefined,
    },
    collectibles: [],
    openOrders: [],
    marketSummaries: [],
    economy: {
      reserveBasis: 0,
      publicCashBasis: 0,
      corporateCashBasis: 0,
      ipoEscrowBasis: 0,
      cancelledBasis: 0,
      companies: [],
      events: [],
      professional: {
        facilityLevel: opts.facilityLevel ?? 0,
        facilityName: "工坊",
        consumables: [],
      },
    } as unknown as DashboardStateResp["economy"],
    macroLedger: {
      totalIssuedBasis: 0,
      playerHeldBasis: 0,
      escrowFrozenBasis: 0,
      npcHeldBasis: 0,
      treasuryHeldBasis: 0,
    },
    war: {
      seasonName: "S1",
      currentDay: 1,
      obsidianTotalScore: 0,
      argentTotalScore: 0,
      joinedGuildId: "",
      playerGuildName: "",
      playerGuildContribution: 0,
      dailyBudgetUsed: 0,
      dailyBudgetCap: 100,
      nextSettlementLabel: "",
      guilds: [],
      nodes: [],
      edges: [],
      settlementHistory: [],
    },
    seasonNotices: [],
    availableHandles: [opts.handle],
  } as unknown as DashboardStateResp;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("client session & state consistency (#14, #16, #17, #20)", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let container: HTMLDivElement;
  let root: Root | null = null;

  async function mount(ui: ReactElement) {
    await act(async () => {
      root = createRoot(container);
      root.render(ui);
    });
  }

  function byTestId(id: string): string {
    return container.querySelector(`[data-testid="${id}"]`)?.textContent ?? "";
  }

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-11T08:00:00Z"));
    fetchMock.mockReset();
    window.localStorage.clear();
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("blocks stale-account commands and reconciles session when another tab switches accounts (#14)", async () => {
    window.localStorage.setItem("d2e-session-token", "tok-alice");
    fetchMock.mockResolvedValueOnce(
      json(makeDashboard({ handle: "alice", revision: 1, waterMilli: 1000 })),
    );

    let sessionApi!: ReturnType<typeof useGameSession>;
    function Harness() {
      sessionApi = useGameSession(false);
      return (
        <div>
          <span data-testid="handle">
            {sessionApi.state?.player.handle ?? "none"}
          </span>
          <span data-testid="error">{sessionApi.errorBanner ?? ""}</span>
        </div>
      );
    }

    await mount(<Harness />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(byTestId("handle")).toBe("alice");

    // Simulate another tab switching localStorage to bob WITHOUT firing StorageEvent yet
    window.localStorage.setItem("d2e-session-token", "tok-bob");

    // Queue bob's dashboard for reconciliation
    fetchMock.mockResolvedValueOnce(
      json(makeDashboard({ handle: "bob", revision: 5, waterMilli: 9000 })),
    );

    // Attempt to execute gatherWater while UI still displays alice
    await act(async () => {
      await sessionApi.runAction(() => api.gatherWater({ clicks: 1 }));
      await Promise.resolve();
    });

    // Must NOT have called /empire/settlement/gather-water on bob's token!
    const calledPaths = fetchMock.mock.calls.map((c) => c[0]);
    expect(calledPaths).toEqual(["/api/v1/empire/state", "/api/v1/empire/state"]);
    expect(byTestId("handle")).toBe("bob");
    expect(byTestId("error")).toContain("会话");
  });

  it("reacts immediately to cross-tab StorageEvent logout and drops late old-account replies (#14)", async () => {
    window.localStorage.setItem("d2e-session-token", "tok-alice");
    fetchMock.mockResolvedValueOnce(
      json(makeDashboard({ handle: "alice", revision: 1 })),
    );

    let sessionApi!: ReturnType<typeof useGameSession>;
    function Harness() {
      sessionApi = useGameSession(false);
      return (
        <span data-testid="handle">
          {sessionApi.state?.player.handle ?? "logged-out"}
        </span>
      );
    }

    await mount(<Harness />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(byTestId("handle")).toBe("alice");

    let resolveSlowAction!: (resp: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveSlowAction = resolve;
        }),
    );

    let actionPromise!: Promise<void>;
    await act(async () => {
      actionPromise = sessionApi.runAction(() =>
        api.gatherWater({ clicks: 1 }),
      );
    });

    // Another tab logs out and fires StorageEvent
    await act(async () => {
      window.localStorage.removeItem("d2e-session-token");
      window.dispatchEvent(
        new StorageEvent("storage", { key: "d2e-session-token", newValue: null }),
      );
    });
    expect(byTestId("handle")).toBe("logged-out");

    // Late response from alice resolves after logout — must NOT revive alice
    await act(async () => {
      resolveSlowAction(json(makeDashboard({ handle: "alice", revision: 2 })));
      await actionPromise;
    });
    expect(byTestId("handle")).toBe("logged-out");
  });

  it("syncs authoritative state without showing false success notice on 422 sequence conflict (#16)", async () => {
    window.localStorage.setItem("d2e-session-token", "tok-alice");
    fetchMock.mockResolvedValueOnce(
      json(
        makeDashboard({
          handle: "alice",
          revision: 1,
          commandSeq: 1,
          facilityLevel: 0,
        }),
      ),
    );

    let sessionApi!: ReturnType<typeof useGameSession>;
    function Harness() {
      sessionApi = useGameSession(false);
      return (
        <div>
          <span data-testid="notice">{sessionApi.noticeBanner ?? ""}</span>
          <span data-testid="error">{sessionApi.errorBanner ?? ""}</span>
          <span data-testid="seq">
            {sessionApi.state?.settlement.commandSeq ?? 0}
          </span>
        </div>
      );
    }

    await mount(<Harness />);
    await act(async () => {
      await Promise.resolve();
    });

    fetchMock.mockResolvedValueOnce(
      json(
        {
          error: {
            code: "settlement_sequence_conflict",
            message: "建设状态已变化，请同步后重试",
          },
        },
        422,
      ),
    );
    fetchMock.mockResolvedValueOnce(
      json(
        makeDashboard({
          handle: "alice",
          revision: 2,
          commandSeq: 2,
          facilityLevel: 0,
        }),
      ),
    );

    await act(async () => {
      await sessionApi.runAction(
        () =>
          api.economyAction({
            commandSeq: 1,
            action: "build_facility",
            target: "",
            option: "",
            quantity: 0,
            voteId: 0,
            approve: false,
            plan: {
              route: "standard",
              activeLines: 1,
              askPriceBasis: 0,
              inputBudgetBasis: 0,
              pack: "",
              expandWith: "",
              dividendBasis: 0,
              capitalBudgetBasis: 0,
            },
          }),
        "职业设施已建成",
      );
    });

    expect(byTestId("seq")).toBe("2");
    expect(byTestId("notice")).toBe("");
    expect(byTestId("error")).toContain("原操作未执行");
  });

  it("preserves rev12 raid delta while applying delayed rev11 full inventory update (#17)", async () => {
    window.localStorage.setItem("d2e-session-token", "tok-alice");
    fetchMock.mockResolvedValueOnce(
      json(
        makeDashboard({
          handle: "alice",
          revision: 10,
          waterMilli: 1000,
          raidPlayerX: 1,
        }),
      ),
    );

    let sessionApi!: ReturnType<typeof useGameSession>;
    function Harness() {
      sessionApi = useGameSession(false);
      const water =
        sessionApi.state?.resources.find((r) => r.key === "water")
          ?.amountMilli ?? 0;
      const rx =
        sessionApi.state?.raidLoadout.activeSession?.playerX ?? -1;
      return (
        <div>
          <span data-testid="water">{water}</span>
          <span data-testid="rx">{rx}</span>
        </div>
      );
    }

    await mount(<Harness />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(byTestId("water")).toBe("1000");
    expect(byTestId("rx")).toBe("1");

    // rev12 raid delta arrives first
    const raidDelta12: RaidUpdateResp = {
      playerHandle: "alice",
      revision: 12,
      raidLoadout: {
        ...sessionApi.state!.raidLoadout,
        activeSession: {
          ...sessionApi.state!.raidLoadout.activeSession!,
          playerX: 5,
        },
      },
    };
    act(() => {
      sessionApi.applyServerState(raidDelta12);
    });
    expect(byTestId("rx")).toBe("5");

    // Delayed rev11 full snapshot arrives with water=2000 and older raidPlayerX=1
    act(() => {
      sessionApi.applyServerState(
        makeDashboard({
          handle: "alice",
          revision: 11,
          waterMilli: 2000,
          raidPlayerX: 1,
        }),
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });

    expect(byTestId("water")).toBe("2000");
    expect(byTestId("rx")).toBe("5");
  });

  it("does not reset resource interpolation clock when a stale snapshot is rejected (#20)", async () => {
    window.localStorage.setItem("d2e-session-token", "tok-alice");
    fetchMock.mockResolvedValueOnce(
      json(
        makeDashboard({
          handle: "alice",
          revision: 10,
          waterMilli: 1000,
          waterNetRateMilli: 1000,
        }),
      ),
    );

    let sessionApi!: ReturnType<typeof useGameSession>;
    function Harness() {
      sessionApi = useGameSession(false);
      const interpSec = useLiveInterpolation(
        sessionApi.lastSyncAtMs,
        sessionApi.state?.player.speedMultiplier ?? 1,
        Boolean(sessionApi.state),
      );
      const liveWater = sessionApi.state
        ? computeLiveWaterMetrics(sessionApi.state, false, 0, interpSec)
            .liveWaterMilli
        : 0;
      return <span data-testid="live-water">{liveWater}</span>;
    }

    await mount(<Harness />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(byTestId("live-water")).toBe("1000");

    // Advance 900ms (6 ticks of 150ms) -> 1000 + floor(1000 * 0.9) = 1900 milli
    await act(async () => {
      vi.advanceTimersByTime(900);
    });
    expect(Number(byTestId("live-water"))).toBe(1900);

    // Deliver delayed stale rev9 full snapshot
    act(() => {
      sessionApi.applyServerState(
        makeDashboard({
          handle: "alice",
          revision: 9,
          waterMilli: 800,
          waterNetRateMilli: 1000,
        }),
      );
    });

    // Must remain 1900 milli (never jump back to 1000)
    expect(Number(byTestId("live-water"))).toBe(1900);
  });

  it("keeps new-account scope and global busy locks intact when a delayed old-account action settles", async () => {
    window.localStorage.setItem("d2e-session-token", "tok-alice");
    fetchMock.mockResolvedValueOnce(
      json(makeDashboard({ handle: "alice", revision: 1 })),
    );

    let sessionApi!: ReturnType<typeof useGameSession>;
    function Harness() {
      sessionApi = useGameSession(false);
      return (
        <div>
          <span data-testid="handle">
            {sessionApi.state?.player.handle ?? "none"}
          </span>
          <span data-testid="workers-busy">
            {String(sessionApi.isScopeBusy("workers"))}
          </span>
        </div>
      );
    }

    await mount(<Harness />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(byTestId("handle")).toBe("alice");

    // Alice starts a slow scoped action ("workers")
    let resolveAliceWorkers!: (resp: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveAliceWorkers = resolve;
        }),
    );
    let alicePromise!: Promise<void>;
    await act(async () => {
      alicePromise = sessionApi.runAction(
        () => api.recruitResident({}),
        undefined,
        "workers",
      );
    });
    expect(byTestId("workers-busy")).toBe("true");

    // Another tab switches to Bob via StorageEvent
    fetchMock.mockResolvedValueOnce(
      json(makeDashboard({ handle: "bob", revision: 1 })),
    );
    await act(async () => {
      window.localStorage.setItem("d2e-session-token", "tok-bob");
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "d2e-session-token",
          newValue: "tok-bob",
        }),
      );
      await Promise.resolve();
    });
    expect(byTestId("handle")).toBe("bob");
    expect(byTestId("workers-busy")).toBe("false");

    // Bob starts his own scoped "workers" action
    let resolveBobWorkers!: (resp: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveBobWorkers = resolve;
        }),
    );
    let bobPromise!: Promise<void>;
    await act(async () => {
      bobPromise = sessionApi.runAction(
        () => api.recruitResident({}),
        undefined,
        "workers",
      );
    });
    expect(byTestId("workers-busy")).toBe("true");

    // Alice's old-epoch request settles now — must NOT release Bob's "workers" scope lock!
    await act(async () => {
      resolveAliceWorkers(json(makeDashboard({ handle: "alice", revision: 2 })));
      await alicePromise;
    });
    expect(byTestId("handle")).toBe("bob");
    expect(byTestId("workers-busy")).toBe("true");

    // Only when Bob's own request settles does "workers" unlock
    await act(async () => {
      resolveBobWorkers(json(makeDashboard({ handle: "bob", revision: 2 })));
      await bobPromise;
    });
    expect(byTestId("workers-busy")).toBe("false");
  });
});
