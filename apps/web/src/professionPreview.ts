import type {
  ConsumableDTO,
  CostItemDTO,
  DashboardStateResp,
} from "@drop2empire/api-client";

export function costStatus(cost: CostItemDTO): string {
  if (cost.currentMilli >= cost.requiredMilli) return "";
  if (cost.capacityMilli > 0 && cost.requiredMilli > cost.capacityMilli)
    return "先扩仓";
  return cost.etaSeconds < 0 ? "安排生产或购买" : "积攒中";
}

function withETA(cost: CostItemDTO, state: DashboardStateResp): CostItemDTO {
  const rate =
    state.resources.find((r) => r.key === cost.resourceKey)
      ?.netRatePerSecMilli ?? 0;
  const missing = cost.requiredMilli - cost.currentMilli;
  const blocked =
    cost.capacityMilli > 0 && cost.requiredMilli > cost.capacityMilli;
  return {
    ...cost,
    etaSeconds:
      missing <= 0 ? 0 : blocked || rate <= 0 ? -1 : Math.ceil(missing / rate),
  };
}

// Display projection only. The sequenced server command revalidates the full
// amount and charges at submission, including integer rounding per batch.
export function craftPreview(
  item: ConsumableDTO,
  state: DashboardStateResp,
  batches: number,
) {
  if (!Number.isInteger(batches) || batches < 1 || batches > 20) return null;
  const ps = state.economy.professional;
  const boosted = Math.min(ps.productionCharges, batches);
  const costs = item.costs.map((c) => {
    let special = c.requiredMilli;
    if (ps.productionMode === "industrial_catalyst")
      special = Math.ceil((special * 9) / 10);
    if (ps.productionMode === "overload_battery" && c.resourceKey === "water")
      special = Math.ceil((special * 12) / 10);
    return withETA(
      {
        ...c,
        requiredMilli:
          c.requiredMilli * (batches - boosted) + special * boosted,
      },
      state,
    );
  });
  const seconds =
    ps.level === 2 ? Math.floor((item.seconds * 8) / 10) : item.seconds;
  const boostedSeconds =
    ps.productionMode === "overload_battery"
      ? Math.floor((seconds * 8) / 10)
      : seconds;
  return {
    costs,
    seconds: seconds * (batches - boosted) + boostedSeconds * boosted,
    outputMilli: item.outputMilli * batches,
  };
}

export function facilityPreview(
  state: DashboardStateResp,
  pack: string,
): CostItemDTO[] {
  const ps = state.economy.professional;
  const usePack = ps.level === 1 && Boolean(pack);
  const costs = ps.buildCosts.map((c) =>
    withETA(
      {
        ...c,
        requiredMilli: usePack
          ? Math.floor((c.requiredMilli * 8) / 10)
          : c.requiredMilli,
      },
      state,
    ),
  );
  if (usePack)
    costs.push({
      resourceKey: pack,
      resourceName: pack === "heavy_workpack" ? "重载作业包" : "精密作业包",
      currentMilli:
        state.resources.find((r) => r.key === pack)?.amountMilli ?? 0,
      requiredMilli: 4000,
      capacityMilli: 0,
      etaSeconds: -1,
    });
  return costs;
}
