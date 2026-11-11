import { describe, expect, it } from "vitest";
import type {
  BuildingNodeDTO,
  CosmeticSpecDTO,
  DashboardStateResp,
  EquippedCosmeticsDTO,
  ResourceLineDTO,
} from "@drop2empire/api-client";
import {
  applyPreviewCosmetic,
  classifyMarketCategory,
  computeBatchBuildingCosts,
  computeBatchRecruitPreview,
  computeRaidCombatPreview,
  nextResidentCostMilli,
  resolvePublicPlayerOrigin,
  resolveSellableStockMilli,
} from "./settlementSelectors";
import { parseHashRoute } from "../hooks/useGameSession";

describe("settlementSelectors domain formulas", () => {
  it("matches Go NextResidentCostMilli across the n = 40 piecewise threshold", () => {
    expect(nextResidentCostMilli(0)).toBe(10_000);
    expect(nextResidentCostMilli(1)).toBe(12_000); // ceil(10 * 1.12) = 12
    expect(nextResidentCostMilli(39)).toBe(831_000); // ceil(10 * 1.12^39) = ceil(830.76) = 831
    expect(nextResidentCostMilli(40)).toBe(986_000); // ceil(931 + 55 * 1^1.32) = 986
    expect(nextResidentCostMilli(41)).toBe(1_069_000); // ceil(931 + 55 * 2^1.32) = 1069
  });

  it("clamps batch recruitment to housing capacity, water budget, and 50-batch cap", () => {
    const preview = computeBatchRecruitPreview(0, 6, 40_000, 10);
    // n=0 (10k) + n=1 (12k) + n=2 (13k) = 35k <= 40k; n=3 (15k) -> 50k > 40k
    expect(preview.maxAffordableCount).toBe(3);
    expect(preview.actualCount).toBe(6); // clamped to housing room (6 - 0)
    expect(preview.canRecruit).toBe(false);

    const exactThree = computeBatchRecruitPreview(0, 6, 40_000, 3);
    expect(exactThree.totalCostWaterMilli).toBe(35_000);
    expect(exactThree.canRecruit).toBe(true);
  });

  it("computes exact BigInt (5/4)^n building costs without compounding rounded intermediates", () => {
    // For house: base wood = 15.
    // n=0: ceil(15 * 1 / 1) = 15
    // n=1: ceil(15 * 5 / 4) = ceil(18.75) = 19
    // n=2: ceil(15 * 25 / 16) = ceil(23.4375) = 24 (compounding 19*1.25 would yield ceil(23.75)=24,
    //      at n=3: exact ceil(15 * 125 / 64) = ceil(29.296875) = 30)
    // Sum n=0..3: water = 30 + 38 + 47 + 59 = 174k; wood = 15 + 19 + 24 + 30 = 88k
    const resources: ResourceLineDTO[] = [
      {
        key: "water",
        name: "净水",
        tier: "basic",
        unlocked: true,
        amountMilli: 200_000,
        frozenMilli: 0,
        capacityMilli: 300_000,
        grossRatePerSecMilli: 2000,
        drainRatePerSecMilli: 0,
        netRatePerSecMilli: 2000,
        description: "",
      },
      {
        key: "wood",
        name: "木材",
        tier: "basic",
        unlocked: true,
        amountMilli: 80_000,
        frozenMilli: 0,
        capacityMilli: 300_000,
        grossRatePerSecMilli: 1000,
        drainRatePerSecMilli: 0,
        netRatePerSecMilli: 1000,
        description: "",
      },
    ];
    const house: BuildingNodeDTO = {
      code: "house",
      name: "木屋",
      technologyName: "基础木工",
      effectSummary: "住房上限 +4",
      owned: 0,
      limit: 128,
      visible: true,
      researched: true,
      canBuild: true,
      blockedReason: "",
      jobKey: "",
      assigned: 0,
      totalSlots: 0,
      costs: [
        {
          resourceKey: "water",
          resourceName: "净水",
          requiredMilli: 30_000,
          currentMilli: 200_000,
          capacityMilli: 300_000,
          etaSeconds: 0,
        },
        {
          resourceKey: "wood",
          resourceName: "木材",
          requiredMilli: 15_000,
          currentMilli: 80_000,
          capacityMilli: 300_000,
          etaSeconds: 0,
        },
      ],
    };

    const batch4 = computeBatchBuildingCosts(house, 4, resources);
    expect(batch4.quantity).toBe(4);
    expect(batch4.costs[0].requiredMilli).toBe(174_000);
    expect(batch4.costs[1].requiredMilli).toBe(88_000);
    expect(batch4.costs[1].etaSeconds).toBe(8); // deficit 8000 / netRate 1000 = 8s
    expect(batch4.canBuildBatch).toBe(false);
  });

  it("computes deterministic raid combat damage and cheat-death lethality protection", () => {
    // enemyHp=40, playerAtk=15 => rounds = ceil(40/15) = 3
    // enemyAtk=12, playerDef=5 => net=7 => loss = (3-1)*7 = 14
    const safe = computeRaidCombatPreview(40, 12, 15, 5, 20, false);
    expect(safe).toEqual({ rounds: 3, expectedDamage: 14, isLethal: false });

    const lethal = computeRaidCombatPreview(40, 12, 15, 5, 14, false);
    expect(lethal.isLethal).toBe(true);

    const savedByTotem = computeRaidCombatPreview(40, 12, 15, 5, 14, true);
    expect(savedByTotem.isLethal).toBe(false);
  });

  it("classifies market categories and resolves sellable stock across all inventory stores", () => {
    expect(classifyMarketCategory("iron")).toBe("supply");
    expect(classifyMarketCategory("auto_pump")).toBe("equipment");
    expect(classifyMarketCategory("bp_obsidian_blade")).toBe("blueprint");
    expect(classifyMarketCategory("cos_crown_s1")).toBe("cosmetic");

    const mockState = {
      resources: [{ key: "iron", amountMilli: 4500 }],
      installedEquipments: [{ itemKey: "auto_pump", inventoryUnits: 3 }],
      raidGears: [{ blueprintKey: "bp_obsidian_blade", blueprintOwnedCount: 2 }],
      cosmetics: [{ itemKey: "cos_crown_s1", ownedCount: 1 }],
    } as unknown as DashboardStateResp;

    expect(resolveSellableStockMilli(mockState, "iron")).toBe(4500);
    expect(resolveSellableStockMilli(mockState, "auto_pump")).toBe(3000);
    expect(resolveSellableStockMilli(mockState, "bp_obsidian_blade")).toBe(2000);
    expect(resolveSellableStockMilli(mockState, "cos_crown_s1")).toBe(1000);
    expect(resolveSellableStockMilli(mockState, "unknown_item")).toBe(0);
  });

  it("applies exponential (5/4)^n batch escalation to quarry (code: quarry)", () => {
    // quarry base: water=60, wood=30.
    // n=0..4 water: 60 + 75 + 94 + 118 + 147 = 494 units (494_000 milli)
    // n=0..4 wood:  30 + 38 + 47 + 59 + 74   = 248 units (248_000 milli)
    const resources: ResourceLineDTO[] = [
      {
        key: "water",
        name: "净水",
        tier: "basic",
        unlocked: true,
        amountMilli: 500_000,
        frozenMilli: 0,
        capacityMilli: 600_000,
        grossRatePerSecMilli: 1000,
        drainRatePerSecMilli: 0,
        netRatePerSecMilli: 1000,
        description: "",
      },
      {
        key: "wood",
        name: "木材",
        tier: "basic",
        unlocked: true,
        amountMilli: 240_000,
        frozenMilli: 0,
        capacityMilli: 600_000,
        grossRatePerSecMilli: 1000,
        drainRatePerSecMilli: 0,
        netRatePerSecMilli: 1000,
        description: "",
      },
    ];
    const quarry: BuildingNodeDTO = {
      code: "quarry",
      name: "采石场",
      technologyName: "采石技术",
      effectSummary: "采石岗位 +2",
      owned: 0,
      limit: 128,
      visible: true,
      researched: true,
      canBuild: true,
      blockedReason: "",
      jobKey: "quarry_worker",
      assigned: 0,
      totalSlots: 0,
      costs: [
        {
          resourceKey: "water",
          resourceName: "净水",
          requiredMilli: 60_000,
          currentMilli: 500_000,
          capacityMilli: 600_000,
          etaSeconds: 0,
        },
        {
          resourceKey: "wood",
          resourceName: "木材",
          requiredMilli: 30_000,
          currentMilli: 240_000,
          capacityMilli: 600_000,
          etaSeconds: 0,
        },
      ],
    };

    const batch5 = computeBatchBuildingCosts(quarry, 5, resources);
    expect(batch5.quantity).toBe(5);
    expect(batch5.costs[0].requiredMilli).toBe(494_000);
    expect(batch5.costs[1].requiredMilli).toBe(248_000);
    expect(batch5.canBuildBatch).toBe(false);
  });

  it("matches authoritative Go BuildingCosts (5/4)^n ceil escalation across all 6 repeatable buildings for owned={0,3} and ×{1,5,10}", () => {
    const repeatableSpecs: Array<{
      code: string;
      name: string;
      baseUnits: Array<{ key: string; name: string; units: number }>;
    }> = [
      {
        code: "lumber_camp",
        name: "伐木棚",
        baseUnits: [
          { key: "water", name: "净水", units: 20 },
          { key: "wood", name: "木材", units: 10 },
        ],
      },
      {
        code: "house",
        name: "木屋",
        baseUnits: [
          { key: "water", name: "净水", units: 30 },
          { key: "wood", name: "木材", units: 15 },
        ],
      },
      {
        code: "water_cistern",
        name: "蓄水池",
        baseUnits: [
          { key: "water", name: "净水", units: 60 },
          { key: "wood", name: "木材", units: 25 },
        ],
      },
      {
        code: "lumber_yard",
        name: "物资堆场",
        baseUnits: [
          { key: "water", name: "净水", units: 40 },
          { key: "wood", name: "木材", units: 40 },
        ],
      },
      {
        code: "quarry",
        name: "采石场",
        baseUnits: [
          { key: "water", name: "净水", units: 60 },
          { key: "wood", name: "木材", units: 30 },
        ],
      },
      {
        code: "charcoal_kiln",
        name: "炭窑",
        baseUnits: [
          { key: "water", name: "净水", units: 60 },
          { key: "wood", name: "木材", units: 30 },
          { key: "stone", name: "石材", units: 20 },
        ],
      },
    ];

    const authoritativeBuildingCostMilli = (
      baseUnits: number,
      owned: number,
      quantity: number,
    ): number => {
      let totalMilli = 0n;
      const base = BigInt(baseUnits);
      for (let n = owned; n < owned + quantity; n++) {
        const exp = BigInt(n);
        const num = base * 5n ** exp;
        const den = 4n ** exp;
        const ceilUnits = (num + den - 1n) / den;
        totalMilli += ceilUnits * 1000n;
      }
      return Number(totalMilli);
    };

    const buildResources = (
      stocksMilli: Record<string, number>,
    ): ResourceLineDTO[] =>
      ["water", "wood", "stone"].map((key) => ({
        key,
        name: key === "water" ? "净水" : key === "wood" ? "木材" : "石材",
        tier: "basic",
        unlocked: true,
        amountMilli: stocksMilli[key] ?? 0,
        frozenMilli: 0,
        capacityMilli: 50_000_000,
        grossRatePerSecMilli: 1000,
        drainRatePerSecMilli: 0,
        netRatePerSecMilli: 1000,
        description: "",
      }));

    const buildNodeAtOwned = (
      spec: (typeof repeatableSpecs)[number],
      owned: number,
      stocksMilli: Record<string, number>,
    ): BuildingNodeDTO => {
      const singleCosts = spec.baseUnits.map((item) => {
        const requiredMilli = authoritativeBuildingCostMilli(
          item.units,
          owned,
          1,
        );
        const currentMilli = stocksMilli[item.key] ?? 0;
        return {
          resourceKey: item.key,
          resourceName: item.name,
          requiredMilli,
          currentMilli,
          capacityMilli: 50_000_000,
          etaSeconds: 0,
        };
      });
      return {
        code: spec.code,
        name: spec.name,
        technologyName: "基础技术",
        effectSummary: "",
        owned,
        limit: 128,
        visible: true,
        researched: true,
        canBuild: singleCosts.every((c) => c.currentMilli >= c.requiredMilli),
        blockedReason: "",
        jobKey: "",
        assigned: 0,
        totalSlots: 0,
        costs: singleCosts,
      };
    };

    for (const spec of repeatableSpecs) {
      for (const owned of [0, 3]) {
        for (const qty of [1, 5, 10]) {
          const expectedMilliByKey: Record<string, number> = {};
          for (const item of spec.baseUnits) {
            expectedMilliByKey[item.key] = authoritativeBuildingCostMilli(
              item.units,
              owned,
              qty,
            );
          }

          // 1. Exact milli-unit match allows batch construction
          const exactResources = buildResources(expectedMilliByKey);
          const exactNode = buildNodeAtOwned(spec, owned, expectedMilliByKey);
          const exactBatch = computeBatchBuildingCosts(
            exactNode,
            qty,
            exactResources,
          );

          expect(
            exactBatch.quantity,
            `${spec.code} owned=${owned} qty=${qty} quantity`,
          ).toBe(qty);
          for (const item of spec.baseUnits) {
            const actualCost = exactBatch.costs.find(
              (c) => c.resourceKey === item.key,
            );
            expect(
              actualCost?.requiredMilli,
              `${spec.code} owned=${owned} qty=${qty} ${item.key}`,
            ).toBe(expectedMilliByKey[item.key]);
          }
          expect(
            exactBatch.canBuildBatch,
            `${spec.code} owned=${owned} qty=${qty} exact budget canBuildBatch`,
          ).toBe(true);

          // 2. Being 1 milli short on ANY cost resource blocks batch construction
          for (const shortItem of spec.baseUnits) {
            const shortStocks = {
              ...expectedMilliByKey,
              [shortItem.key]: expectedMilliByKey[shortItem.key] - 1,
            };
            const shortResources = buildResources(shortStocks);
            const shortNode = buildNodeAtOwned(spec, owned, shortStocks);
            const shortBatch = computeBatchBuildingCosts(
              shortNode,
              qty,
              shortResources,
            );
            expect(
              shortBatch.canBuildBatch,
              `${spec.code} owned=${owned} qty=${qty} 1 milli short on ${shortItem.key}`,
            ).toBe(false);
          }
        }
      }
    }
  });

  it("parses hash routes safely without throwing URIError on malformed percent-encoding", () => {
    expect(parseHashRoute("#market:auto_pump")).toEqual({
      scene: "market",
      marketItem: "auto_pump",
    });
    expect(parseHashRoute("#market:%")).toEqual({
      scene: "market",
      marketItem: undefined,
    });
    expect(parseHashRoute("#market:%E0%A4%A")).toEqual({
      scene: "market",
      marketItem: undefined,
    });
    expect(parseHashRoute("#admin")).toEqual({ scene: "settlement" });
  });

  it("rejects loopback admin tunnel origins and normalizes public player origins", () => {
    const tunnelLoc = {
      origin: "http://127.0.0.1:18480",
      hostname: "127.0.0.1",
    };
    expect(resolvePublicPlayerOrigin("", tunnelLoc)).toBe("");
    expect(
      resolvePublicPlayerOrigin("http://localhost:5173", tunnelLoc),
    ).toBe("");
    expect(resolvePublicPlayerOrigin("http://[::1]:18480", tunnelLoc)).toBe("");
    expect(
      resolvePublicPlayerOrigin("https://120.25.210.202:8443/path", tunnelLoc),
    ).toBe("https://120.25.210.202:8443");
    expect(
      resolvePublicPlayerOrigin("", {
        origin: "https://d2e.example.com:8443",
        hostname: "d2e.example.com",
      }),
    ).toBe("https://d2e.example.com:8443");
  });

  it("maps all CosmeticCatalog wire slot names including held_relic onto EquippedCosmeticsDTO", () => {
    const base: EquippedCosmeticsDTO = {
      headgear: "cos_crown_s1",
      mantle: "",
      heldRelic: "",
      companion: "",
    };
    const makeCos = (slot: string, itemKey: string) =>
      ({ slot, itemKey }) as CosmeticSpecDTO;

    expect(
      applyPreviewCosmetic(base, makeCos("held_relic", "cos_thunder_staff")),
    ).toEqual({
      ...base,
      heldRelic: "cos_thunder_staff",
    });
    expect(
      applyPreviewCosmetic(base, makeCos("headgear", "cos_obsidian_helm")),
    ).toEqual({
      ...base,
      headgear: "cos_obsidian_helm",
    });
    expect(
      applyPreviewCosmetic(base, makeCos("mantle", "cos_argent_cloak")),
    ).toEqual({
      ...base,
      mantle: "cos_argent_cloak",
    });
    expect(
      applyPreviewCosmetic(base, makeCos("companion", "cos_owl_s1")),
    ).toEqual({
      ...base,
      companion: "cos_owl_s1",
    });
  });
});
