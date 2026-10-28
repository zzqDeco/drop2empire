import {
  api,
  type DashboardStateResp,
  type RaidGearSpecDTO,
} from "@drop2empire/api-client";
import { Compass, Layers, RefreshCw, Shield, Sparkles, Swords } from "lucide-react";
import { ICON } from "../../icons";
import { formatResource } from "../../format";
import { LordAvatarSVG } from "../../LordAvatarSVG";
import { BlueprintEtchedCard, RaidItemIconSVG } from "../../RaidSpritesSVG";
import type { ServerUpdate } from "../../serverState";
import type { useRaidController } from "../../hooks/useRaidController";

interface RaidArmoryDraftViewProps {
  state: DashboardStateResp;
  ctrl: ReturnType<typeof useRaidController>;
  runAction: (fn: () => Promise<ServerUpdate>, msg?: string) => Promise<void>;
}

export function RaidArmoryDraftView({
  state,
  ctrl,
  runAction,
}: RaidArmoryDraftViewProps) {
  const { raidLoadout, raidGears, equippedCosmetics } = state;
  const {
    preStage,
    setPreStage,
    armoryFacing,
    setArmoryFacing,
    gearTab,
    setGearTab,
    replaceSlotIdx,
    setReplaceSlotIdx,
  } = ctrl;

  // ACT 2: DEDICATED 3D ANIMATED BUFF CARD DRAFT STAGE (敕令刻印抽卡台)
  if (preStage === "draft") {
    const equippedFull = raidLoadout.equippedBuffCards.length >= 4;

    return (
      <section
        className="lower-workspace scene-workspace-offset"
        aria-label="行前增益卡三维刻印抽卡舞台"
      >
        <div className="tabs-header">
          <div className="panel-title">
            <Sparkles size={ICON.sm} />
            <h2>
              第二阶段：荒原敕令刻印台（54 种蚀刻增益卡 · 每次三选一 · 限带 4 槽）
            </h2>
          </div>
          <div className="toolbar-actions">
            <button
              type="button"
              className="btn-outline"
              onClick={() => setPreStage("armory")}
            >
              ← 返回第一阶段：军械整备
            </button>
            <button
              type="button"
              className="btn-water-strike"
              data-pop="⚡ 踏入荒原"
              onClick={() => void runAction(() => api.startRaid())}
            >
              <Compass size={ICON.sm} />
              <span>⚡ 踏入荒原裂隙（全屏战场）</span>
            </button>
          </div>
        </div>

        <div className="tab-body">
          {/* Top Bar: 4 Equipped Tactical Buff Card Slots */}
          <div className="recruit-card">
            <div className="recruit-meta">
              <div className="recruit-head">
                <strong>
                  已刻印随行敕令槽 ({raidLoadout.equippedBuffCards.length} / 4)
                </strong>
                <span className="tag-badge mono-num">
                  生命 {raidLoadout.totalMaxHp} · 攻击 {raidLoadout.totalAtk} ·
                  护甲 {raidLoadout.totalDef} · 步频 {raidLoadout.moveCooldownMs}
                  ms · 时限 {raidLoadout.raidDurationSeconds}s · 背囊{" "}
                  {raidLoadout.backpackCapacity}格
                </span>
              </div>
              <div className="preset-chips">
                {[0, 1, 2, 3].map((slotIdx) => {
                  const card = raidLoadout.equippedBuffCards[slotIdx];
                  return card ? (
                    <button
                      key={`${card.cardCode}_${slotIdx}`}
                      type="button"
                      className={`btn-chip ${replaceSlotIdx === slotIdx ? "active" : ""}`}
                      data-pop="移除敕令"
                      onClick={() => {
                        setReplaceSlotIdx(slotIdx);
                        void runAction(() =>
                          api.draftRaidBuff({
                            action: "remove",
                            replaceSlot: slotIdx,
                          }),
                        );
                      }}
                    >
                      [{slotIdx + 1}] {card.name} ({card.effectSummary}) ×
                    </button>
                  ) : (
                    <span key={slotIdx} className="cost-chip mono-num">
                      敕令槽 {slotIdx + 1}：空置待刻印
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="toolbar-actions">
              <div className="bp-costs">
                {raidLoadout.rerollCosts.map((c) => (
                  <span
                    key={c.resourceKey}
                    className={`cost-chip mono-num ${
                      c.currentMilli >= c.requiredMilli
                        ? "cost-ok"
                        : "cost-lack"
                    }`}
                  >
                    {c.resourceName} {formatResource(c.currentMilli, 0)}/
                    {formatResource(c.requiredMilli, 0)}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="btn-outline"
                data-pop="↻ 重新洗牌"
                disabled={!raidLoadout.canReroll}
                onClick={() =>
                  void runAction(() => api.draftRaidBuff({ action: "reroll" }))
                }
              >
                <RefreshCw size={ICON.xs} />
                <span>换一批候选卡</span>
              </button>
            </div>
          </div>

          {/* 3D Spring-Physics Etched Buff Cards Stage */}
          <div className="etched-card-stage">
            {raidLoadout.draftPoolCards.map((card, idx) => (
              <BlueprintEtchedCard
                key={card.cardCode}
                card={card}
                index={idx}
                replaceSlotIdx={replaceSlotIdx}
                equippedFull={equippedFull}
                onSelectCard={(cardCode) =>
                  void runAction(() =>
                    api.draftRaidBuff({
                      action: "buy",
                      cardCode,
                      replaceSlot: replaceSlotIdx,
                    }),
                  )
                }
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // ACT 1: PRE-RAID ARMORY & LOADOUT STAGE (第一阶段：斥候军械整备厅)
  const filteredGears = raidGears.filter(
    (g) => gearTab === "all" || g.category === gearTab,
  );

  return (
    <section
      className="lower-workspace scene-workspace-offset"
      aria-label="第一阶段：斥候军械整备厅"
    >
      <div className="tabs-header">
        <div className="panel-title">
          <Swords size={ICON.sm} />
          <h2>第一阶段：荒原斥候军械整备厅（穿戴装备 · 赛季保险箱 · 战术药水）</h2>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setPreStage("draft")}
        >
          <Sparkles size={ICON.xs} />
          <span>下一步：进入敕令抽卡台 ➔</span>
        </button>
      </div>

      <div className="tab-body split-2col">
        {/* Left Subpanel: Lord Character Stage & Equipped Slots */}
        <div className="subpanel">
          <div className="subpanel-head">
            <h3>
              <Shield size={ICON.sm} />
              <span>领主武装披挂预览（点击可四向旋转检视）</span>
            </h3>
          </div>

          <div className="raid-center-avatar-stage">
            <LordAvatarSVG
              cosmetics={equippedCosmetics}
              weaponKey={raidLoadout.weaponKey}
              armorKey={raidLoadout.armorKey}
              bootsKey={raidLoadout.bootsKey}
              size="stage"
              facing={armoryFacing}
            />
            <div className="quick-alloc-bar">
              {(
                [
                  ["down", "正面视角"],
                  ["right", "右侧视角"],
                  ["up", "背面披风"],
                  ["left", "左侧视角"],
                ] as const
              ).map(([dir, label]) => (
                <button
                  key={dir}
                  type="button"
                  className={`btn-chip ${armoryFacing === dir ? "active" : ""}`}
                  onClick={() => setArmoryFacing(dir)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="ledger-audit-box mono-num">
            <div className="ledger-row">
              <span>总生命上限 / 护甲减伤</span>
              <strong>
                {raidLoadout.totalMaxHp} HP / {raidLoadout.totalDef} DEF
              </strong>
            </div>
            <div className="ledger-row">
              <span>近战与远程火力</span>
              <strong>{raidLoadout.totalAtk} ATK</strong>
            </div>
            <div className="ledger-row">
              <span>荒原行军步频间隔</span>
              <strong>{raidLoadout.moveCooldownMs} ms/格</strong>
            </div>
            <div className="ledger-row">
              <span>本季安全箱 / 随身背囊容量</span>
              <strong>
                {raidLoadout.safeSlotCount} 格 (绝不掉落) /{" "}
                {raidLoadout.backpackCapacity} 格
              </strong>
            </div>
          </div>
        </div>

        {/* Right Subpanel: Craft & Equip Weapons, Armors, Boots, Safe Containers & Potions */}
        <div className="subpanel">
          <div className="subpanel-head">
            <h3>
              <Layers size={ICON.sm} />
              <span>军械打造与蓝图研读（高阶装备需消耗局内摸出的一次性蓝图）</span>
            </h3>
          </div>

          <div className="quick-alloc-bar">
            {(
              [
                ["all", "全部军械"],
                ["weapon", "武器"],
                ["armor", "护甲"],
                ["boots", "战靴(移速)"],
                ["safe_box", "本季安全箱"],
                ["potion", "局内药水"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                className={`btn-chip ${gearTab === k ? "active" : ""}`}
                onClick={() => setGearTab(k)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="blueprint-list">
            {filteredGears.map((g: RaidGearSpecDTO) => (
              <article
                key={g.itemKey}
                className={`bp-card ${g.equipped ? "bp-ready" : ""}`}
              >
                <div className="bp-top">
                  <div className="raid-inline-item-row">
                    <RaidItemIconSVG itemKey={g.itemKey} size={ICON.xl} />
                    <div>
                      <strong>
                        [T{g.tier}] {g.name}
                      </strong>
                      <span className="tag-badge mono-num">
                        库存 {g.ownedCount}
                      </span>
                      {g.equipped && (
                        <span className="tag-badge tag-success">已穿戴</span>
                      )}
                    </div>
                  </div>
                  {!g.recipeUnlocked && (
                    <span className="tag-badge tag-warning">
                      需一次性蓝图：{g.blueprintName} (持有 {g.blueprintOwnedCount})
                    </span>
                  )}
                </div>
                <p className="bp-desc">{g.statSummary}</p>
                <div className="bp-footer">
                  <div className="bp-costs">
                    {g.costs.map((c) => {
                      const ok = c.currentMilli >= c.requiredMilli;
                      return (
                        <span
                          key={c.resourceKey}
                          className={`cost-chip mono-num ${ok ? "cost-ok" : "cost-lack"}`}
                        >
                          {c.resourceName} {formatResource(c.currentMilli, 0)}/
                          {formatResource(c.requiredMilli, 0)}
                        </span>
                      );
                    })}
                  </div>
                  <div className="quick-alloc-bar">
                    {!g.recipeUnlocked && g.blueprintOwnedCount > 0 && (
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        data-pop="✓ 研读蓝图"
                        onClick={() =>
                          void runAction(() =>
                            api.learnRaidBlueprint({
                              blueprintKey: g.blueprintKey,
                            }),
                          )
                        }
                      >
                        研读蓝图 (销毁并解锁本季打造)
                      </button>
                    )}

                    {g.recipeUnlocked && (
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        data-pop={`+1 ${g.name}`}
                        disabled={!g.canCraft}
                        onClick={() =>
                          void runAction(() =>
                            api.manageRaidGear({
                              action: "craft",
                              itemKey: g.itemKey,
                            }),
                          )
                        }
                      >
                        {g.category === "safe_box" && g.ownedCount > 0
                          ? "本季已生效"
                          : "打造"}
                      </button>
                    )}

                    {g.ownedCount > 0 && g.category !== "safe_box" && (
                      <button
                        type="button"
                        className="btn-outline btn-sm"
                        data-pop={g.equipped ? "卸下装备" : `✦ 装备 ${g.name}`}
                        onClick={() =>
                          void runAction(() =>
                            api.manageRaidGear({
                              action: g.equipped ? "unequip" : "equip",
                              itemKey: g.itemKey,
                            }),
                          )
                        }
                      >
                        {g.equipped ? "卸下" : "穿戴"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
