import { useMemo, useState } from "react";
import { api, type DashboardStateResp } from "@drop2empire/api-client";
import type { EconomyViewProps } from "./EconomyWorkspace";
import { ConfirmActionModal } from "./components/ModalShell";
import { fixedInput } from "./economy";
import { formatGold as gold, formatResource } from "./format";
import {
  buildGenesisProcurementPlan,
  DEFAULT_GENESIS_POLICY_PREFIX,
  GENESIS_TOTAL_GOLD_BASIS,
} from "./genesisProcurement";

const formatGold = (basis: number) => gold(basis, 4);

const policies = [
  ["issue", "发行至联盟准备金"],
  ["fund_public", "拨款至公共采购"],
  ["fund_treasury", "拨款至财政预算"],
  ["recall_public", "回收公共采购余额"],
  ["recall_treasury", "回收财政余额"],
  ["cancel", "注销联盟准备金"],
  ["procure", "发布有预算的采购买单"],
  ["withdraw_order", "撤销公共采购订单"],
  ["consume_public", "核销已采购实物"],
];

export function EconomyAdmin({ state, busy, runAction }: EconomyViewProps) {
  const [policyId, setPolicyId] = useState<string>(() => crypto.randomUUID());
  const [action, setAction] = useState("issue");
  const [amount, setAmount] = useState("0");
  const [item, setItem] = useState("water");
  const [quantity, setQuantity] = useState("100");
  const [price, setPrice] = useState("0.1");
  const [company, setCompany] = useState(
    state.economy.companyCatalog[0]?.id ?? "",
  );
  const [shares, setShares] = useState("100000");
  const [ipoPrice, setIPOPrice] = useState("0.05");
  const [minimum, setMinimum] = useState("90000");
  const [hours, setHours] = useState("48");
  const [genesisPrefix, setGenesisPrefix] = useState(
    DEFAULT_GENESIS_POLICY_PREFIX,
  );
  const [confirmGenesisOpen, setConfirmGenesisOpen] = useState(false);
  const e = state.economy;
  const selectedCompany = e.companyCatalog.some((c) => c.id === company)
    ? company
    : (e.companyCatalog[0]?.id ?? "");

  const genesisPlan = useMemo(
    () => buildGenesisProcurementPlan(genesisPrefix),
    [genesisPrefix],
  );
  const appliedPolicyIds = useMemo(
    () => new Set(e.policies.map((p) => p.id)),
    [e.policies],
  );
  const pendingGenesisSteps = useMemo(
    () => genesisPlan.filter((step) => !appliedPolicyIds.has(step.policyId)),
    [genesisPlan, appliedPolicyIds],
  );
  return (
    <section className="subpanel" aria-label="货币联盟与公司引入">
      <h3>货币联盟</h3>
      <p className="mono-num">
        净发行 {formatGold(e.issuedBasis - e.cancelledBasis)} · 实际持有{" "}
        {formatGold(e.holdingsBasis)} · 准备金 {formatGold(e.reserveBasis)}
      </p>
      <p className="mono-num">
        公共采购 {formatGold(e.publicCashBasis)} · 公司账户{" "}
        {formatGold(e.corporateCashBasis)} · IPO 托管{" "}
        {formatGold(e.ipoEscrowBasis)}
      </p>

      <details open={e.issuedBasis === 0}>
        <summary>
          首批受控公共采购启动方案（8,000 G 创世章程 · 已完成{" "}
          <span className="mono-num">
            {genesisPlan.length - pendingGenesisSteps.length}/
            {genesisPlan.length}
          </span>
          ）
        </summary>
        <div className="economy-form">
          <label>
            批次政策前缀（幂等防重）
            <input
              className="mono-num"
              value={genesisPrefix}
              onChange={(ev) => setGenesisPrefix(ev.target.value)}
            />
          </label>
          <p>
            按《清档与启动操作手册》一次性发行{" "}
            <strong className="mono-num">
              {formatGold(GENESIS_TOTAL_GOLD_BASIS)} G
            </strong>{" "}
            至联盟准备金，划拨至公共采购账户{" "}
            <code>@public</code>{" "}
            并对 6 种基础物资挂出有限预算限价买单（总承诺{" "}
            <span className="mono-num">8,000.0000 G</span>
            ，不自动补发、不托底公司或股价）。每步使用固定政策编号，中途中断可安全续跑。
          </p>
          <div className="table-wrap">
            <table className="ink-table">
              <thead>
                <tr>
                  <th>步骤</th>
                  <th>政策编号</th>
                  <th>执行内容</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {genesisPlan.map((step) => {
                  const done = appliedPolicyIds.has(step.policyId);
                  return (
                    <tr key={step.policyId}>
                      <td>{step.label}</td>
                      <td className="mono-num">{step.policyId}</td>
                      <td className="mono-num">{step.summary}</td>
                      <td>
                        <span
                          className={`tag-badge ${done ? "tag-success" : "tag-warning"}`}
                        >
                          {done ? "已入账" : "待执行"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || pendingGenesisSteps.length === 0}
            onClick={() => setConfirmGenesisOpen(true)}
          >
            {pendingGenesisSteps.length === 0
              ? "本批次 8 步创世政策已全部入账"
              : `按章程执行待落账步骤 (${pendingGenesisSteps.length}/${genesisPlan.length})`}
          </button>
        </div>
      </details>

      <form
        className="economy-form"
        onSubmit={(event) => {
          event.preventDefault();
          void runAction(
            () =>
              api.monetaryPolicy({
                policyId,
                action,
                amountBasis: fixedInput(amount, 4),
                itemKey: item,
                quantityMilli: fixedInput(quantity, 3),
                priceBasis: fixedInput(price, 4),
              }),
            "政策已提交，可在审计记录中核对",
          );
        }}
      >
        <label>
          政策编号{" "}
          <input
            value={policyId}
            onChange={(ev) => setPolicyId(ev.target.value)}
            required
          />
        </label>
        <button
          className="btn-outline"
          type="button"
          onClick={() => setPolicyId(crypto.randomUUID())}
        >
          生成新政策编号
        </button>
        <label>
          操作{" "}
          <select value={action} onChange={(ev) => setAction(ev.target.value)}>
            {policies.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          金额（金币）
          <input
            className="mono-num"
            value={amount}
            onChange={(ev) => setAmount(ev.target.value)}
          />
        </label>
        <label>
          {action === "withdraw_order" ? "订单编号" : "商品代码"}
          <input value={item} onChange={(ev) => setItem(ev.target.value)} />
        </label>
        <label>
          实物数量{" "}
          <input
            className="mono-num"
            value={quantity}
            onChange={(ev) => setQuantity(ev.target.value)}
          />
        </label>
        <label>
          采购单价（金币）
          <input
            className="mono-num"
            value={price}
            onChange={(ev) => setPrice(ev.target.value)}
          />
        </label>
        <p>
          发行只进入联盟准备金；先拨款，再采购。重复提交相同编号和内容不会重复执行，已发布政策不能覆盖。
        </p>
        <button className="btn-primary" disabled={busy}>
          执行政策
        </button>
      </form>
      <details>
        <summary>最近政策审计</summary>
        <ul>
          {e.policies.map((p) => (
            <li key={p.id}>
              <time className="mono-num">
                {new Date(p.at).toLocaleString()}
              </time>{" "}
              · {policies.find(([id]) => id === p.action)?.[1] ?? p.action}
              {p.action === "procure" || p.action === "consume_public" ? (
                <span className="mono-num">
                  {" "}
                  · {p.itemKey} × {formatResource(p.quantityMilli)}
                  {p.action === "procure"
                    ? ` @ ${formatGold(p.priceBasis)}`
                    : ""}
                </span>
              ) : p.action === "withdraw_order" ? (
                ` · ${p.itemKey}`
              ) : (
                <span className="mono-num"> · {formatGold(p.amountBasis)}</span>
              )}
              <br />
              {p.id}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>公共采购库存与挂单</summary>
        <ul>
          {e.publicInventory.map((i) => (
            <li key={i.itemKey}>
              {i.name}{" "}
              <span className="mono-num">
                {formatResource(i.quantityMilli)}
              </span>
            </li>
          ))}
        </ul>
        {state.openOrders
          .filter((o) => o.makerName === "@public")
          .map((o) => (
            <p key={o.id}>
              {o.id} · {o.itemName} ·{" "}
              <span className="mono-num">
                {formatResource(o.remainingMilli)} @ {formatGold(o.priceBasis)}
              </span>{" "}
              <button
                type="button"
                className="btn-link"
                onClick={() => {
                  setAction("withdraw_order");
                  setItem(o.id);
                  setPolicyId(crypto.randomUUID());
                }}
              >
                填入撤单
              </button>
            </p>
          ))}
      </details>
      <h3>引入稀缺公司</h3>
      <form
        className="economy-form"
        onSubmit={(event) => {
          event.preventDefault();
          void runAction(
            () =>
              api.introduceCompany({
                companyId: selectedCompany,
                shares: fixedInput(shares, 0),
                priceBasis: fixedInput(ipoPrice, 4),
                minimumShares: fixedInput(minimum, 0),
                durationHours: fixedInput(hours, 0),
              }),
            "IPO 已公告，等待玩家认购",
          );
        }}
      >
        <label>
          许可公司{" "}
          <select
            value={selectedCompany}
            onChange={(ev) => setCompany(ev.target.value)}
          >
            {e.companyCatalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.asset}
              </option>
            ))}
          </select>
        </label>
        <label>
          发行股数{" "}
          <input
            className="mono-num"
            value={shares}
            onChange={(ev) => setShares(ev.target.value)}
          />
        </label>
        <label>
          每股认购价{" "}
          <input
            className="mono-num"
            value={ipoPrice}
            onChange={(ev) => setIPOPrice(ev.target.value)}
          />
        </label>
        <label>
          最低认购股数{" "}
          <input
            className="mono-num"
            value={minimum}
            onChange={(ev) => setMinimum(ev.target.value)}
          />
        </label>
        <label>
          认购窗口（小时）
          <input
            className="mono-num"
            value={hours}
            onChange={(ev) => setHours(ev.target.value)}
          />
        </label>
        <p>
          按上游、中游、下游分批引入；先核对流通现金能覆盖募资和后续交易。认购失败会退款，系统不会补足资本金。
        </p>
        <button className="btn-primary" disabled={busy || !selectedCompany}>
          公告 IPO
        </button>
      </form>

      {confirmGenesisOpen && (
        <ConfirmActionModal
          title="确认按创世章程执行首批受控公共采购"
          subtitle={`本次将按固定政策前缀「${genesisPrefix.trim() || DEFAULT_GENESIS_POLICY_PREFIX}」依次提交 ${pendingGenesisSteps.length} 条幂等货币政策`}
          severity="warning"
          consequences={[
            `若尚未发行，将向联盟准备金发行 ${formatGold(GENESIS_TOTAL_GOLD_BASIS)} G 并全额划拨至公共采购账户 @public。`,
            "对水、原木、石材、木炭、铁锭、燧石 6 类基础物资挂出有限预算限价买单（总承诺 8,000.0000 G），仅与真实玩家卖单撮合，卖方扣 1% 交易税入国库。",
            "此额度为有限启动预算，绝不自动补发，也不为公司或股票托底；全部政策均写入 d2e_economy_audit 审计账本且同编号重放幂等。",
          ]}
          confirmLabel={`确认执行 ${pendingGenesisSteps.length} 条政策`}
          busy={busy}
          onCancel={() => setConfirmGenesisOpen(false)}
          onConfirm={() => {
            const stepsToRun = [...pendingGenesisSteps];
            setConfirmGenesisOpen(false);
            if (stepsToRun.length === 0) return;
            void runAction(async () => {
              let latest: DashboardStateResp = state;
              for (const step of stepsToRun) {
                latest = await api.monetaryPolicy(step.req);
              }
              return latest;
            }, `已按创世章程完成 ${stepsToRun.length} 条受控公共采购政策，可在审计记录与盘口核对`);
          }}
        />
      )}
    </section>
  );
}
