// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type DashboardStateResp } from "@drop2empire/api-client";
import { MarketSceneView } from "./features/macro/MarketSceneView";

function marketFixture(): DashboardStateResp {
  return {
    player: {
      handle: "iron_duke",
      profession: "artisan",
      professionName: "工匠",
      goldBasis: 1000000, // 100.00 G
    },
    resources: [
      { key: "iron", name: "精铁锭", amountMilli: 8000 },
      { key: "wood", name: "木材", amountMilli: 50000 },
    ],
    installedEquipments: [
      {
        itemKey: "auto_pump",
        name: "水力自动抽水机",
        installedCount: 1,
        maxStack: 5,
        inventoryUnits: 4,
        bonusSummary: "汲水产出 +25%",
      },
    ],
    raidGears: [
      {
        itemKey: "wpn_obsidian_blade",
        blueprintKey: "bp_obsidian_blade",
        blueprintOwnedCount: 2,
      },
    ],
    cosmetics: [
      {
        itemKey: "cos_obsidian_mantle",
        name: "黑曜金纹披风",
        ownedCount: 1,
      },
    ],
    recipes: [
      {
        recipeCode: "craft_auto_pump",
        name: "锻造自动抽水机",
        professionReqName: "工匠",
        professionMatched: true,
        outputName: "水力自动抽水机",
        outputAmountMilli: 1000,
        effectSummary: "打造 1 台跨职业增产抽水机",
        goldCostBasis: 10000, // 1.00 G
        canCraft: true,
        costs: [
          {
            resourceKey: "wood",
            resourceName: "木材",
            currentMilli: 50000,
            requiredMilli: 5000,
            capacityMilli: 200000,
            etaSeconds: 0,
          },
        ],
      },
    ],
    marketSummaries: [
      {
        itemKey: "auto_pump",
        itemName: "水力自动抽水机",
        lastPriceBasis: 200000,
        bestBidBasis: 190000,
        bestAskBasis: 210000,
        volume24hMilli: 12000,
        change24hPctBps: 520,
      },
      {
        itemKey: "alch_catalyst",
        itemName: "赫尔墨斯催化剂",
        lastPriceBasis: 220000,
        bestBidBasis: 210000,
        bestAskBasis: 230000,
        volume24hMilli: 8000,
        change24hPctBps: 150,
      },
      {
        itemKey: "enchant_scroll",
        itemName: "星界附魔卷轴",
        lastPriceBasis: 240000,
        bestBidBasis: 230000,
        bestAskBasis: 250000,
        volume24hMilli: 6000,
        change24hPctBps: 80,
      },
      {
        itemKey: "heavy_toolset",
        itemName: "泰坦精锻工具组",
        lastPriceBasis: 260000,
        bestBidBasis: 250000,
        bestAskBasis: 270000,
        volume24hMilli: 5000,
        change24hPctBps: 310,
      },
      {
        itemKey: "bp_obsidian_blade",
        itemName: "蓝图：黑曜斩舰刀",
        lastPriceBasis: 450000,
        bestBidBasis: 420000,
        bestAskBasis: 480000,
        volume24hMilli: 3000,
        change24hPctBps: -240,
      },
      {
        itemKey: "cos_obsidian_mantle",
        itemName: "外观：黑曜金纹披风",
        lastPriceBasis: 1500000,
        bestBidBasis: 1400000,
        bestAskBasis: 1600000,
        volume24hMilli: 1000,
        change24hPctBps: 0,
      },
    ],
    openOrders: [
      {
        id: 701,
        itemKey: "bp_obsidian_blade",
        side: "ASK",
        priceBasis: 500000,
        remainingMilli: 1000,
        makerName: "iron_duke",
        isOwn: true,
        isNpc: false,
      },
      {
        id: 702,
        itemKey: "auto_pump",
        side: "ASK",
        priceBasis: 210000,
        remainingMilli: 3000,
        makerName: "帝国平准署",
        isOwn: false,
        isNpc: true,
      },
    ],
    recentTrades: [
      {
        id: 901,
        executedAt: "12:30:00",
        itemName: "水力自动抽水机",
        priceBasis: 200000,
        quantityMilli: 1000,
        buyerName: "iron_duke",
        sellerName: "帝国平准署",
      },
    ],
  } as unknown as DashboardStateResp;
}

describe("MarketSceneView CLOB & Workshop UX", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("supports multi-batch workshop crafting, cross-item order cancellation, and wardrobe deep-link focus", async () => {
    const state = marketFixture();
    const craftSpy = vi.spyOn(api, "craftItem").mockResolvedValue(state);
    const cancelSpy = vi
      .spyOn(api, "cancelMarketOrder")
      .mockResolvedValue(state);
    const runAction = async (fn: () => Promise<unknown>) => {
      await fn();
    };

    await act(async () => {
      root.render(
        <MarketSceneView
          state={state}
          runAction={runAction as never}
          focusItemKey="cos_obsidian_mantle"
        />,
      );
    });

    // Deep link focused cos_obsidian_mantle (sellable stock = 1, ask = 160.00 G)
    expect(container.textContent).toContain("委托挂单 · 外观：黑曜金纹披风");
    expect(container.textContent).toContain("可售库存 1");
    expect(container.textContent).toContain("我的成交");

    // Even while viewing cos_obsidian_mantle, own order #701 on bp_obsidian_blade is visible & cancellable
    expect(container.textContent).toContain("我的当前挂单 (1)");
    expect(container.textContent).toContain("蓝图：黑曜斩舰刀");
    const cancelBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "撤单",
    )!;
    await act(async () => cancelBtn.click());
    expect(cancelSpy).toHaveBeenCalledWith(701);

    // Filter ticker to blueprints
    const bpTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "荒原蓝图",
    )!;
    await act(async () => bpTab.click());
    expect(container.textContent).toContain("-2.4%");

    // Filter ticker to equipment: all 4 EquipmentCatalog items appear under "增产设备"
    const eqTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "增产设备",
    )!;
    await act(async () => eqTab.click());
    expect(container.textContent).toContain("水力自动抽水机");
    expect(container.textContent).toContain("赫尔墨斯催化剂");
    expect(container.textContent).toContain("星界附魔卷轴");
    expect(container.textContent).toContain("泰坦精锻工具组");

    // Select x5 batch on craft_auto_pump and craft
    const batch5Btn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "×5",
    )!;
    await act(async () => batch5Btn.click());
    const craftBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("制造 ×5"),
    )!;
    await act(async () => craftBtn.click());
    expect(craftSpy).toHaveBeenCalledWith({
      recipeCode: "craft_auto_pump",
      batches: 5,
    });
  });
});
