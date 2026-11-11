// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  type DashboardStateResp,
  type RaidTileViewDTO,
} from "@drop2empire/api-client";
import { WastelandRaidPanel } from "./WastelandRaidPanel";

function makeTiles(width: number, height: number): RaidTileViewDTO[] {
  const out: RaidTileViewDTO[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      out.push({
        x,
        y,
        kind: "floor",
        explored: true,
        looted: false,
        enemyName: "",
        enemyHp: 0,
        enemyMaxHp: 0,
        enemyAtk: 0,
        portalTargetZone: -1,
        portalLabel: "",
        channelMs: 0,
      });
    }
  }
  return out;
}

function raidFixture(width = 11, height = 7): DashboardStateResp {
  const tiles = makeTiles(width, height);
  // Player at (1, 1); lethal enemy at (2, 1); open early extraction at (1, 2)
  tiles[1 * width + 2] = {
    ...tiles[1 * width + 2],
    kind: "enemy_raider",
    enemyName: "狂沙掠夺者",
    enemyHp: 30,
    enemyMaxHp: 30,
    enemyAtk: 25,
  };
  tiles[2 * width + 1] = {
    ...tiles[2 * width + 1],
    kind: "extract_early",
    channelMs: 2800,
  };

  return {
    revision: 10,
    player: {
      handle: "scout_lord",
      profession: "miner",
      professionName: "矿工",
      goldBasis: 500000,
    },
    equippedCosmetics: {
      headgear: "",
      mantle: "",
      heldRelic: "",
      companion: "",
    },
    cosmetics: [],
    marketSummaries: [],
    caravanOffers: [],
    raidGears: [
      {
        itemKey: "wpn_iron_spear",
        name: "精铁长矛",
        category: "weapon",
        tier: 2,
        ownedCount: 1,
        equipped: true,
        recipeUnlocked: true,
        canCraft: false,
        blueprintKey: "",
        blueprintName: "",
        blueprintOwnedCount: 0,
        statSummary: "",
        costs: [],
      },
    ],
    raidLoadout: {
      weaponKey: "wpn_iron_spear",
      armorKey: "",
      bootsKey: "",
      safeBoxKey: "box_basic",
      equippedPotions: ["pot_gale_stride"],
      equippedBuffCards: [],
      draftPoolCards: [],
      rerollCosts: [],
      canReroll: false,
      totalMaxHp: 100,
      totalAtk: 10,
      totalDef: 5,
      moveCooldownMs: 300,
      safeSlotCount: 2,
      backpackCapacity: 8,
      raidDurationSeconds: 180,
      activeSession: {
        raidId: "raid-zone-test",
        lastCommandSeq: 1,
        currentZoneId: 0,
        playerX: 1,
        playerY: 1,
        facing: "right",
        hp: 35,
        maxHp: 100,
        atk: 10,
        def: 5,
        effectiveMoveCooldownMs: 300,
        timeRemainingMs: 120000,
        channelRemainingMs: 0,
        galeRemainingMs: 8500,
        scavRemainingMs: 0,
        cheatDeathActive: false,
        usedPotionKeys: [],
        backpack: [
          {
            id: "loot-1",
            key: "flint",
            name: "燧石结晶",
            rarity: "RARE",
            kind: "material",
          },
        ],
        safeBox: [],
        activeContainerTitle: "未开启容器",
        activeChestDrops: [],
        logs: ["踏入荒原外围裂隙"],
        zones: [
          {
            id: 0,
            name: "Z1 · 裂隙外围",
            width,
            height,
            visited: true,
            exploredCount: tiles.length,
            tiles,
          },
        ],
      },
    },
  } as unknown as DashboardStateResp;
}

