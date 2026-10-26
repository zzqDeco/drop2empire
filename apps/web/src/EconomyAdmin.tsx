import { useState } from "react";
import { api } from "@drop2empire/api-client";
import type { EconomyViewProps } from "./EconomyWorkspace";
import { fixedInput } from "./economy";
import { formatGold as gold, formatResource } from "./format";

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
  const e = state.economy;
  const selectedCompany = e.companyCatalog.some((c) => c.id === company)
    ? company
    : (e.companyCatalog[0]?.id ?? "");
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
              </span>
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
    </section>
  );
}
