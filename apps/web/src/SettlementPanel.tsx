import { useState } from "react";
import {
  api,
  type CostItemDTO,
  type DashboardStateResp,
} from "@drop2empire/api-client";
import { EDICT_BUILDING_MAP } from "./config/gameConfig";
import {
  computeBatchBuildingCosts,
  computeBatchRecruitPreview,
} from "./domain/settlementSelectors";
import type { WorldZoneKey } from "./features/macro/types";
import { formatETA, formatResource } from "./format";

export function SettlementCosts({ costs }: { costs: CostItemDTO[] }) {
  return (
    <div className="bp-costs">
      {costs.map((cost) => {
        const enough = cost.currentMilli >= cost.requiredMilli;
        const capacityBlocked =
          !enough &&
          cost.capacityMilli > 0 &&
          cost.requiredMilli > cost.capacityMilli;
        return (
          <span
            key={cost.resourceKey}
            className={`cost-chip mono-num ${enough ? "cost-ok" : "cost-lack"}`}
            title={
              capacityBlocked
                ? "仓容不足，请先扩仓"
                : enough
                  ? "材料充足"
                  : formatETA(cost.etaSeconds)
            }
          >
            {cost.resourceName} {formatResource(cost.currentMilli, 0)} /{" "}
            {formatResource(cost.requiredMilli, 0)}
            {capacityBlocked
              ? " · 需扩仓"
              : !enough && cost.etaSeconds > 0
                ? ` (${formatETA(cost.etaSeconds)})`
                : ""}
          </span>
        );
      })}
    </div>
  );
}

type Props = {
  state: DashboardStateResp;
  busy: boolean;
  onOpenIndustry?: () => void;
  onNavigateScene?: (scene: WorldZoneKey) => void;
  runAction: (
    fn: () => Promise<DashboardStateResp>,
    successMessage?: string,
    scope?: string,
  ) => Promise<void>;
};

