// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type DashboardStateResp } from "@drop2empire/api-client";
import { WarGuildSceneView } from "./features/macro/WarGuildSceneView";

function warFixture(): DashboardStateResp {
  return {
    player: {
      handle: "quartermaster",
      profession: "artisan",
      professionName: "工匠",
      goldBasis: 600000,
    },
    settlement: {
      commandSeq: 7,
    },
    resources: [
      { key: "water", name: "水", amountMilli: 120000 },
      { key: "wood", name: "木材", amountMilli: 80000 },
      { key: "stone", name: "石材", amountMilli: 40000 },
      { key: "infantry_kit", name: "重步兵军备", amountMilli: 10000 },
      { key: "archer_kit", name: "长弓兵军备", amountMilli: 6000 },
      { key: "cavalry_kit", name: "铁骑兵军备", amountMilli: 4000 },
      { key: "heavy_workpack", name: "重载作业包", amountMilli: 2000 },
      { key: "precision_workpack", name: "精密作业包", amountMilli: 1000 },
      { key: "defense_ward", name: "守城结界", amountMilli: 1000 },
    ],
    war: {
      seasonCode: "S1-OBSIDIAN-AWAKENING",
      seasonName: "S1 · 黑曜苏醒",
      currentDay: 2,
      nextSettlementLabel: "每日 20:00 (UTC+8) 锁定快照结算",
      playerGuild: "OBSIDIAN",
      playerGuildName: "[INK] 墨械先驱团 · OBSIDIAN",
      playerRole: "公会执政官 & 军需官",
      dailyBudgetUsed: 5,
      dailyBudgetCap: 100,
      obsidianTotalScore: 70,
      argentTotalScore: 70,
      joinedGuildId: "guild_obsidian_vanguard",
      playerGuildContribution: 240,
      guilds: [
        {
          guildId: "guild_obsidian_vanguard",
          name: "墨械先驱团",
          tag: "INK",
          faction: "OBSIDIAN",
          factionName: "黑曜商会 (OBSIDIAN)",
          leaderHandle: "quartermaster",
          level: 2,
          xp: 20,
          nextLevelXp: 1000,
          memberCount: 1,
          treasuryGoldBasis: 0,
          rallyNodeId: "node_north_fort",
          rallyNodeName: "北侧据点",
          announcement: "优先集结北侧据点",
          bonusSummary:
            "黑曜商会直属 · Lv.2 公会战旗：集结目标城池攻防 +16%，每日战区结算额外 +10 活动积分",
          members: [
            {
              handle: "quartermaster",
              role: "会长",
              contribution: 240,
              warDeployed: 5,
            },
          ],
        },
      ],
      nodes: [
        {
          nodeId: "node_north_fort",
          name: "北侧据点",
          region: "north",
          x: 400,
          y: 95,
          ownerGuild: "NEUTRAL",
          defenseBonusPct: 25,
          dailyScore: 30,
          isTreasureVault: false,
          garrisonPower: 22500,
          infantryCount: 6,
          archerCount: 6,
          cavalryCount: 6,
          myInfantry: 5,
          myArcher: 0,
          myCavalry: 0,
          canDeploy: true,
          supplyConnected: false,
          intelNote: "北线高地；集结：黑曜战旗 +16%",
        },
      ],
      edges: [],
      settlementHistory: [],
    },
  } as unknown as DashboardStateResp;
}

describe("WarGuildSceneView corporate workpack donations and node tactical support", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
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

  it("donates corporate workpacks in Guild Hall and dispatches sequenced node support", async () => {
    const state = warFixture();
    const guildSpy = vi.spyOn(api, "guildAction").mockResolvedValue(state);
    const econSpy = vi.spyOn(api, "economyAction").mockResolvedValue(state);
    const runAction = async (fn: () => Promise<DashboardStateResp>) => {
      await fn();
    };

    await act(async () => {
      root.render(<WarGuildSceneView state={state} runAction={runAction} />);
    });

    const heavyDonateBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("重载包捐献"),
    )!;
    expect(heavyDonateBtn).toBeTruthy();
    expect(heavyDonateBtn.disabled).toBe(false);
    await act(async () => {
      heavyDonateBtn.click();
    });
    expect(guildSpy).toHaveBeenCalledWith({ action: "donate_heavy_pack" });

    // On NEUTRAL node_north_fort where myInfantry=5:
    // - heavy_workpack support button is enabled and dispatches economyAction("use")
    // - defense_ward is friendlyOnly and must be disabled with "仅限己方城池"
    const supportPanel = container.querySelector(
      '[aria-label="据点战术与企业作业包支援"]',
    )!;
    expect(supportPanel).toBeTruthy();

    const rows = Array.from(supportPanel.querySelectorAll(".intel-row"));
    const heavyRow = rows.find((r) => r.textContent?.includes("重载作业包"))!;
    const heavySupportBtn = heavyRow.querySelector("button")!;
    expect(heavySupportBtn.disabled).toBe(false);

    const wardRow = rows.find((r) => r.textContent?.includes("守城结界"))!;
    const wardBtn = wardRow.querySelector("button")!;
    expect(wardBtn.disabled).toBe(true);
    expect(wardBtn.textContent).toContain("仅限己方城池");

    await act(async () => {
      heavySupportBtn.click();
    });
    expect(econSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        commandSeq: 8,
        action: "use",
        target: "heavy_workpack",
        option: "node_north_fort",
      }),
    );
  });
});
