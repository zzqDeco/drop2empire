// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  type DashboardStateResp,
  type RaidUpdateResp,
} from "@drop2empire/api-client";
import { WastelandRaidPanel } from "./WastelandRaidPanel";
import { mergeServerUpdate, type ServerUpdate } from "./serverState";

function fixture(): DashboardStateResp {
  return {
    revision: 1,
    player: { handle: "scout" },
    equippedCosmetics: [],
    raidGears: [],
    economy: {
      professional: {
        consumables: [
          {
            itemKey: "breach_tool",
            name: "破障工具",
            use: "raid",
            inventoryMilli: 1000,
          },
          {
            itemKey: "blink_scroll",
            name: "闪步卷轴",
            use: "raid",
            inventoryMilli: 1000,
          },
        ],
      },
    },
    raidLoadout: {
      weaponKey: "",
      armorKey: "",
      bootsKey: "",
      equippedPotions: [],
      safeSlotCount: 1,
      backpackCapacity: 6,
      moveCooldownMs: 100,
      activeSession: {
        raidId: "raid-consumable",
        lastCommandSeq: 0,
        currentZoneId: 0,
        playerX: 0,
        playerY: 0,
        facing: "right",
        hp: 100,
        maxHp: 100,
        atk: 10,
        def: 5,
        effectiveMoveCooldownMs: 100,
        timeRemainingMs: 180000,
        channelRemainingMs: 0,
        backpack: [],
        safeBox: [],
        activeChestDrops: [],
        usedPotionKeys: [],
        logs: [],
        zones: [
          {
            id: 0,
            name: "Z1 · 测试林地",
            width: 5,
            height: 1,
            visited: true,
            tiles: Array.from({ length: 5 }, (_, x) => ({
              x,
              y: 0,
              kind: x === 1 ? "chest_wood" : "floor",
              explored: true,
              looted: false,
            })),
          },
        ],
      },
    },
  } as unknown as DashboardStateResp;
}

describe("raid consumables reconcile the visible search timer", () => {
  let root: Root;
  let container: HTMLDivElement;
  let state: DashboardStateResp;
  beforeEach(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    state = fixture();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    vi.spyOn(api, "raidAction").mockImplementation(async (req) => {
      const session = structuredClone(state.raidLoadout.activeSession!);
      if (req.action === "move") {
        session.playerX += req.dx ?? 0;
        session.channelRemainingMs = 1000;
      } else if (req.action === "use_consumable") {
        session.usedPotionKeys.push(req.itemKey!);
        if (req.itemKey === "breach_tool") session.channelRemainingMs = 600;
        if (req.itemKey === "blink_scroll") {
          session.playerX += req.dx ?? 0;
          const landed = session.zones[0].tiles[session.playerX];
          session.channelRemainingMs = landed.kind.startsWith("chest_")
            ? 400
            : 0;
        }
      } else if (req.action === "open_chest") {
        session.zones[0].tiles[session.playerX].looted = true;
        session.channelRemainingMs = 0;
      }
      session.lastCommandSeq = req.commandSeq;
      return {
        revision: state.revision + 1,
        playerHandle: "scout",
        raidLoadout: { ...state.raidLoadout, activeSession: session },
      } as RaidUpdateResp;
    });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  const render = () =>
    root.render(
      <WastelandRaidPanel
        state={state}
        runAction={async (fn: () => Promise<ServerUpdate>) => {
          state = mergeServerUpdate(state, await fn())!;
          render();
        }}
      />,
    );
  const click = async (label: string) => {
    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.startsWith(label),
    );
    expect(button, label).toBeDefined();
    await act(async () => button!.click());
  };
  const enterChest = async () => {
    await act(async () => render());
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" })),
    );
    expect(container.querySelector(".opening-progress-fill")).not.toBeNull();
    await click("展开背囊与整备");
  };

  it("opens the chest at the shortened server deadline after using a breach tool", async () => {
    await enterChest();
    await click("破障工具");
    await act(async () => vi.advanceTimersByTime(500));
    expect(
      vi
        .mocked(api.raidAction)
        .mock.calls.some(([r]) => r.action === "open_chest"),
    ).toBe(false);
    await act(async () => vi.advanceTimersByTime(100));
    expect(api.raidAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "open_chest", commandSeq: 3 }),
    );
  });

  it("clears the old search when blink lands on ordinary ground", async () => {
    await enterChest();
    await click("闪步卷轴");
    expect(state.raidLoadout.activeSession!.playerX).toBe(3);
    expect(container.querySelector(".opening-progress-fill")).toBeNull();
    await act(async () => vi.advanceTimersByTime(1200));
    expect(
      vi
        .mocked(api.raidAction)
        .mock.calls.some(([r]) => r.action === "open_chest"),
    ).toBe(false);
  });

  it("starts searching when blink lands on an unopened chest", async () => {
    state.raidLoadout.activeSession!.zones[0].tiles[2].kind = "chest_iron";
    await act(async () => render());
    await click("展开背囊与整备");
    await click("闪步卷轴");
    expect(state.raidLoadout.activeSession!.playerX).toBe(2);
    expect(container.querySelector(".opening-progress-fill")).not.toBeNull();
    await act(async () => vi.advanceTimersByTime(400));
    expect(api.raidAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "open_chest", commandSeq: 2 }),
    );
  });
});