export function SettlementPanel({
  state,
  busy,
  onOpenIndustry,
  onNavigateScene,
  runAction,
}: Props) {
  const [tab, setTab] = useState<"build" | "research" | "caravan">("build");
  const [recruitBatch, setRecruitBatch] = useState<1 | 5 | 10 | "max">(1);
  const [buildBatchByCode, setBuildBatchByCode] = useState<
    Record<string, number>
  >({});

  const { player, settlement } = state;
  const housingFull = player.populationTotal >= settlement.housingCapacity;
  const water =
    state.resources.find((r) => r.key === "water")?.amountMilli ?? 0;

  const maxPreview = computeBatchRecruitPreview(
    player.populationTotal,
    settlement.housingCapacity,
    water,
    50,
  );
  const requestedRecruitCount =
    recruitBatch === "max"
      ? Math.max(1, maxPreview.maxAffordableCount)
      : recruitBatch;
  const activeRecruitPreview = computeBatchRecruitPreview(
    player.populationTotal,
    settlement.housingCapacity,
    water,
    requestedRecruitCount,
  );
  const canRecruitSelected = !busy && activeRecruitPreview.canRecruit;

  const technologies = settlement.technologies.filter((t) => t.visible);
  const projects = state.blueprints.filter(
    (b) => b.visible && b.kind !== "building",
  );
  const hasCaravan = settlement.buildings.some(
    (b) => b.code === "caravan_post" && b.owned > 0,
  );
  const activeTab = tab === "caravan" && !hasCaravan ? "build" : tab;
  const commandSeq = settlement.commandSeq + 1;
  const edicts = state.edicts ?? [];

  const scrollToEdicts = () => {
    if (typeof document === "undefined") return;
    document
      .getElementById("settlement-edicts-anchor")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section className="panel" aria-label="发展">
      <div className="panel-header">
        <div className="panel-title">
          <h2>招募与建设</h2>
        </div>
        <span className="tag-badge mono-num">
          住房 {player.populationTotal} / {settlement.housingCapacity}
        </span>
      </div>

      {player.profession !== "none" && (
        <div className="bp-card" aria-label="职业发展">
          <strong>{settlement.guideTitle}</strong>
          <p className="bp-desc">{settlement.guideText}</p>
          {(onOpenIndustry || onNavigateScene) && (
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                onOpenIndustry
                  ? onOpenIndustry()
                  : onNavigateScene?.("market")
              }
            >
              进入职业工坊与市场
            </button>
          )}
        </div>
      )}

      <div className="recruit-card">
        <div className="recruit-meta">
          <div className="recruit-head">
            <strong>招募居民</strong>
            <span className="tag-badge mono-num">
              {housingFull
                ? "住房已满"
                : formatETA(player.nextResidentEtaSeconds)}
            </span>
          </div>
          <div className="recruit-cost mono-num">
            {activeRecruitPreview.actualCount === 1
              ? `${formatResource(player.nextResidentCostWaterMilli, 0)} 水 / 下一位`
              : `批量 +${activeRecruitPreview.actualCount} 位 · 共需 ${formatResource(activeRecruitPreview.totalCostWaterMilli, 0)} 水`}
          </div>
          {settlement.housingCapacity - player.populationTotal > 1 && (
            <div className="batch-pill-group" role="group" aria-label="招募批次">
              {([1, 5, 10, "max"] as const).map((opt) => (
                <button
                  key={String(opt)}
                  type="button"
                  className={`btn-chip mono-num ${recruitBatch === opt ? "active" : ""}`}
                  onClick={() => setRecruitBatch(opt)}
                >
                  {opt === "max"
                    ? `最大(${maxPreview.maxAffordableCount})`
                    : `×${opt}`}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="recruit-btns">
          <button
            type="button"
            className="btn-primary mono-num"
            disabled={!canRecruitSelected}
            onClick={() =>
              void runAction(() =>
                api.recruitResident({
                  count: activeRecruitPreview.actualCount,
                }),
              )
            }
          >
            {activeRecruitPreview.actualCount === 1
              ? "招募 +1"
              : `招募 +${activeRecruitPreview.actualCount}`}
          </button>
        </div>
      </div>

      <div className="quick-alloc-bar" aria-label="发展分类">
        <button
          type="button"
          className={activeTab === "build" ? "btn-primary" : "btn-outline"}
          aria-pressed={activeTab === "build"}
          onClick={() => setTab("build")}
        >
          建设
        </button>
        <button
          type="button"
          className={activeTab === "research" ? "btn-primary" : "btn-outline"}
          aria-pressed={activeTab === "research"}
          onClick={() => setTab("research")}
        >
          技术与工程
        </button>
        {hasCaravan && (
          <button
            type="button"
            className={activeTab === "caravan" ? "btn-primary" : "btn-outline"}
            aria-pressed={activeTab === "caravan"}
            onClick={() => setTab("caravan")}
          >
            游商
          </button>
        )}
      </div>

      {activeTab === "build" && (
        <div className="blueprint-list">
          {settlement.buildings.length === 0 && (
            <div className="bp-card">
              <strong>先掌握基础木工</strong>
              <p className="bp-desc">
                技术开放施工方案，建造仍需投入材料。拾枝岗位可取得第一批木材。
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setTab("research")}
              >
                查看技术
              </button>
            </div>
          )}

          {settlement.buildings
            .filter((b) => b.visible)
            .map((building) => {
              const job = state.jobs.find((j) => j.jobKey === building.jobKey);
              const complete = building.owned >= building.limit;
              const outputKey = building.jobKey;
              const stock = state.resources.find((r) => r.key === outputKey);
              const storageFull =
                stock &&
                stock.capacityMilli > 0 &&
                stock.amountMilli >= stock.capacityMilli;

              const edictMeta = EDICT_BUILDING_MAP[building.code];
              const linkedEdicts = edictMeta
                ? edicts.filter((e) => edictMeta.edictCodes.includes(e.code))
                : [];
              const anyLinkedEdictActive = linkedEdicts.some((e) => e.active);

              let status = "已生效";
              if (building.owned === 0) {
                status = "已掌握 · 尚未建造";
              } else if (edictMeta && linkedEdicts.length > 0) {
                status = anyLinkedEdictActive
                  ? `已建成 · ${edictMeta.label}运行中`
                  : `已建成 · 待在法令栏开启（${edictMeta.label}）`;
              } else if (job) {
                status =
                  building.assigned === 0
                    ? "等待安排居民"
                    : job.totalOutputPerSecMilli === 0
                      ? "原料不足 · 暂停生产"
                      : storageFull
                        ? "仓储已满 · 新产出无法入库"
                        : "生产中";
              }

              const selectedQty = buildBatchByCode[building.code] ?? 1;
              const batchPreview = computeBatchBuildingCosts(
                building,
                selectedQty,
                state.resources,
              );
              const canBuildNow = !busy && batchPreview.canBuildBatch;

              return (
                <article
                  key={building.code}
                  className={`bp-card ${batchPreview.canBuildBatch && !complete ? "bp-ready" : ""}`}
                >
                  <div className="bp-top">
                    <strong>{building.name}</strong>
                    <div className="batch-pill-group">
                      {!complete && building.limit > 1 && (
                        <>
                          {[1, 5, 10].map((q) => (
                            <button
                              key={q}
                              type="button"
                              className={`btn-chip mono-num ${selectedQty === q ? "active" : ""}`}
                              onClick={() =>
                                setBuildBatchByCode((prev) => ({
                                  ...prev,
                                  [building.code]: q,
                                }))
                              }
                            >
                              ×{q}
                            </button>
                          ))}
                        </>
                      )}
                      <span className="tag-badge mono-num">
                        已建 {building.owned} 座
                      </span>
                    </div>
                  </div>
                  <p className="bp-desc mono-num">{building.effectSummary}</p>
                  <p className="muted-note">
                    {status}
                    {building.jobKey && (
                      <span className="mono-num">
                        {" "}
                        · 岗位 {building.assigned}/{building.totalSlots}
                      </span>
                    )}
                  </p>

                  {building.owned > 0 &&
                    edictMeta &&
                    !anyLinkedEdictActive && (
                      <div className="bp-inline-jump">
                        <button
                          type="button"
                          className="btn-link"
                          onClick={scrollToEdicts}
                        >
                          前往左侧岗位与法令栏开启 ➔
                        </button>
                      </div>
                    )}

                  {building.owned > 0 &&
                    onNavigateScene &&
                    building.code === "scout_camp" && (
                      <div className="bp-inline-jump">
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          onClick={() => onNavigateScene("scout")}
                        >
                          前往荒原斥候营 ➔
                        </button>
                      </div>
                    )}

                  {building.owned > 0 &&
                    onNavigateScene &&
                    building.code === "basic_workshop" &&
                    state.player.profession !== "none" && (
                      <div className="bp-inline-jump">
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          onClick={() => onNavigateScene("market")}
                        >
                          前往皇家工坊与交易所 ➔
                        </button>
                      </div>
                    )}

                  {!complete && (
                    <>
                      <div className="bp-footer">
                        <SettlementCosts costs={batchPreview.costs} />
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={!canBuildNow}
                          onClick={() =>
                            void runAction(() =>
                              api.constructBuilding({
                                code: building.code,
                                quantity: batchPreview.quantity,
                                commandSeq,
                              }),
                            )
                          }
                        >
                          {batchPreview.quantity > 1
                            ? `增建 ×${batchPreview.quantity}`
                            : building.owned
                              ? "增建一座"
                              : "建造首座"}
                        </button>
                      </div>
                      {building.blockedReason && batchPreview.quantity === 1 && (
                        <p className="muted-note mono-num">
                          {building.blockedReason}
                        </p>
                      )}
                      {building.jobKey && (
                        <small className="muted-note">
                          建造增加岗位；分配居民后才增加产出。
                        </small>
                      )}
                    </>
                  )}
                </article>
              );
            })}
        </div>
      )}

      {activeTab === "research" && (
        <div className="blueprint-list">
          <p className="muted-note">
            技术只需研究一次。设施每次建造都消耗材料，工程部件可按需选择顺序。
          </p>
          {technologies
            .filter((t) => !t.researched)
            .map((technology) => (
              <article
                key={technology.code}
                className={`bp-card ${technology.canResearch ? "bp-ready" : ""}`}
              >
                <div className="bp-top">
                  <strong>{technology.name}</strong>
                  <span className="tag-badge">研究一次</span>
                </div>
                <p className="bp-desc">{technology.effectSummary}</p>
                <div className="bp-footer">
                  <SettlementCosts costs={technology.costs} />
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy || !technology.canResearch}
                    onClick={() =>
                      void runAction(() =>
                        api.researchTechnology({
                          code: technology.code,
                          commandSeq,
                        }),
                      )
                    }
                  >
                    研究
                  </button>
                </div>
                {technology.blockedReason && (
                  <p className="muted-note mono-num">
                    {technology.blockedReason}
                  </p>
                )}
              </article>
            ))}

          {projects
            .filter((p) => !p.unlocked)
            .map((project) => (
              <article
                key={project.code}
                className={`bp-card ${project.canUnlock ? "bp-ready" : ""}`}
              >
                <div className="bp-top">
                  <strong>{project.name}</strong>
                  <span className="bp-pop-req">
                    {project.kind === "project" ? "工程" : "改良"}
                  </span>
                </div>
                <p className="bp-desc mono-num">{project.effectSummary}</p>
                <div className="bp-footer">
                  <SettlementCosts costs={project.costs} />
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy || !project.canUnlock}
                    onClick={() =>
                      void runAction(() =>
                        api.unlockBlueprint({ code: project.code }),
                      )
                    }
                  >
                    {project.code === "mystery_treasure"
                      ? "装配"
                      : project.kind === "project"
                        ? "制造"
                        : "改良"}
                  </button>
                </div>
                {project.blockedReason && (
                  <p className="muted-note mono-num">{project.blockedReason}</p>
                )}
              </article>
            ))}

          {(technologies.some((t) => t.researched) ||
            projects.some((p) => p.unlocked)) && (
            <details className="settlement-item">
              <summary>已掌握与已完成</summary>
              {technologies
                .filter((t) => t.researched)
                .map((t) => (
                  <div key={t.code} className="bp-card bp-unlocked">
                    <strong>{t.name}</strong>
                    <p className="bp-desc">{t.effectSummary}</p>
                  </div>
                ))}
              {projects
                .filter((p) => p.unlocked)
                .map((p) => (
                  <div key={p.code} className="bp-card bp-unlocked">
                    <strong>{p.name}</strong>
                    <p className="bp-desc mono-num">{p.effectSummary}</p>
                  </div>
                ))}
            </details>
          )}
        </div>
      )}

      {activeTab === "caravan" && (
        <div className="blueprint-list">
          <p className="muted-note">
            只提供已认识物资的易物。扩建住房后才能安置游商带来的居民。
          </p>
          {state.caravanOffers.map((offer) => (
            <article className="bp-card" key={offer.offerCode}>
              <strong>{offer.title}</strong>
              <p className="bp-desc mono-num">{offer.rewardSummary}</p>
              <div className="bp-footer">
                <SettlementCosts costs={offer.costs} />
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy || !offer.canTrade}
                  onClick={() =>
                    void runAction(() =>
                      api.tradeCaravan({ offerCode: offer.offerCode }),
                    )
                  }
                >
                  兑换
                </button>
              </div>
            </article>
          ))}
          {!state.caravanOffers.length && (
            <p className="muted-note">
              持续生产，认识更多物资后会出现相应契约。
            </p>
          )}
        </div>
      )}
    </section>
  );
}
