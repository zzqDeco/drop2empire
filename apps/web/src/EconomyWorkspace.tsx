import { useState } from "react";
import {
  api,
  type CompanyDTO,
  type CompanyPlanDTO,
  type CostItemDTO,
  type DashboardStateResp,
} from "@drop2empire/api-client";
import { formatGold as gold, formatResource } from "./format";
import { economyCommand, fixedInput } from "./economy";
import { MarketSceneView as SpotMarket } from "./MacroEmpireWorkspace";

export interface EconomyViewProps {
  state: DashboardStateResp;
  busy?: boolean;
  runAction: (
    fn: () => Promise<DashboardStateResp>,
    successMsg?: string,
  ) => Promise<void>;
}
const professionNames: Record<string, string> = {
  scientist: "科学家",
  alchemist: "炼金师",
  mage: "魔法师",
  artisan: "工匠",
};
const packOptions = [
  { value: "", name: "普通材料路线" },
  { value: "heavy_workpack", name: "重载作业包" },
  { value: "precision_workpack", name: "精密作业包" },
];
const formatGold = (basis: number) => gold(basis, 4);
const packName = (key: string) =>
  packOptions.find((p) => p.value === key)?.name ?? key;

function Costs({ costs }: { costs: CostItemDTO[] }) {
  return (
    <ul className="economy-costs">
      {costs.map((c) => (
        <li key={c.resourceKey}>
          {c.resourceName}{" "}
          <span className="mono-num">
            {formatResource(c.currentMilli)} / {formatResource(c.requiredMilli)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ProfessionWorkshop({
  state,
  busy,
  runAction,
}: EconomyViewProps) {
  const ps = state.economy.professional;
  const [pack, setPack] = useState("");
  const [targetNode, setTargetNode] = useState(
    state.war.nodes[0]?.nodeId ?? "",
  );
  const [batches, setBatches] = useState("1");
  const facilityCosts = ps.buildCosts.map((c) => ({
    ...c,
    requiredMilli:
      ps.level > 0 && pack ? (c.requiredMilli * 8) / 10 : c.requiredMilli,
  }));
  if (ps.level > 0 && pack)
    facilityCosts.push({
      resourceKey: pack,
      resourceName: packOptions.find((p) => p.value === pack)!.name,
      requiredMilli: 4000,
      currentMilli:
        state.resources.find((r) => r.key === pack)?.amountMilli ?? 0,
      etaSeconds: -1,
      capacityMilli: 0,
    });
  return (
    <div className="economy-stack">
      <section className="subpanel" aria-label="职业设施">
        <h3>
          {professionNames[state.player.profession]} · {ps.facilityName}
        </h3>
        <p>
          专属制造资格已解锁。支付建造材料后启用产线，任何职业都能购买和使用制品。
        </p>
        {ps.level < 2 && (
          <>
            <Costs costs={facilityCosts} />
            {ps.level === 1 && (
              <label>
                升级路线{" "}
                <select value={pack} onChange={(e) => setPack(e.target.value)}>
                  {packOptions.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.name}
                      {p.value ? " ×4，普通材料减少 20%" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              className="btn-primary"
              disabled={
                busy ||
                facilityCosts.some((c) => c.currentMilli < c.requiredMilli)
              }
              onClick={() =>
                void runAction(
                  () =>
                    economyCommand(state, "build_facility", { option: pack }),
                  "职业设施已建成",
                )
              }
            >
              {ps.level ? "升级职业设施" : "建造职业工坊"}
            </button>
          </>
        )}
        {ps.level === 2 && (
          <p>
            二级产线：制造时间减少 <span className="mono-num">20%</span>。
          </p>
        )}
        <p role="status">
          {ps.queueItem ? (
            <>
              正在制造：
              {ps.consumables.find((c) => c.itemKey === ps.queueItem)?.name} ·
              剩余 <span className="mono-num">{ps.remainingSeconds}</span> 秒
            </>
          ) : (
            "产线空闲"
          )}
        </p>
        {ps.productionCharges > 0 && (
          <p>
            已装载
            {ps.consumables.find((c) => c.itemKey === ps.productionMode)?.name}
            ，剩余 <span className="mono-num">{ps.productionCharges}</span> 批。
          </p>
        )}
        <label>
          制造批数{" "}
          <input
            className="mono-num"
            type="number"
            min="1"
            max="20"
            value={batches}
            onChange={(e) => setBatches(e.target.value)}
          />
        </label>
      </section>
      <div className="economy-grid">
        {ps.consumables
          .filter((c) => c.profession === state.player.profession)
          .map((c) => (
            <article className="subpanel" key={c.itemKey}>
              <h3>{c.name}</h3>
              <p>{c.effect}</p>
              <p>基础每批材料：</p>
              <Costs costs={c.costs} />
              <p>
                每批{" "}
                <span className="mono-num">
                  {formatResource(c.outputMilli)}
                </span>{" "}
                件 · 基础耗时 <span className="mono-num">{c.seconds}</span>{" "}
                秒；设施和已装载耗材效果在入列时结算。
              </p>
              <button
                className="btn-primary"
                disabled={busy || ps.level === 0 || Boolean(ps.queueItem)}
                onClick={() =>
                  void runAction(
                    () =>
                      economyCommand(state, "craft", {
                        target: c.itemKey,
                        quantity: fixedInput(batches, 0),
                      }),
                    "制造任务已入列",
                  )
                }
              >
                制造
              </button>
            </article>
          ))}
      </div>
      <section className="subpanel">
        <h3>耗材仓库</h3>
        <label>
          战争支援节点{" "}
          <select
            value={targetNode}
            onChange={(e) => setTargetNode(e.target.value)}
          >
            {state.war.nodes.map((n) => (
              <option key={n.nodeId} value={n.nodeId}>
                {n.name}
              </option>
            ))}
          </select>
        </label>
        {ps.consumables
          .filter((c) => c.inventoryMilli > 0)
          .map((c) => (
            <div className="economy-row" key={c.itemKey}>
              <div>
                <strong>
                  {c.name}{" "}
                  <span className="mono-num">
                    ×{formatResource(c.inventoryMilli)}
                  </span>
                </strong>
                <p>{c.effect}</p>
              </div>
              {c.use === "raid" ? (
                <span>在远征中使用</span>
              ) : (
                <button
                  className="btn-outline"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      () =>
                        economyCommand(state, "use", {
                          target: c.itemKey,
                          option: c.use === "war" ? targetNode : "",
                        }),
                      "耗材效果已启用",
                    )
                  }
                >
                  使用
                </button>
              )}
            </div>
          ))}
        {ps.consumables.every((c) => c.inventoryMilli === 0) && (
          <p>制造或在现货市场购买耗材后，可在这里使用。</p>
        )}
      </section>
    </div>
  );
}

function CompanyCard({
  company: c,
  state,
  busy,
  runAction,
}: EconomyViewProps & { company: CompanyDTO }) {
  const [shares, setShares] = useState("100");
  const [price, setPrice] = useState(
    String((c.bestAskBasis || c.ipoPriceBasis) / 10000),
  );
  const [side, setSide] = useState("BID");
  return (
    <article className="subpanel">
      <h3>{c.name}</h3>
      <p>
        {c.asset} · 专有产物：{c.outputName}
      </p>
      {c.status === "subscription" ? (
        <>
          <p>
            IPO 单价{" "}
            <span className="mono-num">{formatGold(c.ipoPriceBasis)}</span>
            ，发行 <span className="mono-num">{c.totalShares}</span> 股；达{" "}
            <span className="mono-num">{c.ipoMinimumShares}</span> 股才成立。
          </p>
          <p>
            认购截止：
            <time className="mono-num">
              {new Date(c.ipoEndsAt).toLocaleString()}
            </time>
          </p>
          <p>
            已认购 <span className="mono-num">{c.subscribedShares}</span>{" "}
            股；我的申请 <span className="mono-num">{c.mySubscription}</span>{" "}
            股。超额按比例配售，失败全额退款。
          </p>
          <label>
            认购股数{" "}
            <input
              className="mono-num"
              type="number"
              min="1"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
            />
          </label>
          <button
            className="btn-primary"
            disabled={busy || state.player.profession === "none"}
            onClick={() =>
              void runAction(
                () =>
                  economyCommand(state, "subscribe", {
                    target: c.id,
                    quantity: fixedInput(shares, 0),
                  }),
                "认购款已进入托管",
              )
            }
          >
            提交认购
          </button>
        </>
      ) : c.status === "listed" ? (
        <>
          <p className="mono-num">
            现金 {formatGold(c.cashBasis)} · 已实现利润{" "}
            {formatGold(c.profitBasis)} · 累计分红{" "}
            {formatGold(c.dividendsBasis)}
          </p>
          <p>
            生产：{c.statusReason} ·{" "}
            <span className="mono-num">
              {c.runningLines}/{c.lines}
            </span>{" "}
            条产线
          </p>
          {c.expansionPack && (
            <p>
              扩建采购中，预算{" "}
              <span className="mono-num">
                {formatGold(c.expansionBudgetBasis)}
              </span>
              。
            </p>
          )}
          <p>
            持股 <span className="mono-num">{c.myShares}</span> · 卖单托管{" "}
            <span className="mono-num">{c.myFrozenShares}</span>
          </p>
          <details>
            <summary>股权买卖</summary>
            <p>
              最高买价{" "}
              <span className="mono-num">
                {c.bestBidBasis ? formatGold(c.bestBidBasis) : "—"}
              </span>{" "}
              · 最低卖价{" "}
              <span className="mono-num">
                {c.bestAskBasis ? formatGold(c.bestAskBasis) : "—"}
              </span>
            </p>
            <label>
              方向{" "}
              <select value={side} onChange={(e) => setSide(e.target.value)}>
                <option value="BID">买入股份</option>
                <option value="ASK">卖出股份</option>
              </select>
            </label>
            <label>
              每股金币{" "}
              <input
                className="mono-num"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <label>
              股数{" "}
              <input
                className="mono-num"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
              />
            </label>
            <button
              className="btn-outline"
              disabled={busy}
              onClick={() =>
                void runAction(
                  () =>
                    api.placeMarketOrder({
                      itemKey: `share:${c.id}`,
                      side,
                      priceBasis: fixedInput(price, 4),
                      quantityMilli: fixedInput(shares, 3),
                    }),
                  "股权订单已提交",
                )
              }
            >
              提交限价单
            </button>
            {state.openOrders
              .filter((o) => o.itemKey === `share:${c.id}` && o.isOwn)
              .map((o) => (
                <div className="economy-row" key={o.id}>
                  <span className="mono-num">
                    {o.side} {formatResource(o.remainingMilli)} 股 @{" "}
                    {formatGold(o.priceBasis)}
                  </span>
                  <button
                    className="btn-outline"
                    disabled={busy}
                    onClick={() =>
                      void runAction(() => api.cancelMarketOrder(o.id))
                    }
                  >
                    撤单
                  </button>
                </div>
              ))}
          </details>
          <CompanyGovernance
            key={`${c.id}:${c.vote.id}:${c.vote.result}`}
            company={c}
            state={state}
            busy={busy}
            runAction={runAction}
          />
        </>
      ) : (
        <p>{c.statusReason}</p>
      )}
      <details>
        <summary>产线、投入与库存</summary>
        {c.routes.map((r) => (
          <div key={r.code}>
            <h4>{r.code === "standard" ? "标准路线" : "替代路线"}</h4>
            <p>
              <span className="mono-num">{r.seconds / 60}</span> 分钟 →{" "}
              <span className="mono-num">{formatResource(c.outputMilli)}</span>{" "}
              {c.outputName}
            </p>
            <Costs costs={r.inputs} />
          </div>
        ))}
        <ul>
          {c.inventory.map((i) => (
            <li key={i.itemKey}>
              {i.name}{" "}
              <span className="mono-num">
                {formatResource(i.quantityMilli)}
              </span>
              ，挂卖{" "}
              <span className="mono-num">{formatResource(i.frozenMilli)}</span>
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function CompanyGovernance({
  company: c,
  state,
  busy,
  runAction,
}: EconomyViewProps & { company: CompanyDTO }) {
  const [plan, setPlan] = useState<CompanyPlanDTO>(c.plan);
  const [ask, setAsk] = useState(String(c.plan.askPriceBasis / 10000));
  const [budget, setBudget] = useState(String(c.plan.inputBudgetBasis / 10000));
  const [capital, setCapital] = useState("0");
  const [dividend, setDividend] = useState("0");
  const active = c.vote.id > 0 && !c.vote.result;
  return (
    <details>
      <summary>股东决策</summary>
      {active ? (
        <>
          <p>
            本期快照票权 <span className="mono-num">{c.vote.myWeight}</span>
            ；赞成 <span className="mono-num">{c.vote.yesShares}</span>，反对{" "}
            <span className="mono-num">{c.vote.noShares}</span>。
          </p>
          <p>
            截止{" "}
            <time className="mono-num">
              {new Date(c.vote.endsAt).toLocaleString()}
            </time>
            。我的投票：
            {c.vote.myBallot === "yes"
              ? "赞成"
              : c.vote.myBallot === "no"
                ? "反对"
                : "未投票"}
          </p>
          <p>
            方案：{c.vote.plan.route === "standard" ? "标准" : "替代"}路线，
            <span className="mono-num">{c.vote.plan.activeLines}</span>{" "}
            条产线，售价{" "}
            <span className="mono-num">
              {formatGold(c.vote.plan.askPriceBasis)}
            </span>
            ，批次预算{" "}
            <span className="mono-num">
              {formatGold(c.vote.plan.inputBudgetBasis)}
            </span>
            ，扩建预算{" "}
            <span className="mono-num">
              {formatGold(c.vote.plan.capitalBudgetBasis)}
            </span>
            ，分红{" "}
            <span className="mono-num">
              {formatGold(c.vote.plan.dividendBasis)}
            </span>
            。
          </p>
          <p>
            生产耗材：{c.vote.plan.pack ? packName(c.vote.plan.pack) : "不使用"}
            。扩建决策：
            {c.vote.plan.expandWith === "cancel"
              ? "取消待建项目"
              : c.vote.plan.expandWith
                ? `采用${packName(c.vote.plan.expandWith)}新建或调整待建项目`
                : "维持现有扩建安排"}
            。
          </p>
          {[true, false].map((approve) => (
            <button
              key={String(approve)}
              className="btn-outline"
              disabled={busy || c.vote.myWeight === 0}
              onClick={() =>
                void runAction(
                  () =>
                    economyCommand(state, "vote", {
                      target: c.id,
                      voteId: c.vote.id,
                      approve,
                    }),
                  "投票已记录",
                )
              }
            >
              {approve ? "赞成" : "反对"}
            </button>
          ))}
        </>
      ) : (
        <>
          {c.vote.result && <p>上期结果：{c.vote.result}</p>}
          <p>
            下一提案窗口：
            <time className="mono-num">
              {new Date(c.nextVoteAt).toLocaleString()}
            </time>
            。持股至少 <span className="mono-num">1%</span> 可提案，投票持续{" "}
            <span className="mono-num">24</span> 小时。
          </p>
          <label>
            路线{" "}
            <select
              value={plan.route}
              onChange={(e) => setPlan({ ...plan, route: e.target.value })}
            >
              {c.routes.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.code === "standard" ? "标准" : "替代"}
                </option>
              ))}
            </select>
          </label>
          <label>
            开工产线数{" "}
            <input
              className="mono-num"
              type="number"
              min="0"
              max={c.lines}
              value={plan.activeLines}
              onChange={(e) =>
                setPlan({ ...plan, activeLines: Number(e.target.value) })
              }
            />
          </label>
          <label>
            产品挂售价{" "}
            <input
              className="mono-num"
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
            />
          </label>
          <label>
            每批投入预算{" "}
            <input
              className="mono-num"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </label>
          <label>
            生产耗材{" "}
            <select
              value={plan.pack}
              onChange={(e) => setPlan({ ...plan, pack: e.target.value })}
            >
              {packOptions.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.value ? p.name : "不使用耗材"}
                </option>
              ))}
            </select>
          </label>
          <label>
            扩建决策{" "}
            <select
              value={plan.expandWith}
              onChange={(e) => setPlan({ ...plan, expandWith: e.target.value })}
            >
              {packOptions.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.value
                    ? p.name + "（新建或调整待建预算）"
                    : "维持现有扩建安排"}
                </option>
              ))}
              {c.expansionPack && (
                <option value="cancel">取消待建项目（预算设为零）</option>
              )}
            </select>
          </label>
          {plan.expandWith && plan.expandWith !== "cancel" && (
            <p>
              扩建需要石材 <span className="mono-num">400</span>、木材{" "}
              <span className="mono-num">300</span>、铁锭{" "}
              <span className="mono-num">100</span>、木炭{" "}
              <span className="mono-num">60</span>、所选作业包{" "}
              <span className="mono-num">40</span>，通过后按市场价格采购。
            </p>
          )}
          <label>
            扩建采购预算{" "}
            <input
              className="mono-num"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
            />
          </label>
          <label>
            本期分红总额{" "}
            <input
              className="mono-num"
              value={dividend}
              onChange={(e) => setDividend(e.target.value)}
            />
          </label>
          <button
            className="btn-primary"
            disabled={
              busy ||
              (c.myShares + c.myFrozenShares) * 100 < c.totalShares ||
              Date.parse(state.serverTime) < Date.parse(c.nextVoteAt)
            }
            onClick={() =>
              void runAction(
                () =>
                  economyCommand(state, "propose", {
                    target: c.id,
                    plan: {
                      ...plan,
                      askPriceBasis: fixedInput(ask, 4),
                      inputBudgetBasis: fixedInput(budget, 4),
                      capitalBudgetBasis: fixedInput(capital, 4),
                      dividendBasis: fixedInput(dividend, 4),
                    },
                  }),
                "提案已开启，股权快照已锁定",
              )
            }
          >
            提交经营提案
          </button>
        </>
      )}
    </details>
  );
}

export function CompanyPortfolio(props: EconomyViewProps) {
  return (
    <div className="economy-stack">
      <p>
        公司与金融资产跨内容赛季保留。此处可查看认购、买卖股份和参与股东投票。
      </p>
      <div className="economy-grid">
        {props.state.economy.companies.map((c) => (
          <CompanyCard key={c.id} {...props} company={c} />
        ))}
      </div>
    </div>
  );
}

export function EconomyWorkspace(props: EconomyViewProps) {
  const [tab, setTab] = useState("profession");
  const companies = props.state.economy.companies;
  return (
    <div className="economy-stack">
      <nav className="economy-tabs" aria-label="产业与交易">
        {[
          { id: "profession", label: "职业工坊" },
          { id: "spot", label: "现货市场" },
          ...(companies.length
            ? [{ id: "companies", label: "公司与股权" }]
            : []),
        ].map((t) => (
          <button
            className={tab === t.id ? "btn-primary" : "btn-outline"}
            key={t.id}
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "profession" && <ProfessionWorkshop {...props} />}
      {tab === "spot" && <SpotMarket {...props} />}
      {tab === "companies" && (
        <>
          <section className="subpanel">
            <h3>产业供应链</h3>
            <p>
              澜川合金 → 赤炉机造 → 岩筑工务；星砂晶材 → 星衡控制 → 云衡精工。
            </p>
            <p>
              中游和下游各有替代投入路线，采购与销售都经过现货订单簿。查看各公司的产线可比较成本与工期。
            </p>
          </section>
          <div className="economy-grid">
            {companies.map((c) => (
              <CompanyCard key={c.id} {...props} company={c} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
