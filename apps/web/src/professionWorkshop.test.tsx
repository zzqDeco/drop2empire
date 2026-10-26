// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { DashboardStateResp } from "@drop2empire/api-client";
import { ProfessionWorkshop } from "./EconomyWorkspace";
import { EconomyEvents } from "./EconomyEvents";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  localStorage.clear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function state(): DashboardStateResp {
  return {
    player: { handle: "maker", profession: "scientist" },
    resources: [{ key: "water", netRatePerSecMilli: 1000 }],
    war: { nodes: [] },
    economy: {
      professional: {
        level: 2,
        facilityName: "动力实验室",
        buildCosts: [],
        queueItem: "",
        productionMode: "overload_battery",
        productionCharges: 2,
        consumables: [
          {
            itemKey: "overload_battery",
            name: "过载电池",
            profession: "scientist",
            effect: "生产加速",
            use: "production",
            inventoryMilli: 0,
            seconds: 120,
            outputMilli: 5000,
            costs: [
              {
                resourceKey: "water",
                resourceName: "水",
                currentMilli: 140000,
                requiredMilli: 20000,
                capacityMilli: 750000,
                etaSeconds: 0,
              },
            ],
          },
        ],
      },
    },
  } as unknown as DashboardStateResp;
}
it("shows the total batch cost and mixed boosted duration, and prevents an unfunded craft", async () => {
  await act(async () =>
    root.render(<ProfessionWorkshop state={state()} runAction={vi.fn()} />),
  );
  const input = container.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, "7");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(container.textContent).toContain("148.0");
  expect(container.textContent).toContain("632");
  expect(container.textContent).toContain("35");
  const button = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "水不足",
  );
  expect(button?.disabled).toBe(true);
});
it("distinguishes storage capacity from waiting for material and hides irrelevant war controls", async () => {
  const s = state();
  s.economy.professional.level = 1;
  s.economy.professional.buildCosts = [
    {
      resourceKey: "water",
      resourceName: "水",
      currentMilli: 700000,
      requiredMilli: 1500000,
      capacityMilli: 750000,
      etaSeconds: -1,
    },
  ];
  await act(async () =>
    root.render(<ProfessionWorkshop state={s} runAction={vi.fn()} />),
  );
  expect(container.textContent).toContain("先扩仓");
  expect(container.textContent).not.toContain("战争支援节点");
});
it("acknowledges each simultaneous IPO and governance event instead of losing all but the newest", async () => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  const s = {
    player: { handle: "shareholder" },
    eventLogs: [
      { id: "new", category: "GOVERNANCE", message: "第二项决策" },
      { id: "old", category: "IPO", message: "第一项配售" },
    ],
  } as DashboardStateResp;
  await act(async () => root.render(<EconomyEvents state={s} />));
  expect(container.textContent).toContain("第一项配售");
  await act(async () => container.querySelector("button")!.click());
  expect(container.textContent).toContain("第二项决策");
  await act(async () => container.querySelector("button")!.click());
  expect(container.querySelector("dialog")).toBeNull();
  await act(async () => root.render(<EconomyEvents state={s} />));
  expect(container.querySelector("dialog")).toBeNull();
});

it("preserves four-decimal market quotes and blocks fractional quantities or unfunded orders", async () => {
  const { MarketSceneView } = await import("./MacroEmpireWorkspace");
  const { api } = await import("@drop2empire/api-client");
  const s = {
    player: { goldBasis: 0 },
    resources: [{ key: "water", amountMilli: 5000 }],
    installedEquipments: [],
    recipes: [],
    recentTrades: [],
    marketSummaries: [
      {
        itemKey: "water",
        itemName: "水",
        lastPriceBasis: 1234,
        bestBidBasis: 1234,
        bestAskBasis: 0,
        volume24hMilli: 0,
      },
    ],
    openOrders: [
      {
        id: "bid",
        itemKey: "water",
        side: "BID",
        priceBasis: 1234,
        remainingMilli: 2000,
        makerName: "公共采购",
        isOwn: false,
      },
    ],
  } as unknown as DashboardStateResp;
  const place = vi.spyOn(api, "placeMarketOrder").mockResolvedValue(s);
  await act(async () =>
    root.render(
      <MarketSceneView
        state={s}
        runAction={async (action) => {
          await action();
        }}
      />,
    ),
  );
  const findButton = (text: string) =>
    Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === text,
    )!;
  expect(findButton("提交卖单").disabled).toBe(false);
  await act(async () => findButton("填入").click());
  const inputs = container.querySelectorAll("input");
  expect(inputs[0].value).toBe("0.1234");
  expect(container.textContent).toContain("0.2468");
  await act(async () => findButton("提交卖单").click());
  expect(place).toHaveBeenCalledWith({
    itemKey: "water",
    side: "ASK",
    priceBasis: 1234,
    quantityMilli: 2000,
  });
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(inputs[1], "1.5");
    inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(findButton("提交卖单").disabled).toBe(true);
  expect(place).toHaveBeenCalledTimes(1);
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(inputs[1], "1");
    inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
    findButton("买入 (BID)").click();
  });
  expect(findButton("提交买单").disabled).toBe(true);
  expect(container.textContent).toContain("可用金币不足");
});
