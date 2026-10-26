import {
  api,
  type CompanyPlanDTO,
  type DashboardStateResp,
  type EconomyActionReq,
} from "@drop2empire/api-client";

export const emptyCompanyPlan: CompanyPlanDTO = {
  route: "standard",
  activeLines: 1,
  askPriceBasis: 0,
  inputBudgetBasis: 0,
  pack: "",
  expandWith: "",
  dividendBasis: 0,
  capitalBudgetBasis: 0,
};
export function economyCommand(
  state: DashboardStateResp,
  action: string,
  fields: Partial<EconomyActionReq> = {},
) {
  return api.economyAction({
    action,
    target: "",
    option: "",
    quantity: 0,
    voteId: 0,
    approve: false,
    plan: emptyCompanyPlan,
    ...fields,
    commandSeq: state.settlement.commandSeq + 1,
  });
}
export function fixedInput(text: string, places: number): number {
  if (!/^\d+(\.\d+)?$/.test(text.trim())) throw new Error("请输入非负数字");
  const [whole, fraction = ""] = text.trim().split(".");
  if (fraction.length > places) throw new Error(`最多保留 ${places} 位小数`);
  const value =
    BigInt(whole) * 10n ** BigInt(places) +
    BigInt(fraction.padEnd(places, "0") || "0");
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("金额超出范围");
  return Number(value);
}
