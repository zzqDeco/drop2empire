// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  getCommandSyncOutcome,
  type DashboardStateResp,
} from "@drop2empire/api-client";
import { EconomyAdmin } from "./EconomyAdmin";
import { MarketSceneView } from "./features/macro/MarketSceneView";
import {
  buildGenesisProcurementPlan,
  GENESIS_PROCUREMENT_ITEMS,
  GENESIS_TOTAL_GOLD_BASIS,
} from "./genesisProcurement";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeState(): DashboardStateResp {
  return {
    serverTime: "2026-11-20T12:00:00Z",
    revision: 1,
    invites: [],
    expeditionRoutes: [],
    economy: {
      professional: {
        level: 0,
        facilityName: "",
        buildCosts: [],
        queueItem: "",
        queueOutputMilli: 0,
        remainingSeconds: 0,
        productionMode: "",
        productionCharges: 0,
        constructionTool: false,
        guildTool: false,
        sigilSeconds: 0,
        consumables: [],
      },
      companies: [],
      companyCatalog: [],
      issuedBasis: 0,
      cancelledBasis: 0,
      reserveBasis: 0,
      publicCashBasis: 0,
      corporateCashBasis: 0,
      ipoEscrowBasis: 0,
      holdingsBasis: 0,
      policies: [],
      publicInventory: [],
    },
    currentSeason: {
      seasonId: "S1",
      seasonNumber: 1,
      title: "S1 · 黑曜苏醒",
      subtitle: "",
      startedAt: "2026-11-13T00:00:00Z",
      resetRules: [],
      retentionRules: [],
    },
    player: {
      id: "admin",
      handle: "admin",
      phase: 3,
      profession: "scientist",
      professionName: "科学家",
      artifactName: "星盘",
      populationTotal: 10,
      populationAssigned: 10,
      populationIdle: 0,
      nextResidentCostWaterMilli: 12000,
      nextResidentEtaSeconds: 0,
      totalManualClicks: 10,
      goldBasis: 0,
      goldFrozenBasis: 0,
      activityPoints: 0,
      speedMultiplier: 1,
      simulatedElapsedSeconds: 600,
      isAdmin: true,
      offlineAwardSummary: "",
    },
    hydrationWarning: false,
    resources: [
      {
        key: "water",
        name: "洁净饮水",
        tier: "basic",
        description: "",
        amountMilli: 250000,
        frozenMilli: 0,
        capacityMilli: 500000,
        grossRatePerSecMilli: 1000,
        drainRatePerSecMilli: 0,
        netRatePerSecMilli: 1000,
        unlocked: true,
      },
      {
        key: "wood",
        name: "原木",
        tier: "basic",
        description: "",
        amountMilli: 120000,
        frozenMilli: 0,
        capacityMilli: 500000,
        grossRatePerSecMilli: 500,
        drainRatePerSecMilli: 0,
        netRatePerSecMilli: 500,
        unlocked: true,
      },
    ],
    jobs: [],
    blueprints: [],
    edicts: [],
    presets: [],
    caravanOffers: [],
    professions: [],
    recipes: [],
    installedEquipments: [],
    marketSummaries: [
      {
        itemKey: "water",
        itemName: "洁净饮水",
        tier: "basic",
        lastPriceBasis: 0,
        bestBidBasis: 1000,
        bestAskBasis: 0,
        volume24hMilli: 0,
        change24hPctBps: 0,
      },
      {
        itemKey: "wood",
        itemName: "原木",
        tier: "basic",
        lastPriceBasis: 0,
        bestBidBasis: 4500,
        bestAskBasis: 0,
        volume24hMilli: 0,
        change24hPctBps: 0,
      },
    ],
    openOrders: [],
    recentTrades: [],
    war: {
      seasonCode: "S1",
      seasonName: "黑曜苏醒",
      currentDay: 1,
      nextSettlementLabel: "20:00",
      playerGuild: "OBSIDIAN",
      playerGuildName: "黑曜商会",
      playerRole: "军需官",
      dailyBudgetUsed: 0,
      dailyBudgetCap: 50,
      obsidianTotalScore: 0,
      argentTotalScore: 0,
      joinedGuildId: "",
      playerGuildContribution: 0,
      guilds: [],
      nodes: [],
      edges: [],
      settlementHistory: [],
    },
    collectibles: [],
    macroLedger: {
      totalIssuedBasis: 0,
      playerHeldBasis: 0,
      escrowFrozenBasis: 0,
      npcHeldBasis: 0,
      treasuryHeldBasis: 0,
      permanentlyBurnedBasis: 0,
      taxRateBps: 100,
      burnShareBps: 0,
    },
    seasonNotices: [],
    eventLogs: [],
    availableHandles: ["admin"],
    settlement: {
      commandSeq: 1,
      housingCapacity: 12,
      guideCode: "empire",
      guideTitle: "",
      guideText: "",
      technologies: [],
      buildings: [],
    },
    equippedCosmetics: {
      headgear: "",
      mantle: "",
      heldRelic: "",
      companion: "",
    },
    cosmetics: [],
    raidGears: [],
    raidLoadout: {
      weaponKey: "",
      armorKey: "",
      bootsKey: "",
      safeBoxKey: "",
      safeSlotCount: 1,
      equippedPotions: [],
      equippedBuffCards: [],
      draftPoolCards: [],
      rerollCosts: [],
      canReroll: false,
      totalMaxHp: 100,
      totalAtk: 12,
      totalDef: 2,
      moveCooldownMs: 360,
      raidDurationSeconds: 180,
      backpackCapacity: 6,
    },
  };
}

