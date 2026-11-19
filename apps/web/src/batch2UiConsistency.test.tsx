// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type DashboardStateResp } from "@drop2empire/api-client";
import { ModalShell } from "./components/ModalShell";
import { computeLiveWaterMetrics } from "./domain/settlementSelectors";
import { SeasonRelicVaultPanel } from "./features/macro/SeasonRelicVaultPanel";
import { WarGuildSceneView } from "./features/macro/WarGuildSceneView";
import { MarketSceneView } from "./features/macro/MarketSceneView";
import { RaidBattlefieldViewport } from "./features/raid/RaidBattlefieldViewport";
import { formatExactResource } from "./format";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function baseState(): DashboardStateResp {
  return {
    serverTime: "2026-11-19T12:00:00Z",
    revision: 12,
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
      subtitle: "黑曜苏醒",
      startedAt: "2026-11-13T00:00:00Z",
      resetRules: [],
      retentionRules: [],
    },
    player: {
      id: "p1",
      handle: "alice",
      phase: 3,
      profession: "artisan",
      professionName: "工匠",
      artifactName: "锻炉铁锤",
      populationTotal: 8,
      populationAssigned: 6,
      populationIdle: 2,
      nextResidentCostWaterMilli: 12000,
      nextResidentEtaSeconds: 0,
      totalManualClicks: 10,
      goldBasis: 50000,
      goldFrozenBasis: 0,
      activityPoints: 200,
      speedMultiplier: 1,
      simulatedElapsedSeconds: 600,
      isAdmin: false,
      offlineAwardSummary: "",
    },
    hydrationWarning: false,
    resources: [
      {
        key: "water",
        name: "洁净饮水",
        tier: "basic",
        description: "",
        amountMilli: 850000,
        frozenMilli: 0,
        capacityMilli: 750000,
        grossRatePerSecMilli: 1000,
        drainRatePerSecMilli: 0,
        netRatePerSecMilli: 1000,
        unlocked: true,
      },
      {
        key: "infantry_kit",
        name: "重步兵军备箱",
        tier: "armament",
        description: "",
        amountMilli: 2500,
        frozenMilli: 0,
        capacityMilli: 0,
        grossRatePerSecMilli: 0,
        drainRatePerSecMilli: 0,
        netRatePerSecMilli: 0,
        unlocked: true,
      },
      {
        key: "archer_kit",
        name: "长弓手军备箱",
        tier: "armament",
        description: "",
        amountMilli: 0,
        frozenMilli: 0,
        capacityMilli: 0,
        grossRatePerSecMilli: 0,
        drainRatePerSecMilli: 0,
        netRatePerSecMilli: 0,
        unlocked: true,
      },
      {
        key: "cavalry_kit",
        name: "突击骑军备箱",
        tier: "armament",
        description: "",
        amountMilli: 0,
        frozenMilli: 0,
        capacityMilli: 0,
        grossRatePerSecMilli: 0,
        drainRatePerSecMilli: 0,
        netRatePerSecMilli: 0,
        unlocked: true,
      },
      {
        key: "season_chest",
        name: "S1·墨械典藏宝箱",
        tier: "season",
        description: "",
        amountMilli: 1000,
        frozenMilli: 0,
        capacityMilli: 0,
        grossRatePerSecMilli: 0,
        drainRatePerSecMilli: 0,
        netRatePerSecMilli: 0,
        unlocked: true,
      },
    ],
    jobs: [],
    blueprints: [],
    edicts: [],
    presets: [],
    caravanOffers: [],
    professions: [],
    recipes: [
      {
        recipeCode: "craft_infantry_kit",
        name: "锻造重步兵军备箱",
        category: "armament",
        professionReq: "artisan",
        professionReqName: "工匠",
        outputKey: "infantry_kit",
        outputName: "重步兵军备箱",
        outputAmountMilli: 2500,
        costs: [],
        goldCostBasis: 0,
        effectSummary: "工匠 +25% 产出",
        canCraft: true,
        professionMatched: true,
      },
    ],
    installedEquipments: [],
    marketSummaries: [
      {
        itemKey: "bp_carapace_armor",
        itemName: "★图纸：沙虫壳胸甲",
        tier: "blueprint",
        lastPriceBasis: 210000,
        bestBidBasis: 0,
        bestAskBasis: 0,
        volume24hMilli: 0,
        change24hPctBps: 0,
      },
      {
        itemKey: "bp_scavenge_elixir",
        itemName: "★图纸：速搜合剂配方",
        tier: "blueprint",
        lastPriceBasis: 190000,
        bestBidBasis: 0,
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
      currentDay: 2,
      nextSettlementLabel: "20:00",
      playerGuild: "ARGENT",
      playerGuildName: "[ASTR] 白银同盟",
      playerRole: "军需官",
      dailyBudgetUsed: 0,
      dailyBudgetCap: 50,
      obsidianTotalScore: 100,
      argentTotalScore: 110,
      joinedGuildId: "guild_astr",
      playerGuildContribution: 0,
      guilds: [
        {
          guildId: "guild_astr",
          name: "星辰白银",
          tag: "ASTR",
          faction: "ARGENT",
          factionName: "白银同盟",
          leaderHandle: "alice",
          level: 2,
          xp: 100,
          nextLevelXp: 1000,
          treasuryGoldBasis: 0,
          memberCount: 1,
          rallyNodeId: "node_east_pass",
          rallyNodeName: "东境要隘",
          announcement: "",
          bonusSummary: "",
          members: [],
        },
      ],
      nodes: [
        {
          nodeId: "node_north_fort",
          name: "北境壁垒",
          region: "north",
          ownerGuild: "OBSIDIAN",
          dailyScore: 25,
          defenseBonusPct: 10,
          garrisonPower: 5000,
          infantryCount: 5,
          archerCount: 0,
          cavalryCount: 0,
          myInfantry: 0,
          myArcher: 0,
          myCavalry: 0,
          x: 400,
          y: 120,
          supplyConnected: false,
          canDeploy: false,
          isTreasureVault: false,
          intelNote: "",
        },
        {
          nodeId: "node_east_pass",
          name: "东境要隘",
          region: "east",
          ownerGuild: "ARGENT",
          dailyScore: 25,
          defenseBonusPct: 10,
          garrisonPower: 10000,
          infantryCount: 8,
          archerCount: 2,
          cavalryCount: 0,
          myInfantry: 2,
          myArcher: 0,
          myCavalry: 0,
          x: 700,
          y: 220,
          supplyConnected: true,
          canDeploy: true,
          isTreasureVault: false,
          intelNote: "",
        },
      ],
      edges: [{ fromNode: "node_north_fort", toNode: "node_east_pass" }],
      settlementHistory: [],
    },
    collectibles: [
      {
        itemId: "c_other",
        serialNumber: 1,
        seasonId: "S1",
        collectionId: "COL-S1",
        name: "曜石星盘 #001",
        baseModelId: "astrolabe",
        baseModelName: "曜石星盘",
        textureId: "ink",
        textureName: "墨金蚀刻",
        patternSeed: 29723401198431596,
        patternSeedText: "29723401198431597",
        uvOffsetX: 100,
        uvOffsetY: 100,
        uvScale: 120,
        uvRotation: 45,
        paletteId: "gold",
        paletteName: "墨金",
        rarityTier: "EPIC",
        specialTag: "★ 正交工程角",
        mintedAt: "2026-11-19 10:00:00",
        ownerName: "bob",
      },
      {
        itemId: "c_mine",
        serialNumber: 2,
        seasonId: "S1",
        collectionId: "COL-S1",
        name: "铜仪浑天 #002",
        baseModelId: "astrolabe",
        baseModelName: "铜仪浑天",
        textureId: "ink",
        textureName: "墨金蚀刻",
        patternSeed: 123456789,
        patternSeedText: "123456789",
        uvOffsetX: 100,
        uvOffsetY: 100,
        uvScale: 120,
        uvRotation: 90,
        paletteId: "gold",
        paletteName: "墨金",
        rarityTier: "RARE",
        specialTag: "标准采样花纹",
        mintedAt: "2026-11-19 11:00:00",
        ownerName: "alice",
      },
    ],
    macroLedger: {
      totalIssuedBasis: 0,
      playerHeldBasis: 0,
      escrowFrozenBasis: 0,
      npcHeldBasis: 0,
      treasuryHeldBasis: 0,
      permanentlyBurnedBasis: 0,
      taxRateBps: 500,
      burnShareBps: 0,
    },
    seasonNotices: [],
    eventLogs: [],
    availableHandles: ["alice"],
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
    raidGears: [
      {
        itemKey: "gear_carapace_armor",
        name: "岩甲沙虫壳胸甲",
        category: "armor",
        tier: 2,
        blueprintKey: "bp_carapace_armor",
        blueprintName: "★图纸：沙虫壳胸甲",
        recipeUnlocked: false,
        blueprintOwnedCount: 0,
        ownedCount: 0,
        equipped: false,
        statSummary: "",
        atkBonus: 0,
        hpBonus: 100,
        defBonus: 13,
        moveCooldownMs: 0,
        safeSlots: 0,
        costs: [],
        canCraft: false,
      },
      {
        itemKey: "pot_scavenge_elixir",
        name: "巧手速搜合剂",
        category: "potion",
        tier: 2,
        blueprintKey: "bp_scavenge_elixir",
        blueprintName: "★图纸：速搜合剂配方",
        recipeUnlocked: false,
        blueprintOwnedCount: 0,
        ownedCount: 1,
        equipped: true,
        statSummary: "",
        atkBonus: 0,
        hpBonus: 0,
        defBonus: 0,
        moveCooldownMs: 0,
        safeSlots: 0,
        costs: [],
        canCraft: false,
      },
    ],
    raidLoadout: {
      weaponKey: "",
      armorKey: "",
      bootsKey: "",
      safeBoxKey: "",
      safeSlotCount: 1,
      equippedPotions: ["pot_scavenge_elixir"],
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

describe("Batch 2 UI accessibility, portal modals, and display consistency", () => {
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

  it("F17: portals ModalShell directly to document.body outside transformed ancestors", async () => {
    await act(async () => {
      root.render(
        <div style={{ transform: "translateY(0)" }} data-testid="transformed">
          <ModalShell ariaLabel="测试弹窗">
            <p>Portal Content</p>
          </ModalShell>
        </div>,
      );
    });

    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.parentElement).toBe(document.body);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("F07: preserves over-cap refunded water instead of clamping to capacity", () => {
    const state = baseState();
    const { liveWaterMilli } = computeLiveWaterMetrics(state, false, 0, 10);
    expect(liveWaterMilli).toBe(850000);
  });

  it("F14 & F19: separates personal vs realm collectibles, displays exact patternSeedText, and matches owner on reveal", async () => {
    const state = baseState();
    const nextState: DashboardStateResp = {
      ...state,
      collectibles: [
        {
          ...state.collectibles[0],
          itemId: "c_concurrent_other",
          serialNumber: 3,
          name: "他人同时开出的藏品 #003",
          ownerName: "charlie",
        },
        {
          ...state.collectibles[1],
          itemId: "c_new_mine",
          serialNumber: 4,
          name: "我新铸造的藏品 #004",
          patternSeed: 29723401198431596,
          patternSeedText: "29723401198431597",
          ownerName: "alice",
        },
        ...state.collectibles,
      ],
    };
    vi.spyOn(api, "openSeasonChest").mockResolvedValue(nextState);

    await act(async () => {
      root.render(
        <SeasonRelicVaultPanel
          state={state}
          runAction={async (fn) => {
            await fn();
          }}
        />,
      );
    });

    // Default scope shows only alice's relic (1), while realm tab shows 2
    expect(container.textContent).toContain("我的秘宝 (1)");
    expect(container.textContent).toContain("全服馆藏 (2)");
    expect(container.textContent).toContain("铜仪浑天 #002");
    expect(container.textContent).not.toContain("曜石星盘 #001");

    // Switch to realm scope and verify legacy 55-bit exact decimal string patternSeedText
    const realmBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("全服馆藏 (2)"),
    )!;
    await act(async () => {
      realmBtn.click();
    });
    expect(container.textContent).toContain("29723401198431597");
    expect(container.textContent).toContain("bob");

    // Open chest: reveal modal must pick alice's newly minted item (#004), NOT charlie's (#003)
    const openBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("开箱 (1)"),
    )!;
    await act(async () => {
      openBtn.click();
    });
    const modal = document.body.querySelector('[role="dialog"]');
    expect(modal?.textContent).toContain("我新铸造的藏品 #004");
    expect(modal?.textContent).toContain("29723401198431597");
    expect(modal?.textContent).not.toContain("他人同时开出的藏品 #003");
  });

  it("F09, F13, F21: makes war map SVG keyboard-selectable, floors 2.5 kits to 2 deployable, and clarifies garrison retention", async () => {
    const state = baseState();
    await act(async () => {
      root.render(
        <WarGuildSceneView state={state} runAction={async () => {}} />,
      );
    });

    // Smart default selects joined guild rally node (node_east_pass), NOT unreachable north fort
    expect(container.textContent).toContain("战略据点 · 东境要隘");
    // Floors 2.5 kits to 2 deployable while also showing exact 2.5 stock
    expect(container.textContent).toContain("可派军备整团 (步 / 弓 / 骑)");
    expect(container.textContent).toContain("2 / 0 / 0");
    expect(container.textContent).toContain("2.5 / 0 / 0");
    expect(container.textContent).toContain("不退回个人库存");

    // SVG node is keyboard-focusable and responds to Enter
    const northNode = container.querySelector(
      'g.war-node-group[aria-label*="北境壁垒"]',
    ) as SVGGElement | null;
    expect(northNode).not.toBeNull();
    expect(northNode?.getAttribute("role")).toBe("button");
    expect(northNode?.getAttribute("tabindex")).toBe("0");

    await act(async () => {
      northNode!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    expect(container.textContent).toContain("战略据点 · 北境壁垒");
  });

  it("F13 & F15: shows exact fractional craft output (+2.5) and matches market search by gear/recipe aliases", async () => {
    expect(formatExactResource(2500)).toBe("2.5");
    expect(formatExactResource(2000)).toBe("2");

    const state = baseState();
    await act(async () => {
      root.render(<MarketSceneView state={state} runAction={async () => {}} />);
    });

    expect(container.textContent).toContain("+2.5");
    const searchInput = container.querySelector(
      'input[aria-label="搜索市场商品"]',
    ) as HTMLInputElement | null;
    // Note: marketSummaries has 2 items here; test alias matching directly with >5 items
    expect(searchInput).toBeNull();

    const expandedState: DashboardStateResp = {
      ...state,
      marketSummaries: [
        ...state.marketSummaries,
        ...Array.from({ length: 5 }, (_, idx) => ({
          itemKey: `filler_${idx}`,
          itemName: `物资_${idx}`,
          tier: "basic",
          lastPriceBasis: 1000,
          bestBidBasis: 0,
          bestAskBasis: 0,
          volume24hMilli: 0,
          change24hPctBps: 0,
        })),
      ],
    };

    await act(async () => {
      root.render(
        <MarketSceneView state={expandedState} runAction={async () => {}} />,
      );
    });
    const input = container.querySelector(
      'input[aria-label="搜索市场商品"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(input, "巧手速搜合剂");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.textContent).toContain("★图纸：速搜合剂配方");
  });

  it("O06: excludes non-potion profession raid tools (portable_detector) from the tactical potion bar", async () => {
    const state = baseState();
    const zone = {
      id: 0,
      name: "外围 · 沙暴荒原",
      subtitle: "",
      width: 3,
      height: 3,
      visited: true,
      exploredCount: 9,
      tiles: Array.from({ length: 9 }, (_, i) => ({
        x: i % 3,
        y: Math.floor(i / 3),
        kind: i === 4 ? "spawn" : "empty",
        explored: true,
        looted: false,
        enemyName: "",
        enemyHp: 0,
        enemyMaxHp: 0,
        enemyAtk: 0,
        portalTargetZone: -1,
        portalTargetX: 0,
        portalTargetY: 0,
        portalLabel: "",
        channelMs: 0,
      })),
    };
    const mockCtrl = {
      curZoneId: 0,
      pos: { x: 1, y: 1 },
      facing: "down" as const,
      setFacing: vi.fn(),
      timeLeftMs: 120000,
      galeLeftMs: 0,
      scavLeftMs: 0,
      cheatDeathActive: false,
      hp: 100,
      maxHp: 100,
      atk: 12,
      def: 2,
      effectiveMoveCooldownMs: 360,
      safeBox: [],
      backpack: [],
      showLootModal: false,
      setShowLootModal: vi.fn(),
      channeling: null,
      zones: [zone],
      currentTile: zone.tiles[4],
      raidLog: ["使用便携探测器"],
      activeContainerTitle: "",
      activeChestDrops: [],
      draggedItem: null,
      setDraggedItem: vi.fn(),
      usedPotions: ["portable_detector", "recovery_potion"],
      handleStep: vi.fn(),
      handleUsePortal: vi.fn(),
      handleDrinkPotion: vi.fn(),
      transferItem: vi.fn(),
      lootAllFromChest: vi.fn(),
      handleMerchantBuy: vi.fn(),
      startExtractionChannel: vi.fn(),
      triggerFinishRaid: vi.fn(),
      sendRaidAction: vi.fn(),
    } as unknown as Parameters<typeof RaidBattlefieldViewport>[0]["ctrl"];

    await act(async () => {
      root.render(
        <RaidBattlefieldViewport
          state={state}
          currentZone={zone}
          ctrl={mockCtrl}
          runAction={async () => {}}
        />,
      );
    });

    expect(container.textContent).toContain("巧手速搜合剂");
    expect(container.textContent).not.toContain("portable_detector");
    expect(container.textContent).not.toContain("recovery_potion");
    expect(container.textContent).not.toContain("(已饮)");
  });
});
