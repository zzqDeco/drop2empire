import { useState } from "react";
import { api } from "@drop2empire/api-client";
import { Cpu, FlaskConical, Layers, TrendingUp } from "lucide-react";
import { ICON } from "../../icons";
import { fixedInput } from "../../economy";
import { formatGold, formatResource } from "../../format";
import type { SceneProps } from "./types";

/**
 * Scene III: Workshop Crafting, Cross-Profession Equipment Rack & Global CLOB Spot Market
 */
export function MarketSceneView({ state, runAction, busy }: SceneProps) {
  const [selectedMarketItem, setSelectedMarketItem] = useState("water");
  const [orderSide, setOrderSide] = useState<"BID" | "ASK">(
    state.player.goldBasis > 0 ? "BID" : "ASK",
  );
  const [orderPriceGold, setOrderPriceGold] = useState("0.1");
  const [orderQtyUnits, setOrderQtyUnits] = useState("1");

  const selectedMarketMeta =
    state.marketSummaries.find((m) => m.itemKey === selectedMarketItem) ??
    state.marketSummaries[0];

  let ticket:
    | { priceBasis: number; quantityMilli: number; totalBasis: number }
    | undefined;
  let ticketError = "";
  try {
    const priceBasis = fixedInput(orderPriceGold, 4);
    const units = fixedInput(orderQtyUnits, 0);
    const total = BigInt(priceBasis) * BigInt(units);
    if (
      priceBasis < 100 ||
      priceBasis > 100_000_000 ||
      units < 1 ||
      units > 1_000_000_000
    ) {
      throw new Error(
        "单价范围 0.01–10,000 Gold，数量须为 1–1,000,000,000 的整数",
      );
    }
    if (total > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error("订单总额超出界面精确范围，请拆单");
    ticket = {
      priceBasis,
      quantityMilli: units * 1000,
      totalBasis: Number(total),
    };
    if (orderSide === "BID" && ticket.totalBasis > state.player.goldBasis)
      ticketError = "可用金币不足";
    if (
      orderSide === "ASK" &&
      ticket.quantityMilli >
        (state.resources.find((r) => r.key === selectedMarketItem)
          ?.amountMilli ?? 0)
    )
      ticketError = "可用库存不足";
  } catch (error) {
    ticketError = error instanceof Error ? error.message : "订单输入无效";
  }

  return (
    <div className="lower-workspace" aria-label="工坊制造与全球现货市场">
      {/* Upper Section: Workshop Equipment Rack & Profession Recipes */}
      <div className="tab-body split-2col">
        <div className="subpanel">
          <div className="subpanel-head">
            <h3>
              <Layers size={ICON.sm} />
              <span>职业耗材与产业贸易</span>
            </h3>
          </div>
          <div className="equip-slot-list">
            {state.installedEquipments.map((eq) => (
              <div key={eq.itemKey} className="equip-card">
                <div className="equip-main">
                  <div className="equip-title-row">
                    <strong>{eq.name}</strong>
                    <span className="tag-badge mono-num">
                      {eq.installedCount}/{eq.maxStack} · 库存{" "}
                      {eq.inventoryUnits}
                    </span>
                  </div>
                  <p>{eq.bonusSummary}</p>
                </div>
                <div className="equip-actions">
                  <button
                    type="button"
                    className="btn-outline mono-num"
                    data-pop={`-1 ${eq.name}`}
                    disabled={eq.installedCount <= 0}
                    onClick={() =>
                      void runAction(() =>
                        api.installEquipment({
                          itemKey: eq.itemKey,
                          delta: -1,
                        }),
                      )
                    }
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    className="btn-primary mono-num"
                    data-pop={`+1 ${eq.name}`}
                    disabled={
                      eq.inventoryUnits <= 0 || eq.installedCount >= eq.maxStack
                    }
                    onClick={() =>
                      void runAction(() =>
                        api.installEquipment({
                          itemKey: eq.itemKey,
                          delta: 1,
                        }),
                      )
                    }
                  >
                    +1
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="subpanel">
          <div className="subpanel-head">
            <h3>
              <FlaskConical size={ICON.sm} />
              <span>职业专属工坊配方（{state.player.professionName}）</span>
            </h3>
          </div>
          <div className="recipe-grid">
            {state.recipes.map((rc) => (
              <article
                key={rc.recipeCode}
                className={`recipe-card ${!rc.professionMatched ? "recipe-other-prof" : ""}`}
              >
                <div className="recipe-head">
                  <div>
                    <strong>{rc.name}</strong>
                    <span
                      className={`tag-badge ${rc.professionMatched ? "tag-success" : ""}`}
                    >
                      {rc.professionReqName}
                    </span>
                  </div>
                  <span className="mono-num">
                    +{formatResource(rc.outputAmountMilli, 0)}
                  </span>
                </div>
                <p className="recipe-desc">{rc.effectSummary}</p>
                <div className="recipe-footer">
                  <div className="bp-costs">
                    {rc.costs.map((c) => (
                      <span
                        key={c.resourceKey}
                        className={`cost-chip mono-num ${c.currentMilli >= c.requiredMilli ? "cost-ok" : "cost-lack"}`}
                      >
                        {c.resourceName} {formatResource(c.currentMilli, 0)}/
                        {formatResource(c.requiredMilli, 0)}
                      </span>
                    ))}
                    {rc.goldCostBasis > 0 && (
                      <span
                        className={`cost-chip mono-num ${state.player.goldBasis >= rc.goldCostBasis ? "cost-ok" : "cost-lack"}`}
                      >
                        {formatGold(rc.goldCostBasis)} G
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    data-pop={`+${formatResource(rc.outputAmountMilli, 0)} ${rc.outputName}`}
                    disabled={!rc.canCraft}
                    onClick={() =>
                      void runAction(() =>
                        api.craftItem({
                          recipeCode: rc.recipeCode,
                          batches: 1,
                        }),
                      )
                    }
                  >
                    {rc.professionMatched ? (
                      <>
                        <Cpu size={ICON.xs} />
                        <span>制造</span>
                      </>
                    ) : (
                      <span className="lock-pill">仅限对应职业</span>
                    )}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      {/* Lower Section: Global CLOB Spot Market */}
      <div className="tab-body split-3col">
        <div className="subpanel">
          <div className="subpanel-head">
            <h3>
              <TrendingUp size={ICON.sm} />
              <span>全球现货行情（含荒原蓝图与外观）</span>
            </h3>
          </div>
          <div className="table-wrap">
            <table className="ink-table clickable-rows">
              <thead>
                <tr>
                  <th>商品</th>
                  <th className="num-col">现价</th>
                  <th className="num-col">买 / 卖</th>
                  <th className="num-col">量</th>
                </tr>
              </thead>
              <tbody>
                {state.marketSummaries.map((m) => (
                  <tr
                    key={m.itemKey}
                    className={
                      m.itemKey === selectedMarketItem ? "row-selected" : ""
                    }
                    onClick={() => {
                      setSelectedMarketItem(m.itemKey);
                      const refPrice =
                        orderSide === "BID" && m.bestAskBasis > 0
                          ? m.bestAskBasis
                          : orderSide === "ASK" && m.bestBidBasis > 0
                            ? m.bestBidBasis
                            : m.lastPriceBasis;
                      if (refPrice > 0)
                        setOrderPriceGold((refPrice / 10000).toFixed(4));
                    }}
                  >
                    <td>
                      <strong>{m.itemName}</strong>
                    </td>
                    <td className="num-col mono-num">
                      {m.lastPriceBasis
                        ? formatGold(m.lastPriceBasis, 4)
                        : "暂无成交"}
                    </td>
                    <td className="num-col mono-num">
                      {m.bestBidBasis > 0 ? formatGold(m.bestBidBasis, 4) : "—"}{" "}
                      /{" "}
                      {m.bestAskBasis > 0 ? formatGold(m.bestAskBasis, 4) : "—"}
                    </td>
                    <td className="num-col mono-num">
                      {formatResource(m.volume24hMilli, 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="subpanel">
          <div className="subpanel-head">
            <h3>委托挂单 · {selectedMarketMeta.itemName}</h3>
          </div>

          <form
            className="order-ticket"
            onSubmit={(e) => {
              e.preventDefault();
              if (!ticket || ticketError || busy) return;
              const { priceBasis, quantityMilli } = ticket;
              void runAction(() =>
                api.placeMarketOrder({
                  itemKey: selectedMarketItem,
                  side: orderSide,
                  priceBasis,
                  quantityMilli,
                }),
              );
            }}
          >
            <div className="side-switch">
              <button
                type="button"
                className={`side-btn ${orderSide === "BID" ? "active-bid" : ""}`}
                onClick={() => setOrderSide("BID")}
              >
                买入 (BID)
              </button>
              <button
                type="button"
                className={`side-btn ${orderSide === "ASK" ? "active-ask" : ""}`}
                onClick={() => setOrderSide("ASK")}
              >
                卖出 (ASK)
              </button>
            </div>

            <div className="form-row-2">
              <label>
                <span>单价 (Gold)</span>
                <input
                  type="number"
                  step="0.0001"
                  min="0.01"
                  className="mono-num"
                  value={orderPriceGold}
                  onChange={(e) => setOrderPriceGold(e.target.value)}
                />
              </label>
              <label>
                <span>数量</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  className="mono-num"
                  value={orderQtyUnits}
                  onChange={(e) => setOrderQtyUnits(e.target.value)}
                />
              </label>
            </div>

            <div className="order-summary mono-num">
              <span>
                总额 {ticket ? formatGold(ticket.totalBasis, 4) : "—"} G
              </span>
              <span>卖方每笔成交扣税 1% · 进入财政账户</span>
              {ticketError && <span role="status">{ticketError}</span>}
            </div>

            <button
              type="submit"
              className="btn-primary btn-block"
              disabled={busy || !ticket || Boolean(ticketError)}
              data-pop={
                orderSide === "BID"
                  ? `挂买 ${orderQtyUnits}×${selectedMarketMeta.itemName}`
                  : `挂卖 ${orderQtyUnits}×${selectedMarketMeta.itemName}`
              }
            >
              {orderSide === "BID" ? "提交买单" : "提交卖单"}
            </button>
          </form>

          <div className="orderbook-box">
            <h4>当前盘口深度</h4>
            <div className="table-wrap">
              <table className="ink-table">
                <thead>
                  <tr>
                    <th>方向</th>
                    <th className="num-col">价格</th>
                    <th className="num-col">数量</th>
                    <th>挂单方</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {state.openOrders
                    .filter((o) => o.itemKey === selectedMarketItem)
                    .map((o) => (
                      <tr key={o.id}>
                        <td>
                          <span
                            className={`side-pill ${o.side === "BID" ? "pill-bid" : "pill-ask"}`}
                          >
                            {o.side}
                          </span>
                        </td>
                        <td className="num-col mono-num">
                          {formatGold(o.priceBasis, 4)}
                        </td>
                        <td className="num-col mono-num">
                          {formatResource(o.remainingMilli, 0)}
                        </td>
                        <td>{o.makerName}</td>
                        <td>
                          {o.isOwn ? (
                            <button
                              type="button"
                              className="btn-link"
                              data-pop="✓ 撤单解冻"
                              onClick={() =>
                                void runAction(() =>
                                  api.cancelMarketOrder(o.id),
                                )
                              }
                            >
                              撤单
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-link"
                              data-pop="填入价格"
                              onClick={() => {
                                setOrderSide(o.side === "ASK" ? "BID" : "ASK");
                                setOrderPriceGold(
                                  (o.priceBasis / 10000).toFixed(4),
                                );
                                setOrderQtyUnits(
                                  String(
                                    Math.max(
                                      1,
                                      Math.floor(o.remainingMilli / 1000),
                                    ),
                                  ),
                                );
                              }}
                            >
                              填入
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="subpanel">
          <div className="subpanel-head">
            <h3>最新撮合成交</h3>
          </div>
          <div className="table-wrap">
            <table className="ink-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>商品</th>
                  <th className="num-col">成交价</th>
                  <th className="num-col">数量</th>
                </tr>
              </thead>
              <tbody>
                {state.recentTrades.map((tr) => (
                  <tr key={tr.id}>
                    <td className="mono-num">{tr.executedAt}</td>
                    <td>{tr.itemName}</td>
                    <td className="num-col mono-num">
                      {formatGold(tr.priceBasis, 4)}
                    </td>
                    <td className="num-col mono-num">
                      {formatResource(tr.quantityMilli, 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
