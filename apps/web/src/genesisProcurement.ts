import type { MonetaryPolicyReq } from "@drop2empire/api-client";

export interface GenesisPolicyStep {
  policyId: string;
  label: string;
  summary: string;
  req: MonetaryPolicyReq;
}

export const GENESIS_TOTAL_GOLD_BASIS = 80_000_000; // 8,000.0000 Gold

export const GENESIS_PROCUREMENT_ITEMS = [
  {
    itemKey: "water",
    label: "洁净饮水",
    quantityUnits: 8000,
    quantityMilli: 8_000_000,
    priceGold: "0.1000",
    priceBasis: 1_000,
    budgetBasis: 8_000_000, // 800 G
  },
  {
    itemKey: "wood",
    label: "原木",
    quantityUnits: 4000,
    quantityMilli: 4_000_000,
    priceGold: "0.4500",
    priceBasis: 4_500,
    budgetBasis: 18_000_000, // 1,800 G
  },
  {
    itemKey: "stone",
    label: "石材",
    quantityUnits: 2000,
    quantityMilli: 2_000_000,
    priceGold: "0.9500",
    priceBasis: 9_500,
    budgetBasis: 19_000_000, // 1,900 G
  },
  {
    itemKey: "charcoal",
    label: "木炭",
    quantityUnits: 1000,
    quantityMilli: 1_000_000,
    priceGold: "1.2000",
    priceBasis: 12_000,
    budgetBasis: 12_000_000, // 1,200 G
  },
  {
    itemKey: "iron_ingot",
    label: "铁锭",
    quantityUnits: 500,
    quantityMilli: 500_000,
    priceGold: "3.2000",
    priceBasis: 32_000,
    budgetBasis: 16_000_000, // 1,600 G
  },
  {
    itemKey: "flint",
    label: "燧石结晶",
    quantityUnits: 250,
    quantityMilli: 250_000,
    priceGold: "2.8000",
    priceBasis: 28_000,
    budgetBasis: 7_000_000, // 700 G
  },
] as const;

export const DEFAULT_GENESIS_POLICY_PREFIX = "s1-genesis-001";

/**
 * Builds the 8 deterministic, idempotent monetary policy requests specified in
 * docs/operations/economy-clean-start.md ("首批受控公共采购", total commitment = 8,000.0000 Gold).
 */
export function buildGenesisProcurementPlan(rawPrefix: string): GenesisPolicyStep[] {
  const clean = rawPrefix.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  const prefix = clean.length >= 2 ? clean.slice(0, 48) : DEFAULT_GENESIS_POLICY_PREFIX;

  const steps: GenesisPolicyStep[] = [
    {
      policyId: `${prefix}-issue-001`,
      label: "1. 获准发行至联盟准备金",
      summary: "8,000.0000 G → 联盟准备金",
      req: {
        policyId: `${prefix}-issue-001`,
        action: "issue",
        amountBasis: GENESIS_TOTAL_GOLD_BASIS,
        itemKey: "",
        quantityMilli: 0,
        priceBasis: 0,
      },
    },
    {
      policyId: `${prefix}-fund-001`,
      label: "2. 划拨至公共采购账户",
      summary: "8,000.0000 G → @public 现金",
      req: {
        policyId: `${prefix}-fund-001`,
        action: "fund_public",
        amountBasis: GENESIS_TOTAL_GOLD_BASIS,
        itemKey: "",
        quantityMilli: 0,
        priceBasis: 0,
      },
    },
  ];

  GENESIS_PROCUREMENT_ITEMS.forEach((item, idx) => {
    const policyId = `${prefix}-buy-${item.itemKey}-001`;
    steps.push({
      policyId,
      label: `${idx + 3}. 限价采购【${item.label}】`,
      summary: `${item.quantityUnits.toLocaleString("en-US")} × ${item.priceGold} G (${(item.budgetBasis / 10000).toLocaleString("en-US")} G)`,
      req: {
        policyId,
        action: "procure",
        amountBasis: 0,
        itemKey: item.itemKey,
        quantityMilli: item.quantityMilli,
        priceBasis: item.priceBasis,
      },
    });
  });

  return steps;
}
