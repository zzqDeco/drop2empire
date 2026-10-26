import { useState } from "react";
import { api, type DashboardStateResp } from "@drop2empire/api-client";
import {
  Award,
  Box,
  Compass,
  Cpu,
  FlaskConical,
  Layers,
  LogOut,
  Moon,
  Plus,
  Scale,
  Shield,
  Sparkles,
  Sun,
  Swords,
  TrendingUp,
} from "lucide-react";
import { ICON } from "./icons";
import { formatGold, formatResource } from "./format";
import { ProceduralRelicSVG } from "./ProceduralRelicSVG";
import { WarGraphMapSVG } from "./WarGraphMapSVG";
import { CivilizationSilhouetteSVG } from "./RaidSpritesSVG";
import type { ThemeMode } from "./theme";

export type WorldZoneKey = "settlement" | "scout" | "market" | "war" | "lord";

interface SceneProps {
  state: DashboardStateResp;
  busy?: boolean;
  runAction: (
    fn: () => Promise<DashboardStateResp>,
    successMsg?: string,
  ) => Promise<void>;
}

/**
 * Scene III: Workshop Crafting, Cross-Profession Equipment Rack & Global CLOB Spot Market
 */
export function MarketSceneView({ state, runAction }: SceneProps) {
  const [selectedMarketItem, setSelectedMarketItem] = useState("water");
  const [orderSide, setOrderSide] = useState<"BID" | "ASK">("BID");
  const [orderPriceGold, setOrderPriceGold] = useState("0.1");
  const [orderQtyUnits, setOrderQtyUnits] = useState("1");

  const selectedMarketMeta =
    state.marketSummaries.find((m) => m.itemKey === selectedMarketItem) ??
    state.marketSummaries[0];

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
                      setOrderPriceGold((refPrice / 10000).toFixed(2));
                    }}
                  >
                    <td>
                      <strong>{m.itemName}</strong>
                    </td>
                    <td className="num-col mono-num">
                      {m.lastPriceBasis ? formatGold(m.lastPriceBasis) : "暂无成交"}
                    </td>
                    <td className="num-col mono-num">
                      {m.bestBidBasis > 0 ? formatGold(m.bestBidBasis) : "—"} /{" "}
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
            <h3>委托挂单 · {selectedMarketMeta.itemName}</h3>
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
              <span>交易税 1% · 全额进入财政账户</span>
            </div>

            <button
              type="submit"
              className="btn-primary btn-block"
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
    </div>
  );
}

/**
 * Scene IV: Guild System (公会大厅) & 8-Node Chamber Territory War (城池争夺战区)
 */
