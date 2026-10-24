import { useState } from "react";
import { api, type CostItemDTO, type DashboardStateResp } from "@drop2empire/api-client";
import { formatETA, formatResource } from "./format";

export function SettlementCosts({ costs }: { costs: CostItemDTO[] }) {
  return <div className="bp-costs">{costs.map((cost) => {
    const enough = cost.currentMilli >= cost.requiredMilli;
    const capacityBlocked = !enough && cost.capacityMilli > 0 && cost.requiredMilli > cost.capacityMilli;
    return <span key={cost.resourceKey} className={`cost-chip mono-num ${enough ? "cost-ok" : "cost-lack"}`}
      title={capacityBlocked ? "仓容不足，请先扩仓" : enough ? "材料充足" : formatETA(cost.etaSeconds)}>
      {cost.resourceName} {formatResource(cost.currentMilli, 0)} / {formatResource(cost.requiredMilli, 0)}
      {capacityBlocked && " · 需扩仓"}
    </span>;
  })}</div>;
}

type Props = {
  state: DashboardStateResp;
  busy: boolean;
  runAction: (fn: () => Promise<DashboardStateResp>, successMessage?: string) => Promise<void>;
};

export function SettlementPanel({ state, busy, runAction }: Props) {
  const [tab, setTab] = useState<"build" | "research" | "caravan">("build");
  const { player, settlement } = state;
  const housingFull = player.populationTotal >= settlement.housingCapacity;
  const water = state.resources.find((r) => r.key === "water")?.amountMilli ?? 0;
  const canRecruit = !busy && !housingFull && water >= player.nextResidentCostWaterMilli;
  const technologies = settlement.technologies.filter((t) => t.visible);
  const projects = state.blueprints.filter((b) => b.visible && b.kind !== "building");
  const hasCaravan = settlement.buildings.some((b) => b.code === "caravan_post" && b.owned > 0);
  const activeTab = tab === "caravan" && !hasCaravan ? "build" : tab;
  const commandSeq = settlement.commandSeq + 1;

  return <section className="panel" aria-label="发展">
    <div className="panel-header">
      <div className="panel-title"><h2>招募与建设</h2></div>
      <span className="tag-badge mono-num">住房 {player.populationTotal} / {settlement.housingCapacity}</span>
    </div>
    <div className="recruit-card">
      <div className="recruit-meta">
        <div className="recruit-head"><strong>招募居民</strong><span className="tag-badge mono-num">
          {housingFull ? "住房已满" : formatETA(player.nextResidentEtaSeconds)}
        </span></div>
        <div className="recruit-cost mono-num">{formatResource(player.nextResidentCostWaterMilli, 0)} 水 / 下一位</div>
      </div>
      <div className="recruit-btns"><button type="button" className="btn-primary mono-num" disabled={!canRecruit}
        onClick={() => void runAction(() => api.recruitResident({ count: 1 }))}>招募 +1</button></div>
    </div>
    <div className="quick-alloc-bar" aria-label="发展分类">
      <button type="button" className={activeTab === "build" ? "btn-primary" : "btn-outline"} aria-pressed={activeTab === "build"} onClick={() => setTab("build")}>建设</button>
      <button type="button" className={activeTab === "research" ? "btn-primary" : "btn-outline"} aria-pressed={activeTab === "research"} onClick={() => setTab("research")}>技术与工程</button>
      {hasCaravan && <button type="button" className={activeTab === "caravan" ? "btn-primary" : "btn-outline"} aria-pressed={activeTab === "caravan"} onClick={() => setTab("caravan")}>游商</button>}
    </div>
    {activeTab === "build" && <div className="blueprint-list">
      {settlement.buildings.length === 0 && <div className="bp-card">
        <strong>先掌握基础木工</strong><p className="bp-desc">技术开放施工方案，建造仍需投入材料。拾枝岗位可取得第一批木材。</p>
        <button type="button" className="btn-primary" onClick={() => setTab("research")}>查看技术</button>
      </div>}
      {settlement.buildings.filter((b) => b.visible).map((building) => {
        const job = state.jobs.find((j) => j.jobKey === building.jobKey);
        const complete = building.owned >= building.limit;
        const outputKey = building.jobKey;
        const stock = state.resources.find((r) => r.key === outputKey);
        const storageFull = stock && stock.capacityMilli > 0 && stock.amountMilli >= stock.capacityMilli;
        const status = building.owned === 0 ? "已掌握 · 尚未建造" : !job ? "已生效" :
          building.assigned === 0 ? "等待安排居民" : job.totalOutputPerSecMilli === 0 ? "原料不足 · 暂停生产" : storageFull ? "仓储已满 · 新产出无法入库" : "生产中";
        return <article key={building.code} className={`bp-card ${building.canBuild ? "bp-ready" : ""}`}>
          <div className="bp-top"><strong>{building.name}</strong><span className="tag-badge mono-num">已建 {building.owned} 座</span></div>
          <p className="bp-desc mono-num">{building.effectSummary}</p>
          <p className="muted-note">{status}{building.jobKey && <span className="mono-num"> · 岗位 {building.assigned}/{building.totalSlots}</span>}</p>
          {!complete && <>
            <div className="bp-footer"><SettlementCosts costs={building.costs} />
              <button type="button" className="btn-primary" disabled={busy || !building.canBuild}
                onClick={() => void runAction(() => api.constructBuilding({ code: building.code, quantity: 1, commandSeq }))}>
                {building.owned ? "增建一座" : "建造首座"}
              </button>
            </div>
            {building.blockedReason && <p className="muted-note mono-num">{building.blockedReason}</p>}
            {building.jobKey && <small className="muted-note">建造增加岗位；分配居民后才增加产出。</small>}
          </>}
        </article>;
      })}
    </div>}
    {activeTab === "research" && <div className="blueprint-list">
      <p className="muted-note">技术只需研究一次。设施每次建造都消耗材料，工程部件可按需选择顺序。</p>
      {technologies.filter((t) => !t.researched).map((technology) => <article key={technology.code} className={`bp-card ${technology.canResearch ? "bp-ready" : ""}`}>
        <div className="bp-top"><strong>{technology.name}</strong><span className="tag-badge">研究一次</span></div>
        <p className="bp-desc">{technology.effectSummary}</p>
        <div className="bp-footer"><SettlementCosts costs={technology.costs} />
          <button type="button" className="btn-primary" disabled={busy || !technology.canResearch}
            onClick={() => void runAction(() => api.researchTechnology({ code: technology.code, commandSeq }))}>研究</button>
        </div>
        {technology.blockedReason && <p className="muted-note mono-num">{technology.blockedReason}</p>}
      </article>)}
      {projects.filter((p) => !p.unlocked).map((project) => <article key={project.code} className={`bp-card ${project.canUnlock ? "bp-ready" : ""}`}>
        <div className="bp-top"><strong>{project.name}</strong><span className="bp-pop-req">{project.kind === "project" ? "工程" : "改良"}</span></div>
        <p className="bp-desc mono-num">{project.effectSummary}</p>
        <div className="bp-footer"><SettlementCosts costs={project.costs} />
          <button type="button" className="btn-primary" disabled={busy || !project.canUnlock}
            onClick={() => void runAction(() => api.unlockBlueprint({ code: project.code }))}>
            {project.code === "mystery_treasure" ? "装配" : project.kind === "project" ? "制造" : "改良"}
          </button>
        </div>
        {project.blockedReason && <p className="muted-note mono-num">{project.blockedReason}</p>}
      </article>)}
      {(technologies.some((t) => t.researched) || projects.some((p) => p.unlocked)) && <details className="settlement-item">
        <summary>已掌握与已完成</summary>
        {technologies.filter((t) => t.researched).map((t) => <div key={t.code} className="bp-card bp-unlocked"><strong>{t.name}</strong><p className="bp-desc">{t.effectSummary}</p></div>)}
        {projects.filter((p) => p.unlocked).map((p) => <div key={p.code} className="bp-card bp-unlocked"><strong>{p.name}</strong><p className="bp-desc mono-num">{p.effectSummary}</p></div>)}
      </details>}
    </div>}
    {activeTab === "caravan" && <div className="blueprint-list">
      <p className="muted-note">只提供已认识物资的易物。扩建住房后才能安置游商带来的居民。</p>
      {state.caravanOffers.map((offer) => <article className="bp-card" key={offer.offerCode}>
        <strong>{offer.title}</strong><p className="bp-desc mono-num">{offer.rewardSummary}</p>
        <div className="bp-footer"><SettlementCosts costs={offer.costs} /><button type="button" className="btn-primary" disabled={busy || !offer.canTrade}
          onClick={() => void runAction(() => api.tradeCaravan({ offerCode: offer.offerCode }))}>兑换</button></div>
      </article>)}
      {!state.caravanOffers.length && <p className="muted-note">持续生产，认识更多物资后会出现相应契约。</p>}
    </div>}
  </section>;
}