describe("RaidBattlefieldViewport & WastelandRaidPanel", () => {
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

  it("injects dynamic --zone-cols and --zone-rows for 11x7 and 8x8 zones and renders deterministic lethal combat badges", async () => {
    let currentState = raidFixture(11, 7);
    const runAction = async (fn: () => Promise<unknown>) => {
      await fn();
    };

    await act(async () => {
      root.render(
        <WastelandRaidPanel state={currentState} runAction={runAction as never} />,
      );
    });

    const mapGrid = container.querySelector(".raid-map-grid") as HTMLElement;
    const minimapGrid = container.querySelector(
      ".raid-minimap-grid",
    ) as HTMLElement;
    expect(mapGrid.style.getPropertyValue("--zone-cols")).toBe("11");
    expect(mapGrid.style.getPropertyValue("--zone-rows")).toBe("7");
    expect(minimapGrid.style.getPropertyValue("--zone-cols")).toBe("11");
    expect(minimapGrid.style.getPropertyValue("--zone-rows")).toBe("7");

    // Enemy HP 30, playerAtk 10 -> 3 rounds -> (3-1)*max(2, 25-5) = 40 dmg >= 35 HP => lethal!
    expect(container.textContent).toContain("HP30·-40");
    expect(container.querySelector(".tile-lethal-warn")).not.toBeNull();
    // Active gale potion countdown shown in HUD
    expect(container.textContent).toContain("疾行 8.5s");

    // Re-render with 8x8 zone (Zone 3)
    currentState = raidFixture(8, 8);
    await act(async () => {
      root.render(
        <WastelandRaidPanel state={currentState} runAction={runAction as never} />,
      );
    });
    expect(mapGrid.style.getPropertyValue("--zone-cols")).toBe("8");
    expect(mapGrid.style.getPropertyValue("--zone-rows")).toBe("8");
  });

  it("auto-starts extraction channeling on stepping onto an open beacon and guards MIA abandon with ConfirmActionModal", async () => {
    const state = raidFixture(11, 7);
    const nextSession = {
      ...state.raidLoadout.activeSession!,
      lastCommandSeq: 2,
      playerX: 1,
      playerY: 2,
      channelRemainingMs: 2800,
    };
    const raidActionSpy = vi.spyOn(api, "raidAction").mockResolvedValue({
      revision: 11,
      playerHandle: "scout_lord",
      raidLoadout: {
        ...state.raidLoadout,
        activeSession: nextSession,
      },
    } as never);
    const finishSpy = vi.spyOn(api, "finishRaid").mockResolvedValue({
      revision: 12,
      playerHandle: "scout_lord",
      raidLoadout: {
        ...state.raidLoadout,
        activeSession: undefined,
      },
    } as never);

    const runAction = async (fn: () => Promise<unknown>) => {
      await fn();
    };

    await act(async () => {
      root.render(
        <WastelandRaidPanel state={state} runAction={runAction as never} />,
      );
    });

    // Step down (0, +1) onto extract_early at (1, 2)
    const stepDownBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("下移 (S)"),
    )!;
    await act(async () => {
      stepDownBtn.click();
    });
    expect(raidActionSpy).toHaveBeenCalledWith({
      raidId: "raid-zone-test",
      commandSeq: 2,
      action: "move",
      dx: 0,
      dy: 1,
    });
    expect(container.textContent).toContain("正在引导外围撤离信标");

    // Click abandon -> opens ConfirmActionModal listing equipped weapon before calling finishRaid("MIA")
    const abandonBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("放弃撤离 (仅保安全箱)"),
    )!;
    await act(async () => {
      abandonBtn.click();
    });
    expect(finishSpy).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("精铁长矛");

    const cancelMiaBtn = Array.from(
      document.body.querySelectorAll("button"),
    ).find((b) => b.textContent?.includes("继续留在裂隙"))!;
    const confirmMiaBtn = Array.from(
      document.body.querySelectorAll("button"),
    ).find((b) => b.textContent?.includes("确认放弃撤离 (M.I.A.)"))!;

    // Focus trap + raid hotkey suspension while ConfirmActionModal is open:
    // Shift+Tab from sheet wraps to last button, Tab from last wraps to first,
    // focusing background controls snaps back into the dialog, and B/WASD/Arrows do not fire raid actions.
    raidActionSpy.mockClear();
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(document.activeElement).toBe(confirmMiaBtn);

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Tab",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(document.activeElement).toBe(cancelMiaBtn);

    await act(async () => {
      abandonBtn.focus();
    });
    expect(document.activeElement).toBe(cancelMiaBtn);

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "b",
          bubbles: true,
          cancelable: true,
        }),
      );
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true,
        }),
      );
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "w",
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    expect(document.querySelector(".raid-loot-modal-backdrop")).toBeNull();
    expect(raidActionSpy).not.toHaveBeenCalled();

    await act(async () => {
      confirmMiaBtn.click();
    });
    expect(finishSpy).toHaveBeenCalledWith({
      raidId: "raid-zone-test",
      commandSeq: 3,
      status: "MIA",
    });
  });
});