describe("Batch 3: Genesis procurement charter & player cash-entry guide", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("sums the 6 official procurement lines to exactly 8,000.0000 Gold (80,000,000 Basis)", () => {
    const sum = GENESIS_PROCUREMENT_ITEMS.reduce(
      (acc, item) => acc + item.budgetBasis,
      0,
    );
    expect(sum).toBe(GENESIS_TOTAL_GOLD_BASIS);
    const plan = buildGenesisProcurementPlan("s1-v143");
    expect(plan).toHaveLength(8);
    expect(plan[0].policyId).toBe("s1-v143-issue-001");
    expect(plan[1].policyId).toBe("s1-v143-fund-001");
    expect(plan[2].req).toMatchObject({
      action: "procure",
      itemKey: "water",
      quantityMilli: 8_000_000,
      priceBasis: 1_000,
    });
  });

  it("executes only pending genesis steps in EconomyAdmin after explicit confirmation", async () => {
    const state = makeState();
    // Simulate step 1 (issue) already committed so resume skips it cleanly
    state.economy.policies = [
      {
        id: "s1-genesis-001-issue-001",
        action: "issue",
        amountBasis: GENESIS_TOTAL_GOLD_BASIS,
        itemKey: "",
        quantityMilli: 0,
        priceBasis: 0,
        at: "2026-11-20T12:00:00Z",
      },
    ];
    const policySpy = vi
      .spyOn(api, "monetaryPolicy")
      .mockResolvedValue(state);

    await act(async () => {
      root.render(
        <EconomyAdmin
          state={state}
          busy={false}
          runAction={async (fn) => {
            await fn();
          }}
        />,
      );
    });

    const launchBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("按章程执行待落账步骤 (7/8)"),
    )!;
    expect(launchBtn).toBeTruthy();

    await act(async () => {
      launchBtn.click();
    });
    expect(policySpy).not.toHaveBeenCalled();

    const confirmBtn = Array.from(
      document.body.querySelectorAll("button"),
    ).find((b) => b.textContent?.includes("确认执行 7 条政策"))!;
    expect(confirmBtn).toBeTruthy();

    await act(async () => {
      confirmBtn.click();
    });

    expect(policySpy).toHaveBeenCalledTimes(7);
    expect(policySpy.mock.calls[0][0].policyId).toBe("s1-genesis-001-fund-001");
    expect(policySpy.mock.calls[6][0].policyId).toBe(
      "s1-genesis-001-buy-flint-001",
    );
  });

  it("shows zero-issuance explanation when totalIssuedBasis === 0 and quick-sell chips when @public bids exist", async () => {
    const zeroState = makeState();
    await act(async () => {
      root.render(
        <MarketSceneView state={zeroState} runAction={async () => {}} />,
      );
    });
    expect(container.textContent).toContain("当前处于零金币准备期");
    expect(container.textContent).not.toContain("货币联盟受控公共采购（赚取金币入口）");

    const fundedState: DashboardStateResp = {
      ...zeroState,
      macroLedger: {
        ...zeroState.macroLedger,
        totalIssuedBasis: GENESIS_TOTAL_GOLD_BASIS,
      },
      openOrders: [
        {
          id: "ord_pub_wood",
          itemKey: "wood",
          itemName: "原木",
          side: "BID",
          priceBasis: 4500,
          quantityMilli: 4_000_000,
          filledMilli: 0,
          remainingMilli: 4_000_000,
          makerName: "@public",
          isNpc: false,
          isOwn: false,
          status: "OPEN",
          createdAt: "2026-11-20T12:00:00Z",
        },
      ],
    };

    await act(async () => {
      root.render(
        <MarketSceneView state={fundedState} runAction={async () => {}} />,
      );
    });

    expect(container.textContent).toContain("货币联盟受控公共采购（赚取金币入口）");
    const chip = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("原木 买一 0.45 G"),
    )!;
    expect(chip).toBeTruthy();

    await act(async () => {
      chip.click();
    });
    // Clicking the chip selects wood, switches to ASK, fills price 0.4500, and suggests player's available 120 wood
    expect(container.textContent).toContain("提交卖单");
    const inputs = Array.from(container.querySelectorAll("input"));
    expect(inputs.some((i) => i.value === "0.4500")).toBe(true);
    expect(inputs.some((i) => i.value === "120")).toBe(true);
  });

  it("caps quick-sell depth strictly to executable quantity at the best @public price tier", async () => {
    const state = makeState();
    state.macroLedger.totalIssuedBasis = GENESIS_TOTAL_GOLD_BASIS;
    state.openOrders = [
      {
        id: "ord_pub_water_low",
        itemKey: "water",
        itemName: "洁净饮水",
        side: "BID",
        priceBasis: 1000, // 0.10 G
        quantityMilli: 100_000,
        filledMilli: 0,
        remainingMilli: 100_000, // 100 units
        makerName: "@public",
        isNpc: false,
        isOwn: false,
        status: "OPEN",
        createdAt: "2026-11-20T12:00:00Z",
      },
      {
        id: "ord_pub_water_high",
        itemKey: "water",
        itemName: "洁净饮水",
        side: "BID",
        priceBasis: 2000, // 0.20 G
        quantityMilli: 10_000,
        filledMilli: 0,
        remainingMilli: 10_000, // 10 units
        makerName: "@public",
        isNpc: false,
        isOwn: false,
        status: "OPEN",
        createdAt: "2026-11-20T12:01:00Z",
      },
    ];

    await act(async () => {
      root.render(<MarketSceneView state={state} runAction={async () => {}} />);
    });

    const chip = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("洁净饮水 买一 0.20 G (余 10)"),
    )!;
    expect(chip).toBeTruthy();

    await act(async () => {
      chip.click();
    });
    const inputs = Array.from(container.querySelectorAll("input"));
    expect(inputs.some((i) => i.value === "0.2000")).toBe(true);
    expect(inputs.some((i) => i.value === "10")).toBe(true);
    expect(inputs.some((i) => i.value === "110")).toBe(false);
  });

  it("reads completion from untruncated committedPolicyIds even after >50 later policies and halts on uncertain SDK outcome", async () => {
    // 1. All 8 genesis IDs exist in committedPolicyIds even though recent policies feed has 0 genesis entries
    const doneState = makeState();
    doneState.economy.policies = [];
    doneState.economy.committedPolicyIds = buildGenesisProcurementPlan(
      "s1-genesis-001",
    ).map((s) => s.policyId);

    await act(async () => {
      root.render(
        <EconomyAdmin
          state={doneState}
          busy={false}
          runAction={async () => {}}
        />,
      );
    });
    expect(container.textContent).toContain("已完成 8/8");
    const doneBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("本批次 8 步创世政策已全部入账"),
    )!;
    expect(doneBtn).toBeTruthy();
    expect(doneBtn.disabled).toBe(true);

    // 2. When step 2 resolves with an uncertain transport outcome via real EmpireClient fallback, stop immediately
    const partialState = makeState();
    const fetchMock = vi.spyOn(globalThis, "fetch");
    // Step 1 succeeds on first try
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(partialState), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    // Step 2 fails twice with network TypeError, then GET /state refresh succeeds -> SDK tags outcome as "uncertain"
    fetchMock.mockRejectedValueOnce(new TypeError("dropped 1"));
    fetchMock.mockRejectedValueOnce(new TypeError("dropped 2"));
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(partialState), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const policySpy = vi.spyOn(api, "monetaryPolicy");
    let returnedResp: unknown = null;

    await act(async () => {
      root.render(
        <EconomyAdmin
          state={partialState}
          busy={false}
          runAction={async (fn) => {
            returnedResp = await fn();
          }}
        />,
      );
    });

    const launchBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("按章程执行待落账步骤 (8/8)"),
    )!;
    await act(async () => {
      launchBtn.click();
    });
    const confirmBtn = Array.from(
      document.body.querySelectorAll("button"),
    ).find((b) => b.textContent?.includes("确认执行 8 条政策"))!;
    await act(async () => {
      confirmBtn.click();
    });

    // Stopped right after step 2's uncertain response — must NOT continue to steps 3..8
    expect(policySpy).toHaveBeenCalledTimes(2);
    expect(getCommandSyncOutcome(returnedResp).kind).toBe("uncertain");
  });
});
