import { useState } from "react";
import { api, type DashboardStateResp } from "@drop2empire/api-client";
import {
  Award,
  Box,
  Cpu,
  FlaskConical,
  Layers,
  Scale,
  Shield,
  Sparkles,
  Swords,
  TrendingUp,
} from "lucide-react";
import { ICON } from "./icons";
import { formatGold, formatResource } from "./format";
import { ProceduralRelicSVG } from "./ProceduralRelicSVG";
import { WarGraphMapSVG } from "./WarGraphMapSVG";

type BottomTab = "craft" | "market" | "war" | "collectibles" | "chronicle";

export function MacroEmpireWorkspace({
  state,
  busy,
  runAction,
}: {
  state: DashboardStateResp;
  busy: boolean;
  runAction: (
    fn: () => Promise<DashboardStateResp>,
    successMsg?: string,
  ) => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<BottomTab>("craft");
  const [selectedMarketItem, setSelectedMarketItem] = useState("auto_pump");
  const [orderSide, setOrderSide] = useState<"BID" | "ASK">("BID");
  const [orderPriceGold, setOrderPriceGold] = useState("19.20");
  const [orderQtyUnits, setOrderQtyUnits] = useState("1");
  const [selectedNodeId, setSelectedNodeId] = useState("node_north_fort");
  const [deployInf, setDeployInf] = useState(2);
  const [deployArc, setDeployArc] = useState(2);
  const [deployCav, setDeployCav] = useState(2);

  const { player, resources } = state;
  const selectedWarNode =
    state.war.nodes.find((n) => n.nodeId === selectedNodeId) ??
    state.war.nodes[0];
  const selectedMarketMeta =
    state.marketSummaries.find((m) => m.itemKey === selectedMarketItem) ??
    state.marketSummaries[0];

  return (
    <section className="lower-workspace" aria-label="帝国系统">
      <div className="tabs-header">
        <div className="tab-buttons" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "craft"}
            className={`tab-btn ${activeTab === "craft" ? "active" : ""}`}
            onClick={() => setActiveTab("craft")}
          >
            <Cpu size={ICON.sm} />
            <span>工坊</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "market"}
            className={`tab-btn ${activeTab === "market" ? "active" : ""}`}
            onClick={() => setActiveTab("market")}
          >
            <TrendingUp size={ICON.sm} />
            <span>市场</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "war"}
            className={`tab-btn ${activeTab === "war" ? "active" : ""}`}
            onClick={() => setActiveTab("war")}
          >
            <Swords size={ICON.sm} />
            <span>战区 (D{state.war.currentDay})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "collectibles"}
            className={`tab-btn ${activeTab === "collectibles" ? "active" : ""}`}
            onClick={() => setActiveTab("collectibles")}
          >
            <Award size={ICON.sm} />
            <span>藏品 ({state.collectibles.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "chronicle"}
            className={`tab-btn ${activeTab === "chronicle" ? "active" : ""}`}
            onClick={() => setActiveTab("chronicle")}
          >
            <Scale size={ICON.sm} />
            <span>纪事</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Workshop */}
      {activeTab === "craft" && (
        <div className="tab-body split-2col">
          <div className="subpanel">
            <div className="subpanel-head">
              <h3>
                <Layers size={ICON.sm} />
                <span>设备装槽</span>
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
                      disabled={eq.installedCount <= 0 || busy}
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
                      disabled={
                        eq.inventoryUnits <= 0 ||
                        eq.installedCount >= eq.maxStack ||
                        busy
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
                <span>制造配方</span>
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
                        <span className="cost-chip mono-num">
                          {formatGold(rc.goldCostBasis)} G
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={!rc.canCraft || busy}
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
                        "制造"
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
      )}

      {/* TAB 2: Market */}
      {activeTab === "market" && (
        <div className="tab-body split-3col">
          <div className="subpanel">
            <div className="subpanel-head">
              <h3>行情</h3>
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
                        setOrderPriceGold((refPrice / 10000).toFixed(2));
                      }}
                    >
                      <td>
                        <strong>{m.itemName}</strong>
                      </td>
                      <td className="num-col mono-num">
                        {formatGold(m.lastPriceBasis)}
                      </td>
                      <td className="num-col mono-num">
                        {m.bestBidBasis > 0 ? formatGold(m.bestBidBasis) : "—"}{" "}
                        /{" "}
                        {m.bestAskBasis > 0 ? formatGold(m.bestAskBasis) : "—"}
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
              <h3>委托 · {selectedMarketMeta.itemName}</h3>
            </div>

            <form
              className="order-ticket"
              onSubmit={(e) => {
                e.preventDefault();
                const priceBasis = Math.round(Number(orderPriceGold) * 10000);
                const quantityMilli = Math.round(Number(orderQtyUnits) * 1000);
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
                  买入
                </button>
                <button
                  type="button"
                  className={`side-btn ${orderSide === "ASK" ? "active-ask" : ""}`}
                  onClick={() => setOrderSide("ASK")}
                >
                  卖出
                </button>
              </div>

              <div className="form-row-2">
                <label>
                  <span>单价</span>
                  <input
                    type="number"
                    step="0.01"
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
                  总额{" "}
                  {(
                    Number(orderPriceGold || 0) * Number(orderQtyUnits || 0)
                  ).toFixed(2)}{" "}
                  G
                </span>
                <span>税率 1%</span>
              </div>

              <button
                type="submit"
                className="btn-primary btn-block"
                disabled={busy}
              >
                {orderSide === "BID" ? "挂买单" : "挂卖单"}
              </button>
            </form>

            <div className="orderbook-box">
              <h4>盘口</h4>
              <div className="table-wrap">
                <table className="ink-table">
                  <thead>
                    <tr>
                      <th>方向</th>
                      <th className="num-col">价格</th>
                      <th className="num-col">数量</th>
                      <th>卖家/买家</th>
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
                            {formatGold(o.priceBasis)}
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
                                onClick={() => {
                                  setOrderSide(
                                    o.side === "ASK" ? "BID" : "ASK",
                                  );
                                  setOrderPriceGold(
                                    (o.priceBasis / 10000).toFixed(2),
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
              <h3>最新成交</h3>
            </div>
            <div className="table-wrap">
              <table className="ink-table">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>商品</th>
                    <th className="num-col">价格</th>
                    <th className="num-col">数量</th>
                  </tr>
                </thead>
                <tbody>
                  {state.recentTrades.map((tr) => (
                    <tr key={tr.id}>
                      <td className="mono-num">{tr.executedAt}</td>
                      <td>{tr.itemName}</td>
                      <td className="num-col mono-num">
                        {formatGold(tr.priceBasis)}
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
      )}

      {/* TAB 3: Chamber War */}
      {activeTab === "war" && (
        <div className="tab-body war-layout">
          <div className="war-main-col">
            <div className="war-scoreboard">
              <div className="guild-score-block">
                <span className="guild-tag">黑曜商会</span>
                <strong className="mono-num">
                  {state.war.obsidianTotalScore}
                </strong>
              </div>
              <div className="war-day-banner">
                <span className="tag-badge">D{state.war.currentDay} / 7</span>
                <small>每日 20:00 结算</small>
              </div>
              <div className="guild-score-block">
                <span className="guild-tag">白银同盟</span>
                <strong className="mono-num">
                  {state.war.argentTotalScore}
                </strong>
              </div>
            </div>

            <WarGraphMapSVG
              nodes={state.war.nodes}
              edges={state.war.edges}
              selectedNodeId={selectedWarNode.nodeId}
              onSelectNode={(id) => setSelectedNodeId(id)}
            />

            <div className="war-history-box">
              <div className="subpanel-head">
                <h3>战报</h3>
              </div>
              {state.war.settlementHistory.length === 0 ? (
                <p className="muted-note">暂无战报</p>
              ) : (
                <div className="settlement-list">
                  {state.war.settlementHistory.map((h) => (
                    <details
                      key={`${h.dayIndex}-${h.settledAt}`}
                      className="settlement-item"
                      open
                    >
                      <summary className="mono-num">
                        D{h.dayIndex} ({h.settledAt}) · 黑曜 +
                        {h.obsidianScoreDelta} / 白银 +{h.argentScoreDelta}
                      </summary>
                      <div className="table-wrap">
                        <table className="ink-table">
                          <thead>
                            <tr>
                              <th>据点</th>
                              <th>归属</th>
                              <th className="num-col">黑曜</th>
                              <th className="num-col">白银</th>
                              <th>结果</th>
                            </tr>
                          </thead>
                          <tbody>
                            {h.nodeReports.map((nr) => (
                              <tr key={nr.nodeId}>
                                <td>
                                  <strong>{nr.nodeName}</strong>
                                </td>
                                <td className="mono-num">
                                  {nr.prevOwner} → {nr.newOwner}
                                </td>
                                <td className="num-col mono-num">
                                  {nr.obsidianInfantry}/{nr.obsidianArcher}/
                                  {nr.obsidianCavalry}
                                </td>
                                <td className="num-col mono-num">
                                  {nr.argentInfantry}/{nr.argentArcher}/
                                  {nr.argentCavalry}
                                </td>
                                <td>{nr.casualtySummary}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="subpanel war-side-col">
            <div className="subpanel-head">
              <h3>
                <Shield size={ICON.sm} />
                <span>{selectedWarNode.name}</span>
              </h3>
            </div>

            <div className="war-guild-bar">
              <span>{state.war.playerGuildName}</span>
              <button
                type="button"
                className="btn-outline"
                onClick={() =>
                  void runAction(() =>
                    api.switchGuild({
                      guildCode:
                        state.war.playerGuild === "OBSIDIAN"
                          ? "ARGENT"
                          : "OBSIDIAN",
                    }),
                  )
                }
              >
                切换阵营
              </button>
            </div>

            <div className="node-intel-card">
              <div className="intel-row">
                <span>归属</span>
                <strong className="mono-num">
                  {selectedWarNode.ownerGuild}
                </strong>
              </div>
              <div className="intel-row">
                <span>守军 (步/弓/骑)</span>
                <strong className="mono-num">
                  {selectedWarNode.infantryCount}/{selectedWarNode.archerCount}/
                  {selectedWarNode.cavalryCount}
                </strong>
              </div>
              <div className="intel-row">
                <span>补给线</span>
                <strong
                  className={
                    selectedWarNode.canDeploy ? "rate-pos" : "cost-lack"
                  }
                >
                  {selectedWarNode.canDeploy ? "已连通" : "未连通"}
                </strong>
              </div>
              <div className="intel-row">
                <span>今日额度</span>
                <strong className="mono-num">
                  {state.war.dailyBudgetUsed} / {state.war.dailyBudgetCap}
                </strong>
              </div>
              <p className="intel-note">{selectedWarNode.intelNote}</p>
            </div>

            <form
              className="deploy-form"
              onSubmit={(e) => {
                e.preventDefault();
                void runAction(() =>
                  api.deployWarTroops({
                    nodeId: selectedWarNode.nodeId,
                    infantryDelta: deployInf,
                    archerDelta: deployArc,
                    cavalryDelta: deployCav,
                  }),
                );
              }}
            >
              <h4>派兵</h4>
              <div className="form-row-3">
                <label>
                  <span>步兵</span>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    className="mono-num"
                    value={deployInf}
                    onChange={(e) => setDeployInf(Number(e.target.value))}
                  />
                </label>
                <label>
                  <span>弓兵</span>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    className="mono-num"
                    value={deployArc}
                    onChange={(e) => setDeployArc(Number(e.target.value))}
                  />
                </label>
                <label>
                  <span>骑兵</span>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    className="mono-num"
                    value={deployCav}
                    onChange={(e) => setDeployCav(Number(e.target.value))}
                  />
                </label>
              </div>

              <button
                type="submit"
                className="btn-primary btn-block"
                disabled={!selectedWarNode.canDeploy || busy}
              >
                出兵
              </button>
            </form>
          </aside>
        </div>
      )}

      {/* TAB 4: Collectibles & Season Rules */}
      {activeTab === "collectibles" && (
        <div className="tab-body">
          <div className="chest-console">
            <div className="chest-console-info">
              <h3>
                <Box size={ICON.sm} />
                <span>
                  {state.currentSeason?.title ?? "S1 · 黑曜复苏与墨械纪元"} ·
                  典藏宝箱
                </span>
              </h3>
              <p>
                100 积分兑换 1 个宝箱。开启后获得的唯一序列号程序化纹理藏品与{" "}
                <code>cos_*</code> 赛季动态外观跨赛季永久保留。
              </p>
            </div>
            <div className="chest-console-actions">
              <button
                type="button"
                className="btn-outline mono-num"
                disabled={player.activityPoints < 100 || busy}
                onClick={() =>
                  void runAction(() => api.redeemSeasonChest({ count: 1 }))
                }
              >
                兑换宝箱 (-100 积分)
              </button>
              <button
                type="button"
                className="btn-primary mono-num"
                disabled={
                  (resources.find((r) => r.key === "season_chest")
                    ?.amountMilli ?? 0) < 1000 || busy
                }
                onClick={() =>
                  void runAction(() =>
                    api.openSeasonChest({ clientSeedHint: Date.now() }),
                  )
                }
              >
                <Sparkles size={ICON.sm} />
                <span>
                  开箱 (
                  {Math.floor(
                    (resources.find((r) => r.key === "season_chest")
                      ?.amountMilli ?? 0) / 1000,
                  )}
                  )
                </span>
              </button>
            </div>
          </div>

          {state.collectibles.length === 0 ? (
            <div className="empty-stage-hint">暂无藏品</div>
          ) : (
            <div className="collectibles-grid">
              {state.collectibles.map((item) => (
                <article key={item.itemId} className="collectible-card">
                  <ProceduralRelicSVG item={item} />
                  <div className="collectible-meta">
                    <div className="collectible-title-row">
                      <strong>{item.name}</strong>
                      <span
                        className={`rarity-badge rarity-${item.rarityTier.toLowerCase()}`}
                      >
                        {item.rarityTier}
                      </span>
                    </div>
                    <div className="special-tag-row">{item.specialTag}</div>
                    <dl className="collectible-kv mono-num">
                      <div>
                        <dt>编号</dt>
                        <dd>#{item.serialNumber}</dd>
                      </div>
                      <div>
                        <dt>纹理</dt>
                        <dd>
                          {item.textureName} · {item.paletteName}
                        </dd>
                      </div>
                      <div>
                        <dt>种子</dt>
                        <dd>{item.patternSeed}</dd>
                      </div>
                    </dl>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Chronicle & Season Notice */}
      {activeTab === "chronicle" && (
        <div className="tab-body split-2col">
          <div className="subpanel">
            <div className="subpanel-head">
              <h3>赛季动向</h3>
            </div>
            <div className="notice-stack">
              {state.seasonNotices.map((sn) => (
                <article key={sn.seasonId} className="season-notice-card">
                  <div className="bp-top">
                    <strong>{sn.title}</strong>
                    <span className="tag-badge">{sn.effectiveIn}</span>
                  </div>
                  <p>{sn.summary}</p>
                  <ul>
                    {sn.demandShifts.map((ds) => (
                      <li key={ds}>{ds}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>

          <div className="subpanel">
            <div className="subpanel-head">
              <h3>纪事</h3>
            </div>
            <ul className="event-log-list">
              {state.eventLogs.map((ev) => (
                <li key={ev.id} className="event-log-item">
                  <span className="event-time mono-num">{ev.timestamp}</span>
                  <span className="event-cat">{ev.category}</span>
                  <span className="event-msg">{ev.message}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
