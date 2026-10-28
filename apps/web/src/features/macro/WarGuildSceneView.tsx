import { useState } from "react";
import { api } from "@drop2empire/api-client";
import { Award, Compass, Plus, Shield, Swords } from "lucide-react";
import { ICON } from "../../icons";
import { formatGold, formatResource } from "../../format";
import { WarGraphMapSVG } from "../../WarGraphMapSVG";
import type { SceneProps } from "./types";

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
      {/* Upper Section: Guild Hall */}
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
