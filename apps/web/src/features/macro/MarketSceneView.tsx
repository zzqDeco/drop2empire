import { useEffect, useMemo, useState } from "react";
import { api } from "@drop2empire/api-client";
import { Cpu, FlaskConical, Layers, Scale, TrendingUp } from "lucide-react";
import { ICON } from "../../icons";
import { fixedInput } from "../../economy";
import { formatGold, formatResource } from "../../format";
import {
  classifyMarketCategory,
  resolveSellableStockMilli,
  type MarketCategoryFilter,
} from "../../domain/settlementSelectors";
import type { SceneProps } from "./types";

interface MarketSceneViewProps extends SceneProps {
  focusItemKey?: string | null;
  onClearFocusItem?: () => void;
}

const CATEGORY_TABS: Array<{ key: MarketCategoryFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "supply", label: "基础与军备" },
  { key: "equipment", label: "增产设备" },
  { key: "blueprint", label: "荒原蓝图" },
  { key: "cosmetic", label: "赛季外观" },
];

function formatChangePct(bps: number): string {
  const pct = bps / 100;
  if (pct > 0) return `+${pct.toFixed(1)}%`;
  return `${pct.toFixed(1)}%`;
}

/**
 * Scene III: Workshop Crafting, Cross-Profession Equipment Rack & Global CLOB Spot Market
 */
