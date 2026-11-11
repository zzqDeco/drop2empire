// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type DashboardStateResp } from "@drop2empire/api-client";
import { EDICT_UPKEEP_THRESHOLDS_MILLI } from "./config/gameConfig";
import { SettlementPanel } from "./SettlementPanel";

function fixture(): DashboardStateResp {
  return {
    player: {
      populationTotal: 2,
      profession: "none",
      nextResidentCostWaterMilli: 13000,
      nextResidentEtaSeconds: 0,
    },
    resources: [
      {
        key: "water",
        amountMilli: 120000,
        capacityMilli: 450000,
        netRatePerSecMilli: 2000,
      },
      {
        key: "wood",
        amountMilli: 90000,
        capacityMilli: 450000,
        netRatePerSecMilli: 1000,
      },
    ],
    jobs: [],
    edicts: [],
    blueprints: [],
    caravanOffers: [],
    settlement: {
      commandSeq: 1,
      housingCapacity: 8,
      technologies: [],
      buildings: [
        {
          code: "lumber_camp",
          name: "伐木棚",
          technologyName: "基础木工",
          effectSummary: "新增 3 个伐木岗位",
          owned: 0,
          limit: 128,
          visible: true,
          researched: true,
          canBuild: true,
          blockedReason: "",
          jobKey: "wood",
          assigned: 0,
          totalSlots: 0,
          costs: [
            {
              resourceKey: "wood",
              resourceName: "木材",
              currentMilli: 90000,
              requiredMilli: 10000,
              capacityMilli: 450000,
              etaSeconds: 0,
            },
          ],
        },
      ],
    },
  } as unknown as DashboardStateResp;
}

describe("settlement construction interface", () => {
  let container: HTMLDivElement;
  let root: Root;
  const runAction = async (fn: () => Promise<DashboardStateResp>) => {
    await fn();
  };

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

  const button = (label: string) =>
    Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === label,
    )!;

  const render = async (state: DashboardStateResp, busy = false) => {
    await act(async () =>
      root.render(
        <SettlementPanel state={state} busy={busy} runAction={runAction} />,
      ),
    );
  };

  it("shows researched-but-unbuilt state and charges an explicit construction command", async () => {
    const state = fixture();
    const spy = vi.spyOn(api, "constructBuilding").mockResolvedValue(state);
    await render(state);
    expect(container.textContent).toContain("已掌握 · 尚未建造");
    expect(container.textContent).toContain("已建 0 座");
    expect(container.textContent).toContain("90 / 10");
    await act(async () => button("建造首座").click());
    expect(spy).toHaveBeenCalledWith({
      code: "lumber_camp",
      quantity: 1,
      commandSeq: 2,
    });
    state.settlement.buildings[0].owned = 1;
    state.settlement.buildings[0].totalSlots = 3;
    state.jobs = [
      {
        jobKey: "wood",
        totalOutputPerSecMilli: 0,
      } as DashboardStateResp["jobs"][number],
    ];
    await render(state);
    expect(container.textContent).toContain("等待安排居民");
    expect(button("增建一座")).toBeDefined();
  });

  it("supports batch recruitment and exact BigInt batch building construction", async () => {
    const state = fixture();
    const recruitSpy = vi
      .spyOn(api, "recruitResident")
      .mockResolvedValue(state);
    const buildSpy = vi
      .spyOn(api, "constructBuilding")
      .mockResolvedValue(state);
    await render(state);

    // Select x5 recruit batch
    const recruit5Chip = Array.from(container.querySelectorAll("button")).find(
      (b) =>
        b.closest('[aria-label="招募批次"]') && b.textContent?.trim() === "×5",
    )!;
    await act(async () => recruit5Chip.click());
    expect(button("招募 +5")).toBeDefined();
    await act(async () => button("招募 +5").click());
    expect(recruitSpy).toHaveBeenCalledWith({ count: 5 });

    // Select x5 building batch on lumber_camp (base wood = 10 -> 10 + 13 + 16 + 20 + 25 = 84 wood)
    const build5Chip = Array.from(container.querySelectorAll("button")).find(
      (b) =>
        !b.closest('[aria-label="招募批次"]') && b.textContent?.trim() === "×5",
    )!;
    await act(async () => build5Chip.click());
    expect(container.textContent).toContain("90 / 84");
    await act(async () => button("增建 ×5").click());
    expect(buildSpy).toHaveBeenCalledWith({
      code: "lumber_camp",
      quantity: 5,
      commandSeq: 2,
    });
  });

  it("shows truthful edict-inactive status on colony_edicts instead of claiming active effect", async () => {
    const state = fixture();
    state.edicts = [
      {
        code: "night_shift",
        name: "篝火夜班",
        category: "production",
        unlocked: true,
        active: false,
        effectSummary: "",
        drawbackSummary: "",
      },
    ];
    state.settlement.buildings = [
      {
        code: "colony_edicts",
        name: "聚落议事所",
        technologyName: "聚落法令",
        effectSummary: "开放篝火夜班与节水配给",
        owned: 1,
        limit: 1,
        visible: true,
        researched: true,
        canBuild: false,
        blockedReason: "",
        jobKey: "",
        assigned: 0,
        totalSlots: 0,
        costs: [],
      },
    ];
    await render(state);
    expect(container.textContent).toContain("已建成 · 待在法令栏开启");
    expect(button("前往左侧岗位与法令栏开启 ➔")).toBeDefined();

    // Enabling wire edict codes (water_ration & hydro_saw) updates building badges and upkeep threshold map
    expect(EDICT_UPKEEP_THRESHOLDS_MILLI.hydro_saw).toEqual({
      resourceKey: "water",
      resourceName: "净水",
      minMilli: 1500,
    });
    state.edicts = [
      {
        code: "water_ration",
        name: "节水配给制",
        category: "edict",
        unlocked: true,
        active: true,
        effectSummary: "",
        drawbackSummary: "",
      },
      {
        code: "hydro_saw",
        name: "水压联动水锤",
        category: "mechanism",
        unlocked: true,
        active: true,
        effectSummary: "",
        drawbackSummary: "",
      },
    ];
    state.settlement.buildings.push({
      code: "water_wheel_1",
      name: "一级水轮",
      technologyName: "水力工程",
      effectSummary: "开放水压联动水锤",
      owned: 1,
      limit: 1,
      visible: true,
      researched: true,
      canBuild: false,
      blockedReason: "",
      jobKey: "",
      assigned: 0,
      totalSlots: 0,
      costs: [],
    });
    await render(state);
    expect(container.textContent).not.toContain("已建成 · 待在法令栏开启");
    expect(container.textContent).toContain("已建成 · 篝火夜班 / 节水配给运行中");
    expect(container.textContent).toContain("已建成 · 水压联动水锤运行中");
  });

  it("prevents recruiting beyond housing and surfaces inline ETA & storage blockers", async () => {
    const state = fixture();
    state.player.populationTotal = 8;
    const building = state.settlement.buildings[0];
    building.canBuild = false;
    building.blockedReason = "木材仓容不足，请先扩仓";
    building.costs[0].requiredMilli = 500000;
    await render(state, true);
    expect(button("招募 +1").disabled).toBe(true);
    expect(button("建造首座").disabled).toBe(true);
    expect(container.textContent).toContain("住房已满");
    expect(container.textContent).toContain("需扩仓");
    expect(container.textContent).toContain("木材仓容不足");
  });
});
