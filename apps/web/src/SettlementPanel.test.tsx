// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type DashboardStateResp } from "@drop2empire/api-client";
import { SettlementPanel } from "./SettlementPanel";

function fixture(): DashboardStateResp {
  return {
    player: { populationTotal: 2, nextResidentCostWaterMilli: 12000, nextResidentEtaSeconds: 0 },
    resources: [{ key: "water", amountMilli: 100000 }], jobs: [], blueprints: [], caravanOffers: [],
    settlement: { commandSeq: 1, housingCapacity: 4, technologies: [], buildings: [{
      code: "lumber_camp", name: "伐木棚", technologyName: "基础木工", effectSummary: "新增 3 个伐木岗位",
      owned: 0, limit: 128, visible: true, researched: true, canBuild: true, blockedReason: "",
      jobKey: "wood", assigned: 0, totalSlots: 0,
      costs: [{ resourceKey: "wood", resourceName: "木材", currentMilli: 12000, requiredMilli: 10000, capacityMilli: 450000, etaSeconds: 0 }],
    }] },
  } as unknown as DashboardStateResp;
}

describe("settlement construction interface", () => {
  let container: HTMLDivElement;
  let root: Root;
  const runAction = async (fn: () => Promise<DashboardStateResp>) => { await fn(); };
  beforeEach(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
  const button = (label: string) => Array.from(container.querySelectorAll("button")).find((b) => b.textContent === label)!;
  const render = async (state: DashboardStateResp, busy = false) => {
    await act(async () => root.render(<SettlementPanel state={state} busy={busy} runAction={runAction} />));
  };
  it("shows researched-but-unbuilt state and charges an explicit construction command", async () => {
    const state = fixture(); const spy = vi.spyOn(api, "constructBuilding").mockResolvedValue(state);
    await render(state);
    expect(container.textContent).toContain("已掌握 · 尚未建造");
    expect(container.textContent).toContain("已建 0 座");
    expect(container.textContent).toContain("12 / 10");
    await act(async () => button("建造首座").click());
    expect(spy).toHaveBeenCalledWith({ code: "lumber_camp", quantity: 1, commandSeq: 2 });
    state.settlement.buildings[0].owned = 1; state.settlement.buildings[0].totalSlots = 3;
    state.jobs = [{ jobKey: "wood", totalOutputPerSecMilli: 0 } as DashboardStateResp["jobs"][number]];
    await render(state);
    expect(container.textContent).toContain("等待安排居民");
    expect(button("增建一座")).toBeDefined();
  });
  it("prevents recruiting beyond housing and repeated clicks during a mutation", async () => {
    const state = fixture(); state.player.populationTotal = 4;
    await render(state, true);
    expect(button("招募 +1").disabled).toBe(true);
    expect(button("建造首座").disabled).toBe(true);
    expect(container.textContent).toContain("住房已满");
  });
  it("explains storage blockers instead of implying that waiting will suffice", async () => {
    const state = fixture(); const building = state.settlement.buildings[0];
    building.canBuild = false; building.blockedReason = "木材仓容不足，请先扩仓";
    building.costs[0].requiredMilli = 500000;
    await render(state);
    expect(button("建造首座").disabled).toBe(true);
    expect(container.textContent).toContain("需扩仓");
    expect(container.textContent).toContain("木材仓容不足");
  });
});