export function MarketSceneView({
  state,
  busy,
  runAction,
  focusItemKey,
  onClearFocusItem,
}: MarketSceneViewProps) {
  const [selectedMarketItem, setSelectedMarketItem] = useState(
    () => focusItemKey || state.marketSummaries[0]?.itemKey || "water",
  );
  const [categoryFilter, setCategoryFilter] =
    useState<MarketCategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [orderSide, setOrderSide] = useState<"BID" | "ASK">(() =>
    focusItemKey ? "BID" : (state.player.goldBasis ?? 0) > 0 ? "BID" : "ASK",
  );
  const [orderPriceGold, setOrderPriceGold] = useState(() => {
    const first =
      state.marketSummaries.find((m) => m.itemKey === focusItemKey) ??
      state.marketSummaries[0];
    if (!first) return "0.1";
    const ref =
      first.bestAskBasis > 0
        ? first.bestAskBasis
        : first.bestBidBasis > 0
          ? first.bestBidBasis
          : first.lastPriceBasis;
    return ref > 0 ? (ref / 10000).toFixed(4) : "0.1";
  });
  const [orderQtyUnits, setOrderQtyUnits] = useState("1");
  const [recipeBatches, setRecipeBatches] = useState<Record<string, number>>(
    {},
  );

  useEffect(() => {
    if (!focusItemKey) return;
    const target = state.marketSummaries.find(
      (m) => m.itemKey === focusItemKey,
    );
    if (target) {
      setSelectedMarketItem(target.itemKey);
      setCategoryFilter("all");
      setSearchQuery("");
      setOrderSide("BID");
      const ask =
        target.bestAskBasis > 0 ? target.bestAskBasis : target.lastPriceBasis;
      if (ask > 0) {
        setOrderPriceGold((ask / 10000).toFixed(4));
      }
      setOrderQtyUnits("1");
    }
    onClearFocusItem?.();
  }, [focusItemKey, onClearFocusItem, state.marketSummaries]);

  const marketNameMap = useMemo(
    () => new Map(state.marketSummaries.map((m) => [m.itemKey, m.itemName])),
    [state.marketSummaries],
  );

  const filteredMarketItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return state.marketSummaries.filter((m) => {
      if (
        categoryFilter !== "all" &&
        classifyMarketCategory(m.itemKey) !== categoryFilter
      ) {
        return false;
      }
      if (
        q &&
        !m.itemName.toLowerCase().includes(q) &&
        !m.itemKey.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [state.marketSummaries, categoryFilter, searchQuery]);

  const selectedMarketMeta =
    state.marketSummaries.find((m) => m.itemKey === selectedMarketItem) ??
    filteredMarketItems[0] ??
    state.marketSummaries[0];

  const activeItemKey = selectedMarketMeta?.itemKey ?? selectedMarketItem;
  const sellableStockMilli = resolveSellableStockMilli(state, activeItemKey);
  const sellableUnits = Math.floor(sellableStockMilli / 1000);

  let parsedPriceBasis = 0;
  try {
    parsedPriceBasis = fixedInput(orderPriceGold, 4);
  } catch {
    parsedPriceBasis = 0;
  }
  const maxBuyUnits =
    parsedPriceBasis > 0
      ? Math.floor((state.player.goldBasis ?? 0) / parsedPriceBasis)
      : 0;

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
    if (orderSide === "BID" && ticket.totalBasis > (state.player.goldBasis ?? 0))
      ticketError = "可用金币不足";
    if (orderSide === "ASK" && ticket.quantityMilli > sellableStockMilli)
      ticketError = "可用库存不足";
  } catch (error) {
    ticketError = error instanceof Error ? error.message : "订单输入无效";
  }

  const fillOrderRatio = (ratio: number) => {
    const cap = orderSide === "ASK" ? sellableUnits : maxBuyUnits;
    const computed = Math.max(1, Math.floor(cap * ratio));
    setOrderQtyUnits(String(computed));
  };

  const itemOrders = useMemo(
    () => state.openOrders.filter((o) => o.itemKey === activeItemKey),
    [state.openOrders, activeItemKey],
  );
  const askOrders = useMemo(
    () =>
      itemOrders
        .filter((o) => o.side === "ASK")
        .sort((a, b) => b.priceBasis - a.priceBasis),
    [itemOrders],
  );
  const bidOrders = useMemo(
    () =>
      itemOrders
        .filter((o) => o.side === "BID")
        .sort((a, b) => b.priceBasis - a.priceBasis),
    [itemOrders],
  );

  const ownOrders = useMemo(
    () => state.openOrders.filter((o) => o.isOwn),
    [state.openOrders],
  );

  const spreadBasis =
    selectedMarketMeta &&
    selectedMarketMeta.bestAskBasis > 0 &&
    selectedMarketMeta.bestBidBasis > 0
      ? selectedMarketMeta.bestAskBasis - selectedMarketMeta.bestBidBasis
      : null;

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
                      void runAction(
                        () =>
                          api.installEquipment({
                            itemKey: eq.itemKey,
                            delta: -1,
                          }),
                        undefined,
                        "equip",
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
                      void runAction(
                        () =>
                          api.installEquipment({
                            itemKey: eq.itemKey,
                            delta: 1,
                          }),
                        undefined,
                        "equip",
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
            {state.recipes.map((rc) => {
              const batches = recipeBatches[rc.recipeCode] ?? 1;
              const totalGoldCost = rc.goldCostBasis * batches;
              const canCraftBatch =
                batches === 1
                  ? rc.canCraft
                  : rc.professionMatched &&
                    state.player.goldBasis >= totalGoldCost &&
                    rc.costs.every(
                      (c) => c.currentMilli >= c.requiredMilli * batches,
                    );
              const totalOutMilli = rc.outputAmountMilli * batches;

              return (
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
                      +{formatResource(totalOutMilli, 0)}
                    </span>
                  </div>
                  <p className="recipe-desc">{rc.effectSummary}</p>
                  {rc.professionMatched && (
                    <div className="batch-pill-group">
                      {[1, 5, 10].map((b) => (
                        <button
                          key={b}
                          type="button"
                          className={`btn-chip mono-num ${batches === b ? "active" : ""}`}
                          onClick={() =>
                            setRecipeBatches((prev) => ({
                              ...prev,
                              [rc.recipeCode]: b,
                            }))
                          }
                        >
                          ×{b}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="recipe-footer">
                    <div className="bp-costs">
                      {rc.costs.map((c) => {
                        const reqMilli = c.requiredMilli * batches;
                        return (
                          <span
                            key={c.resourceKey}
                            className={`cost-chip mono-num ${c.currentMilli >= reqMilli ? "cost-ok" : "cost-lack"}`}
                          >
                            {c.resourceName} {formatResource(c.currentMilli, 0)}
                            /{formatResource(reqMilli, 0)}
                          </span>
                        );
                      })}
                      {totalGoldCost > 0 && (
                        <span
                          className={`cost-chip mono-num ${state.player.goldBasis >= totalGoldCost ? "cost-ok" : "cost-lack"}`}
                        >
                          {formatGold(totalGoldCost)} G
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      data-pop={`+${formatResource(totalOutMilli, 0)} ${rc.outputName}`}
                      disabled={!canCraftBatch}
                      onClick={() =>
                        void runAction(() =>
                          api.craftItem({
                            recipeCode: rc.recipeCode,
                            batches,
                          }),
                        )
                      }
                    >
                      {rc.professionMatched ? (
                        <>
                          <Cpu size={ICON.xs} />
                          <span className="mono-num">
                            {batches > 1 ? `制造 ×${batches}` : "制造"}
                          </span>
                        </>
                      ) : (
                        <span className="lock-pill">仅限对应职业</span>
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lower Section: Global CLOB Spot Market */}
      <div className="tab-body split-3col">
        {/* Column 1: Categorized & Searchable Market Ticker */}
        <div className="subpanel">
          <div className="subpanel-head">
            <h3>
              <TrendingUp size={ICON.sm} />
              <span>全球现货行情（含荒原蓝图与外观）</span>
            </h3>
          </div>

          <div className="market-filter-bar">
            <div className="batch-pill-group">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`btn-chip ${categoryFilter === tab.key ? "active" : ""}`}
                  onClick={() => setCategoryFilter(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {state.marketSummaries.length > 5 && (
              <input
                type="search"
                aria-label="搜索市场商品"
                placeholder="按名称或代号检索商品..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            )}
          </div>

          <div className="table-wrap table-scroll">
            <table className="ink-table clickable-rows">
              <thead>
                <tr>
                  <th>商品</th>
                  <th className="num-col">现价 / 24h</th>
                  <th className="num-col">买一 / 卖一</th>
                  <th className="num-col">量</th>
                </tr>
              </thead>
              <tbody>
                {filteredMarketItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-cell">
                      未找到匹配该筛选条件的商品
                    </td>
                  </tr>
                ) : (
                  filteredMarketItems.map((m) => (
                    <tr
                      key={m.itemKey}
                      className={
                        m.itemKey === activeItemKey ? "row-selected" : ""
                      }
                      onClick={() => {
                        setSelectedMarketItem(m.itemKey);
                        const refPrice =
                          orderSide === "BID" && m.bestAskBasis > 0
                            ? m.bestAskBasis
                            : orderSide === "ASK" && m.bestBidBasis > 0
                              ? m.bestBidBasis
                              : m.lastPriceBasis;
                        if (refPrice > 0) {
                          setOrderPriceGold((refPrice / 10000).toFixed(4));
                        }
                      }}
                    >
                      <td>
                        <strong>{m.itemName}</strong>
                      </td>
                      <td className="num-col mono-num">
                        <div>
                          {m.lastPriceBasis
                            ? formatGold(m.lastPriceBasis, 4)
                            : "暂无成交"}
                        </div>
                        <small
                          className={
                            (m.change24hPctBps ?? 0) > 0
                              ? "rate-pos"
                              : (m.change24hPctBps ?? 0) < 0
                                ? "cost-lack"
                                : "rate-zero"
                          }
                        >
                          {formatChangePct(m.change24hPctBps ?? 0)}
                        </small>
                      </td>
                      <td className="num-col mono-num">
                        {m.bestBidBasis > 0
                          ? formatGold(m.bestBidBasis, 4)
                          : "—"}{" "}
                        /{" "}
                        {m.bestAskBasis > 0
                          ? formatGold(m.bestAskBasis, 4)
                          : "—"}
                      </td>
                      <td className="num-col mono-num">
                        {formatResource(m.volume24hMilli, 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Column 2: Order Ticket + Split Asks/Spread/Bids Depth */}
        <div className="subpanel">
          <div className="subpanel-head">
            <h3>委托挂单 · {selectedMarketMeta?.itemName ?? activeItemKey}</h3>
          </div>

          <form
            className="order-ticket"
            onSubmit={(e) => {
              e.preventDefault();
              if (!ticket || ticketError || busy) return;
              const { priceBasis, quantityMilli } = ticket;
              void runAction(() =>
                api.placeMarketOrder({
                  itemKey: activeItemKey,
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

            <div className="order-balance-bar mono-num">
              <span>
                可用金币 <strong>{formatGold(state.player.goldBasis)} G</strong>{" "}
                · 可售库存 <strong>{sellableUnits}</strong>
              </span>
              <div className="batch-pill-group">
                {(
                  [
                    [0.25, "25%"],
                    [0.5, "50%"],
                    [1, "最大"],
                  ] as const
                ).map(([ratio, label]) => (
                  <button
                    key={label}
                    type="button"
                    className="btn-chip mono-num"
                    disabled={
                      orderSide === "ASK"
                        ? sellableUnits <= 0
                        : maxBuyUnits <= 0
                    }
                    onClick={() => fillOrderRatio(ratio)}
                  >
                    {label}
                  </button>
                ))}
              </div>
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
              {ticketError && (
                <span role="status" className="cost-lack">
                  {ticketError}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary btn-block"
              disabled={busy || !ticket || Boolean(ticketError)}
              data-pop={
                orderSide === "BID"
                  ? `挂买 ${orderQtyUnits}×${selectedMarketMeta?.itemName ?? ""}`
                  : `挂卖 ${orderQtyUnits}×${selectedMarketMeta?.itemName ?? ""}`
              }
            >
              {orderSide === "BID" ? "提交买单" : "提交卖单"}
            </button>
          </form>

          <div className="orderbook-box">
            <h4>双向盘口深度（点击档位一键带入对手价）</h4>
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
                  {askOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <span className="side-pill pill-ask">ASK</span>
                      </td>
                      <td className="num-col mono-num">
                        {formatGold(o.priceBasis, 4)}
                      </td>
                      <td className="num-col mono-num">
                        {formatResource(o.remainingMilli, 0)}
                      </td>
                      <td>
                        <span>{o.makerName}</span>{" "}
                        {o.isNpc && <span className="tier-pill">商会平准</span>}
                      </td>
                      <td>
                        {o.isOwn ? (
                          <button
                            type="button"
                            className="btn-link"
                            data-pop="✓ 撤单解冻"
                            onClick={() =>
                              void runAction(() => api.cancelMarketOrder(o.id))
                            }
                          >
                            撤单
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-link"
                            data-pop="填入买价"
                            title="按该卖单价格填入买单"
                            onClick={() => {
                              setOrderSide("BID");
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

                  <tr className="orderbook-spread-bar">
                    <td colSpan={5} className="mono-num">
                      买一{" "}
                      {selectedMarketMeta && selectedMarketMeta.bestBidBasis > 0
                        ? formatGold(selectedMarketMeta.bestBidBasis, 4)
                        : "—"}{" "}
                      · 卖一{" "}
                      {selectedMarketMeta && selectedMarketMeta.bestAskBasis > 0
                        ? formatGold(selectedMarketMeta.bestAskBasis, 4)
                        : "—"}
                      {spreadBasis !== null
                        ? ` · 价差 ${formatGold(spreadBasis, 4)} G`
                        : ""}
                    </td>
                  </tr>

                  {bidOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <span className="side-pill pill-bid">BID</span>
                      </td>
                      <td className="num-col mono-num">
                        {formatGold(o.priceBasis, 4)}
                      </td>
                      <td className="num-col mono-num">
                        {formatResource(o.remainingMilli, 0)}
                      </td>
                      <td>
                        <span>{o.makerName}</span>{" "}
                        {o.isNpc && <span className="tier-pill">商会平准</span>}
                      </td>
                      <td>
                        {o.isOwn ? (
                          <button
                            type="button"
                            className="btn-link"
                            data-pop="✓ 撤单解冻"
                            onClick={() =>
                              void runAction(() => api.cancelMarketOrder(o.id))
                            }
                          >
                            撤单
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-link"
                            data-pop="填入卖价"
                            title="按该买单价格填入卖单"
                            onClick={() => {
                              setOrderSide("ASK");
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

        {/* Column 3: Cross-Item Own Open Orders + Recent Matched Trades */}
        <div className="subpanel">
          <div className="subpanel-head">
            <h3>
              <Scale size={ICON.sm} />
              <span className="mono-num">
                我的当前挂单 ({ownOrders.length})
              </span>
            </h3>
          </div>
          <div className="table-wrap">
            <table className="ink-table">
              <thead>
                <tr>
                  <th>商品</th>
                  <th>方向</th>
                  <th className="num-col">单价 / 余量</th>
                  <th className="num-col">操作</th>
                </tr>
              </thead>
              <tbody>
                {ownOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-cell">
                      当前无挂单托管中的资金或物资
                    </td>
                  </tr>
                ) : (
                  ownOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <strong>
                          {marketNameMap.get(o.itemKey) ?? o.itemKey}
                        </strong>
                      </td>
                      <td>
                        <span
                          className={`side-pill ${o.side === "BID" ? "pill-bid" : "pill-ask"}`}
                        >
                          {o.side}
                        </span>
                      </td>
                      <td className="num-col mono-num">
                        {formatGold(o.priceBasis, 4)} ×{" "}
                        {formatResource(o.remainingMilli, 0)}
                      </td>
                      <td className="num-col">
                        <button
                          type="button"
                          className="btn-link"
                          data-pop="✓ 撤单解冻"
                          onClick={() =>
                            void runAction(() => api.cancelMarketOrder(o.id))
                          }
                        >
                          撤单
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="subpanel-head">
            <h3>最新撮合成交</h3>
          </div>
          <div className="table-wrap table-scroll">
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
                {state.recentTrades.map((tr) => {
                  const isMine =
                    Boolean(state.player.handle) &&
                    (tr.buyerName === state.player.handle ||
                      tr.sellerName === state.player.handle);
                  return (
                    <tr
                      key={tr.id}
                      className={isMine ? "row-selected" : undefined}
                    >
                      <td className="mono-num">{tr.executedAt}</td>
                      <td>
                        <span>{tr.itemName}</span>{" "}
                        {isMine && (
                          <span className="tag-badge tag-success">
                            我的成交
                          </span>
                        )}
                      </td>
                      <td className="num-col mono-num">
                        {formatGold(tr.priceBasis, 4)}
                      </td>
                      <td className="num-col mono-num">
                        {formatResource(tr.quantityMilli, 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