export function WarGuildSceneView({ state, runAction }: SceneProps) {
  const [selectedNodeId, setSelectedNodeId] = useState("node_north_fort");
  const [deployInf, setDeployInf] = useState(2);
  const [deployArc, setDeployArc] = useState(2);
  const [deployCav, setDeployCav] = useState(2);

  const [newGuildName, setNewGuildName] = useState("");
  const [newGuildTag, setNewGuildTag] = useState("");
  const [newGuildFaction, setNewGuildFaction] = useState<"OBSIDIAN" | "ARGENT">(
    "OBSIDIAN",
  );

  const { player, resources, war } = state;
  const guilds = war.guilds ?? [];
  const joinedGuild =
    guilds.find((g) => g.guildId === war.joinedGuildId) ?? null;

  const selectedWarNode =
    war.nodes.find((n) => n.nodeId === selectedNodeId) ?? war.nodes[0];

  const waterMilli =
    resources.find((r) => r.key === "water")?.amountMilli ?? 0;
  const woodMilli = resources.find((r) => r.key === "wood")?.amountMilli ?? 0;
  const stoneMilli =
    resources.find((r) => r.key === "stone")?.amountMilli ?? 0;
  const infKitMilli =
    resources.find((r) => r.key === "infantry_kit")?.amountMilli ?? 0;
  const arcKitMilli =
    resources.find((r) => r.key === "archer_kit")?.amountMilli ?? 0;
  const cavKitMilli =
    resources.find((r) => r.key === "cavalry_kit")?.amountMilli ?? 0;

  const canDonateSupplies =
    Boolean(joinedGuild) &&
    waterMilli >= 80000 &&
    woodMilli >= 50000 &&
    stoneMilli >= 25000;
  const canDonateGold = Boolean(joinedGuild) && player.goldBasis >= 500000;
  const canCreateGuild =
    waterMilli >= 100000 && woodMilli >= 60000 && stoneMilli >= 30000;

  const hasEnoughKits =
    infKitMilli >= deployInf * 1000 &&
    arcKitMilli >= deployArc * 1000 &&
    cavKitMilli >= deployCav * 1000 &&
    deployInf + deployArc + deployCav > 0;

  return (
    <div className="lower-workspace" aria-label="公会大厅与城池战区">
      {/* Upper Section: Guild Hall (公会大厅：我的公会 & 全服公会名录/创立公会) */}
      <div className="tab-body split-2col">
        {/* Left Subpanel: Active Guild Headquarters */}
        <div className="subpanel">
          <div className="subpanel-head">
            <h3>
              <Shield size={ICON.sm} />
              <span>
                公会大厅 ·{" "}
                {joinedGuild
                  ? `[${joinedGuild.tag}] ${joinedGuild.name} (Lv.${joinedGuild.level})`
                  : "尚未加入公会"}
              </span>
            </h3>
          </div>

          {!joinedGuild ? (
            <div className="empty-stage-hint">
              ⚠️ 战区城池争夺以<strong>公会</strong>为基本建制。请先在右侧名录中<strong>加入一个公会</strong>或<strong>创立新公会</strong>，即可解锁公会集结加成并向战区派兵！
            </div>
          ) : (
            <div>
              <div className="recruit-card">
                <div className="recruit-meta">
                  <div className="recruit-head">
                    <strong>
                      [{joinedGuild.tag}] {joinedGuild.name}
                    </strong>
                    <span className="tag-badge tag-warning mono-num">
                      Lv.{joinedGuild.level} · {joinedGuild.xp}/
                      {joinedGuild.nextLevelXp} XP
                    </span>
                    <span className="tag-badge">{joinedGuild.factionName}</span>
                  </div>
                  <div className="recruit-cost">
                    {joinedGuild.bonusSummary}
                  </div>
                  <div className="recruit-cost mono-num">
                    🎯 公会集结目标：<strong>{joinedGuild.rallyNodeName}</strong> · 金库储备：{formatGold(joinedGuild.treasuryGoldBasis)} G · 我的贡献：{war.playerGuildContribution}
                  </div>
                </div>
              </div>

              <div className="quick-alloc-bar">
                <button
                  type="button"
                  className="btn-primary"
                  data-pop="+100 贡献 / +15 积分"
                  disabled={!canDonateSupplies}
                  onClick={() =>
                    void runAction(() =>
                      api.guildAction({ action: "donate_supplies" }),
                    )
                  }
                >
                  <Plus size={ICON.xs} />
                  <span>后勤捐献 (水80/木50/石25)</span>
                </button>

                <button
                  type="button"
                  className="btn-outline"
                  data-pop="+180 贡献 / +25 积分"
                  disabled={!canDonateGold}
                  onClick={() =>
                    void runAction(() =>
                      api.guildAction({ action: "donate_gold" }),
                    )
                  }
                >
                  <Award size={ICON.xs} />
                  <span>军费捐献 (50 G)</span>
                </button>

                <button
                  type="button"
                  className="btn-outline"
                  data-pop={`🎯 集结 ${selectedWarNode.name}`}
                  disabled={joinedGuild.rallyNodeId === selectedWarNode.nodeId}
                  onClick={() =>
                    void runAction(() =>
                      api.guildAction({
                        action: "set_rally",
                        rallyNodeId: selectedWarNode.nodeId,
                      }),
                    )
                  }
                >
                  <Compass size={ICON.xs} />
                  <span>集结令指向【{selectedWarNode.name}】</span>
                </button>
              </div>

              <div className="table-wrap">
                <table className="ink-table">
                  <thead>
                    <tr>
                      <th>公会成员</th>
                      <th>职务</th>
                      <th className="num-col">累计贡献</th>
                      <th className="num-col">战区出兵</th>
                    </tr>
                  </thead>
                  <tbody>
                    {joinedGuild.members.map((m) => (
                      <tr key={m.handle}>
                        <td>
                          <strong>{m.handle}</strong>
                        </td>
                        <td>
                          <span className="tier-pill">{m.role}</span>
                        </td>
                        <td className="num-col mono-num">{m.contribution}</td>
                        <td className="num-col mono-num">
                          {m.warDeployed} 团
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Subpanel: Guild Directory & Create New Guild */}
        <div className="subpanel">
          <div className="subpanel-head">
            <h3>
              <Swords size={ICON.sm} />
              <span>全服公会名录与创立驻地</span>
            </h3>
          </div>

          <div className="blueprint-list">
            {guilds.map((g) => {
              const isJoined = g.guildId === war.joinedGuildId;
              return (
                <article
                  key={g.guildId}
                  className={`bp-card ${isJoined ? "bp-ready" : ""}`}
                >
                  <div className="bp-top">
                    <div>
                      <strong>
                        [{g.tag}] {g.name}
                      </strong>
                      <span className="bp-pop-req mono-num">
                        Lv.{g.level} · {g.memberCount} 人 · {g.factionName}
                      </span>
                    </div>
                    <span className="tag-badge">
                      集结：{g.rallyNodeName}
                    </span>
                  </div>
                  <p className="bp-desc">{g.announcement}</p>
                  <div className="bp-footer">
                    <span className="cost-chip mono-num">
                      会长：{g.leaderHandle} · 金库 {formatGold(g.treasuryGoldBasis)} G
                    </span>
                    <button
                      type="button"
                      className={isJoined ? "btn-outline" : "btn-primary"}
                      data-pop={`✓ 加入 [${g.tag}]`}
                      disabled={isJoined}
                      onClick={() =>
                        void runAction(() =>
                          api.guildAction({
                            action: "join",
                            guildId: g.guildId,
                          }),
                        )
                      }
                    >
                      {isJoined ? "当前所属公会" : "加入公会"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <form
            className="preset-bar"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newGuildName.trim() || !newGuildTag.trim()) return;
              void runAction(() =>
                api.guildAction({
                  action: "create",
                  name: newGuildName.trim(),
                  tag: newGuildTag.trim().toUpperCase(),
                  faction: newGuildFaction,
                }),
              );
              setNewGuildName("");
              setNewGuildTag("");
            }}
          >
            <div className="preset-save-form">
              <input
                type="text"
                placeholder="新公会名 (2-16字)..."
                value={newGuildName}
                onChange={(e) => setNewGuildName(e.target.value)}
              />
              <input
                type="text"
                placeholder="徽标简称 (如 STAR)"
                maxLength={4}
                value={newGuildTag}
                onChange={(e) => setNewGuildTag(e.target.value)}
              />
              <select
                value={newGuildFaction}
                onChange={(e) =>
                  setNewGuildFaction(e.target.value as "OBSIDIAN" | "ARGENT")
                }
              >
                <option value="OBSIDIAN">效忠黑曜商会</option>
                <option value="ARGENT">效忠白银同盟</option>
              </select>
              <button
                type="submit"
                className="btn-primary"
                data-pop="★ 创立新公会"
                disabled={
                  !canCreateGuild ||
                  newGuildName.trim().length < 2 ||
                  newGuildTag.trim().length < 2
                }
              >
                创立公会 (水100/木60/石30)
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Lower Section: 8-Node Chamber Territory War Map & Troop Deployment */}
      <div className="tab-body war-layout">
        <div className="war-main-col">
          <div className="war-scoreboard">
            <div className="guild-score-block">
              <span className="guild-tag">黑曜商会 (OBSIDIAN)</span>
              <strong className="mono-num">{war.obsidianTotalScore}</strong>
            </div>
            <div className="war-day-banner">
              <span className="tag-badge">战役日 D{war.currentDay} / 7</span>
              <small>每日 20:00 锁定快照结算</small>
            </div>
            <div className="guild-score-block">
              <span className="guild-tag">白银同盟 (ARGENT)</span>
              <strong className="mono-num">{war.argentTotalScore}</strong>
            </div>
          </div>

          <WarGraphMapSVG
            nodes={war.nodes}
            edges={war.edges}
            selectedNodeId={selectedWarNode.nodeId}
            onSelectNode={(id) => setSelectedNodeId(id)}
          />

          <div className="war-history-box">
            <div className="subpanel-head">
              <h3>每日 20:00 城池会战战报</h3>
            </div>
            {war.settlementHistory.length === 0 ? (
              <p className="muted-note">今日 20:00 尚未触发会战结算</p>
            ) : (
              <div className="settlement-list">
                {war.settlementHistory.map((h) => (
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
                            <th>归属变更</th>
                            <th className="num-col">黑曜兵力</th>
                            <th className="num-col">白银兵力</th>
                            <th>交火结果</th>
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
              <span>战略据点 · {selectedWarNode.name}</span>
            </h3>
          </div>

          <div className="war-guild-bar">
            <span>{war.playerGuildName}</span>
            {joinedGuild?.rallyNodeId === selectedWarNode.nodeId && (
              <span className="tag-badge tag-warning">🎯 公会集结目标 (+5积分)</span>
            )}
          </div>

          <div className="node-intel-card">
            <div className="intel-row">
              <span>当前占领方</span>
              <strong className="mono-num">{selectedWarNode.ownerGuild}</strong>
            </div>
            <div className="intel-row">
              <span>驻军 (步 / 弓 / 骑)</span>
              <strong className="mono-num">
                {selectedWarNode.infantryCount}/{selectedWarNode.archerCount}/
                {selectedWarNode.cavalryCount}
              </strong>
            </div>
            <div className="intel-row">
              <span>军备库存 (步 / 弓 / 骑)</span>
              <strong className="mono-num">
                {formatResource(infKitMilli, 0)} /{" "}
                {formatResource(arcKitMilli, 0)} /{" "}
                {formatResource(cavKitMilli, 0)}
              </strong>
            </div>
            <div className="intel-row">
              <span>公会补给线</span>
              <strong
                className={
                  selectedWarNode.canDeploy ? "rate-pos" : "cost-lack"
                }
              >
                {selectedWarNode.canDeploy ? "已连通 (可派兵)" : "未连通"}
              </strong>
            </div>
            <div className="intel-row">
              <span>今日个人行军额度</span>
              <strong className="mono-num">
                {war.dailyBudgetUsed} / {war.dailyBudgetCap}
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
            <h4>代表公会派兵出征</h4>
            <div className="form-row-3">
              <label>
                <span>步兵箱</span>
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
                <span>弓兵箱</span>
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
                <span>骑兵箱</span>
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
              data-pop={`⚔ 出兵 +${deployInf + deployArc + deployCav} 团`}
              disabled={
                !joinedGuild || !selectedWarNode.canDeploy || !hasEnoughKits
              }
            >
              {!joinedGuild
                ? "请先在上方公会大厅加入公会"
                : !selectedWarNode.canDeploy
                  ? "补给线未连通"
                  : !hasEnoughKits
                    ? "军备箱库存不足（工坊制造或市场采购）"
                    : `代表 [${joinedGuild.tag}] 出兵部署`}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

/**
 * Scene V (Lower Panel): Season Chest Console & Procedural UV-Etched Collectibles Gallery
 */
export function SeasonRelicVaultPanel({ state, runAction }: SceneProps) {
  const { player, resources } = state;
  const chestCount = Math.floor(
    (resources.find((r) => r.key === "season_chest")?.amountMilli ?? 0) / 1000,
  );

  return (
    <section className="lower-workspace" aria-label="墨械典藏宝箱与程序化藏品">
      <div className="tab-body">
        <div className="chest-console">
          <div className="chest-console-info">
            <h3>
              <Box size={ICON.sm} />
              <span>
                {state.currentSeason?.title ?? "S1 · 黑曜苏醒"} ·
                墨械唯一编号蚀刻秘宝
              </span>
            </h3>
            <p>
              消耗 100 战争活动积分可兑换 1 个赛季宝箱。开启后铸造具有全服唯一递增序列号与传世墨金蚀刻纹样的秘宝藏品（跨赛季永久保留）。
            </p>
          </div>
          <div className="chest-console-actions">
            <button
              type="button"
              className="btn-outline mono-num"
              data-pop="+1 赛季宝箱"
              disabled={player.activityPoints < 100}
              onClick={() =>
                void runAction(() => api.redeemSeasonChest({ count: 1 }))
              }
            >
              兑换宝箱 (-100 积分)
            </button>
            <button
              type="button"
              className="btn-primary mono-num"
              data-pop="✦ 开启秘宝"
              disabled={chestCount < 1}
              onClick={() =>
                void runAction(() =>
                  api.openSeasonChest({ clientSeedHint: Date.now() }),
                )
              }
            >
              <Sparkles size={ICON.sm} />
              <span>开箱 ({chestCount})</span>
            </button>
          </div>
        </div>

        {state.collectibles.length === 0 ? (
          <div className="empty-stage-hint">
            尚未铸造赛季蚀刻藏品。参与公会捐献或每晚 20:00 战区会战获取活动积分即可兑换开箱！
          </div>
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
    </section>
  );
}

/**
 * Imperial Announcement Modal (帝国公告 · 赛季动向与宏观账本 — 由管理员发布节奏控制)
 */
export function ImperialAnnouncementModal({
  state,
  onClose,
}: {
  state: DashboardStateResp;
  onClose: () => void;
}) {
  const { macroLedger, currentSeason } = state;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="帝国枢密院公告与赛季动向"
    >
      <div className="modal-sheet">
        <div className="modal-header">
          <div>
            <h2>帝国枢密院公告 · 赛季动向与跨季契约</h2>
            <p>
              当前赛季：{currentSeason?.title ?? "S1 · 黑曜苏醒"} · 共{" "}
              {state.seasonNotices.length} 份昭告
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={onClose}>
            关闭公告
          </button>
        </div>

        <div className="tab-body split-2col">
          <div className="subpanel">
            <div className="subpanel-head">
              <h3>
                <Scale size={ICON.sm} />
                <span>帝国官方公告与赛季物价动向</span>
              </h3>
            </div>
            <div className="notice-stack">
              {state.seasonNotices.map((sn) => (
                <article key={sn.seasonId} className="season-notice-card">
                  <div className="bp-top">
                    <strong>{sn.title}</strong>
                    <span className="tag-badge tag-warning">
                      {sn.effectiveIn}
                    </span>
                  </div>
                  <p>{sn.summary}</p>
                  {sn.demandShifts.length > 0 && (
                    <ul>
                      {sn.demandShifts.map((ds) => (
                        <li key={ds}>{ds}</li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          </div>

          <div className="subpanel">
            <div className="subpanel-head">
              <h3>
                <Award size={ICON.sm} />
                <span>跨季契约与帝国央行账本</span>
              </h3>
            </div>

            {currentSeason && (
              <article className="season-notice-card">
                <div className="bp-top">
                  <strong>跨赛季继承与重置规则</strong>
                  <span className="tag-badge tag-success">永久契约</span>
                </div>
                <p>{currentSeason.subtitle}</p>
                <ul>
                  {currentSeason.retentionRules.map((r) => (
                    <li key={r}>✓ 永久保留：{r}</li>
                  ))}
                  {currentSeason.resetRules.map((r) => (
                    <li key={r}>↻ 赛季重置：{r}</li>
                  ))}
                </ul>
              </article>
            )}

            <div className="ledger-audit-box mono-num">
              <div className="ledger-row">
                <span>央行总发行 (M_issued)</span>
                <strong>{formatGold(macroLedger.totalIssuedBasis)} G</strong>
              </div>
              <div className="ledger-row">
                <span>玩家流通 + 挂单托管</span>
                <span>
                  {formatGold(
                    macroLedger.playerHeldBasis + macroLedger.escrowFrozenBasis,
                  )}{" "}
                  G
                </span>
              </div>
              <div className="ledger-row">
                <span>财政账户</span>
                <span>
                  {formatGold(
                    macroLedger.npcHeldBasis + macroLedger.treasuryHeldBasis,
                  )}{" "}
                  G
                </span>
              </div>
              <div className="ledger-row"><span>联盟准备金 + 公共采购</span><span>{formatGold(state.economy.reserveBasis + state.economy.publicCashBasis)} G</span></div>
              <div className="ledger-row"><span>公司 + IPO 托管</span><span>{formatGold(state.economy.corporateCashBasis + state.economy.ipoEscrowBasis)} G</span></div>
              <div className="ledger-row">
                <span>累计政策注销</span>
                <span>{formatGold(macroLedger.permanentlyBurnedBasis)} G</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Settings, Civilization Chapter Guide & Chronicle Modal (收敛到设置中的主题切换、退出、当前章节剪影与聚落编年纪事)
 */
export function SettingsChronicleModal({
  state,
  theme,
  storyChapter,
  civEra,
  onToggleTheme,
  onLogout,
  onClose,
}: {
  state: DashboardStateResp;
  theme: ThemeMode;
  storyChapter: { key: string; tag: string; text: string };
  civEra: "stone" | "colony" | "workshop" | "empire";
  onToggleTheme: () => void;
  onLogout: () => void;
  onClose: () => void;
}) {
  const { player, currentSeason } = state;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="设置与聚落纪事"
    >
      <div className="modal-sheet">
        <div className="modal-header">
          <div>
            <h2>系统设置 · 文明演进与聚落编年纪事</h2>
            <p>
              领主账号：{player.handle}（{player.professionName}） · 当前赛季：
              {currentSeason?.title ?? "S1 · 黑曜苏醒"}
            </p>
          </div>
          <div className="toolbar-actions">
            <button
              type="button"
              className="btn-outline"
              data-pop={theme === "light" ? "曜石夜间" : "纸墨日间"}
              onClick={onToggleTheme}
            >
              {theme === "light" ? (
                <Moon size={ICON.xs} />
              ) : (
                <Sun size={ICON.xs} />
              )}
              <span>{theme === "light" ? "切换曜石夜间" : "切换纸墨日间"}</span>
            </button>
            <button type="button" className="btn-outline" onClick={onLogout}>
              <LogOut size={ICON.xs} />
              <span>退出登录</span>
            </button>
            <button type="button" className="btn-primary" onClick={onClose}>
              关闭
            </button>
          </div>
        </div>

        <div className="tab-body split-2col">
          {/* Left Column: Current Civilization Chapter Silhouette & Preferences */}
          <div className="subpanel">
            <div className="subpanel-head">
              <h3>
                <Compass size={ICON.sm} />
                <span>当前文明演进章节（{storyChapter.tag}）</span>
              </h3>
            </div>

            <div className="civ-popup-silhouette-wrap">
              <CivilizationSilhouetteSVG era={civEra} />
            </div>

            <article className="season-notice-card">
              <div className="bp-top">
                <strong>{storyChapter.tag}</strong>
                <span className="tag-badge tag-warning">当前章节</span>
              </div>
              <p>{storyChapter.text}</p>
            </article>

            <div className="ledger-audit-box">
              <div className="ledger-row">
                <span>界面主题模式</span>
                <strong>
                  {theme === "light"
                    ? "纸墨日间 (Blueprint Light)"
                    : "曜石夜间 (Obsidian Dark)"}
                </strong>
              </div>
              <div className="ledger-row mono-num">
                <span>累计手动打水次数</span>
                <strong>{player.totalManualClicks} 次</strong>
              </div>
              <div className="ledger-row mono-num">
                <span>操作快捷键</span>
                <span>[M] 世界舆图 · [B/Tab] 局内背囊 · [WASD] 移动</span>
              </div>
            </div>
          </div>

          {/* Right Column: Settlement & Empire Chronicle */}
          <div className="subpanel">
            <div className="subpanel-head">
              <h3>聚落编年纪事 ({state.eventLogs.length})</h3>
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
      </div>
    </div>
  );
}

/**
 * World Map Compass Modal (右下角【世界舆图】点击展开的帝国疆域导航图)
 */
export function WorldMapCompassModal({
  state,
  activeScene,
  showScoutScene,
  showAdvancedWorld,
  showLordScene,
  onSelectZone,
  onClose,
}: {
  state: DashboardStateResp;
  activeScene: WorldZoneKey;
  showScoutScene: boolean;
  showAdvancedWorld: boolean;
  showLordScene: boolean;
  onSelectZone: (zone: WorldZoneKey) => void;
  onClose: () => void;
}) {
  const zones: Array<{
    key: WorldZoneKey;
    title: string;
    subtitle: string;
    coord: string;
    unlocked: boolean;
    lockHint: string;
    badge: string;
  }> = [
    {
      key: "settlement",
      title: "领主主城 · 聚落与个人档案",
      subtitle:
        "完整个人视角：领主披挂形象衣橱、汲水与资源总账、居民调配、技术研究与设施建设。",
      coord: "N 00° · E 00° (中央主城)",
      unlocked: true,
      lockHint: "",
      badge: `人口 ${state.player.populationTotal}`,
    },
    {
      key: "scout",
      title: "荒原裂隙斥候营",
      subtitle:
        "三幕式探索撤离：行前整备与保险箱 → 敕令增益卡抽取 → 全屏裂隙搜打撤与局内游商营帐。",
      coord: "N 18° · W 42° (西北裂隙)",
      unlocked: showScoutScene,
      lockHint: "需研究烧炭技术并建造【荒原斥候营】",
      badge: showScoutScene ? "可出征" : "未解锁",
    },
    {
      key: "market",
      title: "皇家工坊与全球交易所",
      subtitle:
        "建造职业设施，制造和使用耗材；参与现货交易、公司 IPO 与股东决策。",
      coord: "S 12° · E 28° (东南商埠)",
      unlocked: showAdvancedWorld,
      lockHint: "需开启【神秘的宝藏】并择定终身职业后开放",
      badge: `${state.openOrders.length} 笔挂单`,
    },
    {
      key: "war",
      title: "公会驻地与八城战区",
      subtitle:
        "创立或加入全服公会、捐献军需集结目标，并在八城战略沙盘上派兵参与每晚 20:00 城池会战。",
      coord: "N 34° · E 36° (东北前线)",
      unlocked: showAdvancedWorld,
      lockHint: "需开启【神秘的宝藏】并择定终身职业后开放",
      badge: `战役日 D${state.war.currentDay}/7`,
    },
    {
      key: "lord",
      title: "墨械唯一秘宝陈列馆",
      subtitle:
        "消耗战争活动积分兑换并开启赛季典藏宝箱，铸造全服唯一编号与传世墨金纹样的永久秘宝。",
      coord: "S 24° · W 19° (西南秘苑)",
      unlocked: showLordScene,
      lockHint: "需解锁荒原斥候营或获得首件藏品后开放",
      badge: `藏品 ${state.collectibles.length} 件`,
    },
  ];

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="世界舆图导航"
    >
      <div className="modal-sheet world-map-modal-sheet">
        <div className="modal-header">
          <div>
            <h2>帝国疆域世界舆图 · 场景前往</h2>
            <p>
              选择舆图上的疆域据点即可立即前往对应功能区（快捷键：M）
            </p>
          </div>
          <button type="button" className="btn-outline" onClick={onClose}>
            收起舆图
          </button>
        </div>

        {/* Interactive Blueprint & Ink World Map SVG */}
        <div className="world-map-svg-wrap">
          <svg
            viewBox="0 0 760 220"
            className="world-map-svg"
            role="img"
            aria-label="帝国疆域蓝图航线"
          >
            <defs>
              <pattern
                id="wm-grid"
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 24 0 L 0 0 0 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.6"
                  opacity="0.14"
                />
              </pattern>
            </defs>
            <rect width="760" height="220" fill="url(#wm-grid)" />
            {/* Topographic Contours & Imperial River */}
            <path
              d="M 0 148 Q 180 120 340 150 T 760 95"
              fill="none"
              stroke="#4AA3DF"
              strokeWidth="3.5"
              opacity="0.22"
            />
            <path
              d="M 0 148 Q 180 120 340 150 T 760 95"
              fill="none"
              stroke="#4AA3DF"
              strokeWidth="1"
              strokeDasharray="6 4"
              opacity="0.55"
            />
            <path
              d="M 40 34 Q 145 14 250 42 M 480 28 Q 590 12 700 44 M 70 196 Q 190 175 290 202"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.22"
            />
            {/* Compass rose */}
            <g transform="translate(704, 46)" opacity="0.65">
              <circle
                r="26"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="3 2"
              />
              <circle
                r="18"
                fill="none"
                stroke="#C89B3C"
                strokeWidth="0.8"
                opacity="0.6"
              />
              <polygon points="0,-24 5,-5 0,-10 -5,-5" fill="#C89B3C" />
              <polygon
                points="0,24 4,5 0,10 -4,5"
                fill="currentColor"
                opacity="0.45"
              />
              <line
                x1="-22"
                y1="0"
                x2="22"
                y2="0"
                stroke="currentColor"
                strokeWidth="1"
              />
            </g>
            {/* Route lines from Central Citadel (380, 112) */}
            <g
              stroke="#C89B3C"
              strokeWidth="1.8"
              strokeDasharray="5 4"
              opacity="0.8"
            >
              {showScoutScene && <line x1="380" y1="112" x2="145" y2="56" />}
              {showAdvancedWorld && <line x1="380" y1="112" x2="595" y2="56" />}
              {showLordScene && <line x1="380" y1="112" x2="165" y2="172" />}
              {showAdvancedWorld && <line x1="380" y1="112" x2="585" y2="170" />}
            </g>
            {/* Node 1: Scout Camp (NW) */}
            {showScoutScene && <g
              transform="translate(145, 56)"
              style={{ cursor: showScoutScene ? "pointer" : "not-allowed" }}
              onClick={() => {
                if (showScoutScene) {
                  onSelectZone("scout");
                  onClose();
                }
              }}
            >
              <circle
                r="22"
                fill={activeScene === "scout" ? "#C89B3C" : "#162436"}
                stroke="#C89B3C"
                strokeWidth="2"
              />
              <polygon
                points="0,-10 10,8 -10,8"
                fill={activeScene === "scout" ? "#162436" : "#F3EFE6"}
              />
              <text
                y="36"
                textAnchor="middle"
                fill="currentColor"
                fontSize="12"
                fontWeight="700"
              >
                荒原斥候营
              </text>
            </g>}
            {/* Node 2: Guild & War Zone (NE) */}
            {showAdvancedWorld && <g
              transform="translate(595, 56)"
              style={{ cursor: showAdvancedWorld ? "pointer" : "not-allowed" }}
              onClick={() => {
                if (showAdvancedWorld) {
                  onSelectZone("war");
                  onClose();
                }
              }}
            >
              <circle
                r="22"
                fill={activeScene === "war" ? "#C89B3C" : "#162436"}
                stroke="#C89B3C"
                strokeWidth="2"
              />
              <path
                d="M-8,-8 L-8,8 L8,8 L8,-8 L4,-3 L0,-9 L-4,-3 Z"
                fill={activeScene === "war" ? "#162436" : "#F3EFE6"}
              />
              <text
                y="36"
                textAnchor="middle"
                fill="currentColor"
                fontSize="12"
                fontWeight="700"
              >
                公会与战区
              </text>
            </g>}
            {/* Node 3: Central Settlement & Personal Profile (Center) */}
            <g
              transform="translate(380, 112)"
              style={{ cursor: "pointer" }}
              onClick={() => {
                onSelectZone("settlement");
                onClose();
              }}
            >
              <circle
                r="32"
                fill="none"
                stroke="#C89B3C"
                strokeWidth="1.2"
                strokeDasharray="4 2"
              />
              <circle
                r="26"
                fill={activeScene === "settlement" ? "#C89B3C" : "#1D4E89"}
                stroke="#F3EFE6"
                strokeWidth="2.5"
              />
              <polygon
                points="0,-13 11,-2 7,-2 7,10 -7,10 -7,-2 -11,-2"
                fill="#F3EFE6"
              />
              <text
                y="45"
                textAnchor="middle"
                fill="currentColor"
                fontSize="13"
                fontWeight="700"
              >
                ★ 领主主城 (个人与生产)
              </text>
            </g>
            {/* Node 4: Relic Vault (SW) */}
            {showLordScene && <g
              transform="translate(165, 172)"
              style={{ cursor: showLordScene ? "pointer" : "not-allowed" }}
              onClick={() => {
                if (showLordScene) {
                  onSelectZone("lord");
                  onClose();
                }
              }}
            >
              <circle
                r="20"
                fill={activeScene === "lord" ? "#C89B3C" : "#162436"}
                stroke="#C89B3C"
                strokeWidth="2"
              />
              <polygon
                points="0,-10 9,0 0,10 -9,0"
                fill={activeScene === "lord" ? "#162436" : "#F3EFE6"}
              />
              <text
                y="34"
                textAnchor="middle"
                fill="currentColor"
                fontSize="12"
                fontWeight="700"
              >
                墨械秘宝馆
              </text>
            </g>}
            {/* Node 5: Workshop & Spot Market (SE) */}
            {showAdvancedWorld && <g
              transform="translate(585, 170)"
              style={{ cursor: showAdvancedWorld ? "pointer" : "not-allowed" }}
              onClick={() => {
                if (showAdvancedWorld) {
                  onSelectZone("market");
                  onClose();
                }
              }}
            >
              <circle
                r="22"
                fill={activeScene === "market" ? "#C89B3C" : "#162436"}
                stroke="#C89B3C"
                strokeWidth="2"
              />
              <circle
                r="7"
                fill={activeScene === "market" ? "#162436" : "#F3EFE6"}
              />
              <text
                y="36"
                textAnchor="middle"
                fill="currentColor"
                fontSize="12"
                fontWeight="700"
              >
                工坊与交易所
              </text>
            </g>}
          </svg>
        </div>

        <div className="world-map-zone-grid">
          {zones.filter((z) => z.unlocked).map((z) => {
            const isCurrent = activeScene === z.key;
            const isCitadel = z.key === "settlement";
            return (
              <article
                key={z.key}
                className={`world-map-zone-card ${isCitadel ? "world-map-zone-card-citadel" : ""} ${isCurrent ? "zone-active" : ""} ${!z.unlocked ? "zone-locked" : ""}`}
              >
                <div className="bp-top">
                  <div>
                    <strong>{z.title}</strong>
                    <span className="bp-pop-req mono-num">{z.coord}</span>
                  </div>
                  <span
                    className={`tag-badge mono-num ${isCurrent ? "tag-warning" : z.unlocked ? "tag-success" : ""}`}
                  >
                    {isCurrent ? "当前驻留" : z.unlocked ? z.badge : "未解锁"}
                  </span>
                </div>
                <p className="bp-desc">
                  {z.unlocked ? z.subtitle : `🔒 ${z.lockHint}`}
                </p>
                <div className="bp-footer">
                  <span className="cost-chip mono-num">{z.badge}</span>
                  <button
                    type="button"
                    className={isCurrent ? "btn-outline btn-sm" : "btn-primary btn-sm"}
                    data-pop={`前往 ${z.title.split(" ")[0]}`}
                    disabled={!z.unlocked}
                    onClick={() => {
                      onSelectZone(z.key);
                      onClose();
                    }}
                  >
                    <Compass size={ICON.xs} />
                    <span>{isCurrent ? "继续驻留" : "立即前往"}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
