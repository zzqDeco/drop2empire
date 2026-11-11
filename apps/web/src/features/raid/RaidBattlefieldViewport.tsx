import { useState } from "react";
import {
  api,
  type DashboardStateResp,
  type RaidLootItemDTO,
} from "@drop2empire/api-client";
import { Box, Compass, FlaskConical, Shield, Sparkles, Swords } from "lucide-react";
import { ICON } from "../../icons";
import { formatGold, formatResource } from "../../format";
import { LordAvatarSVG } from "../../LordAvatarSVG";
import {
  RaidItemIconSVG,
  RaidTileSpriteSVG,
  type RaidTileSpriteKind,
} from "../../RaidSpritesSVG";
import { ConfirmActionModal, ModalShell } from "../../components/ModalShell";
import { EARLY_EXTRACT_CUTOFF_MS } from "../../config/gameConfig";
import { computeRaidCombatPreview } from "../../domain/settlementSelectors";
import type { ServerUpdate } from "../../serverState";
import type { useRaidController } from "../../hooks/useRaidController";

type RaidZoneDTO = NonNullable<
  DashboardStateResp["raidLoadout"]["activeSession"]
>["zones"][number];

interface RaidBattlefieldViewportProps {
  state: DashboardStateResp;
  currentZone: RaidZoneDTO;
  ctrl: ReturnType<typeof useRaidController>;
  runAction: (
    fn: () => Promise<ServerUpdate>,
    msg?: string,
    scope?: string,
  ) => Promise<void>;
}

export function RaidBattlefieldViewport({
  state,
  currentZone,
  ctrl,
  runAction,
}: RaidBattlefieldViewportProps) {
  const [confirmAbandonOpen, setConfirmAbandonOpen] = useState(false);

  const {
    raidLoadout,
    raidGears = [],
    cosmetics = [],
    marketSummaries = [],
    equippedCosmetics,
  } = state;
  const {
    curZoneId,
    pos,
    facing,
    setFacing,
    timeLeftMs,
    galeLeftMs,
    scavLeftMs,
    cheatDeathActive,
    hp,
    maxHp,
    atk,
    def,
    effectiveMoveCooldownMs,
    safeBox,
    backpack,
    showLootModal,
    setShowLootModal,
    channeling,
    zones,
    currentTile,
    raidLog,
    activeContainerTitle,
    activeChestDrops,
    draggedItem,
    setDraggedItem,
    usedPotions,
    handleStep,
    handleUsePortal,
    handleDrinkPotion,
    transferItem,
    lootAllFromChest,
    handleMerchantBuy,
    startExtractionChannel,
    triggerFinishRaid,
    sendRaidAction,
  } = ctrl;

  const earlyExtractOpen = timeLeftMs >= EARLY_EXTRACT_CUTOFF_MS;
  const canExtractHere =
    currentTile?.kind === "extract_deep" ||
    (currentTile?.kind === "extract_early" && earlyExtractOpen);

  const carriedPotionKeys = Array.from(
    new Set([...(raidLoadout.equippedPotions ?? []), ...usedPotions]),
  );

  const equippedDestroyableNames = [
    raidLoadout.weaponKey,
    raidLoadout.armorKey,
    raidLoadout.bootsKey,
  ]
    .filter(Boolean)
    .map((key) => raidGears.find((g) => g.itemKey === key)?.name ?? key);

  const describeLootMeta = (item: RaidLootItemDTO) => {
    const market = marketSummaries.find((m) => m.itemKey === item.key);
    const refPriceBasis = market
      ? market.bestBidBasis > 0
        ? market.bestBidBasis
        : market.lastPriceBasis
      : 0;
    const priceTag =
      refPriceBasis > 0 ? `~${formatGold(refPriceBasis)} G` : null;

    let collectionTag: { text: string; highlight: boolean } | null = null;
    if (item.key.startsWith("bp_")) {
      const gear = raidGears.find((g) => g.blueprintKey === item.key);
      if (gear) {
        collectionTag = gear.recipeUnlocked
          ? { text: "已掌握·可售", highlight: false }
          : { text: "未解锁配方", highlight: true };
      }
    } else if (item.key.startsWith("cos_")) {
      const cos = cosmetics.find((c) => c.itemKey === item.key);
      if (cos) {
        collectionTag =
          cos.ownedCount > 0 || cos.equipped
            ? { text: "已典藏·可售", highlight: false }
            : { text: "新限定外观", highlight: true };
      }
    }
    return { priceTag, collectionTag };
  };

  return (
    <div className="raid-fullscreen-viewport" aria-label="荒原全屏2D搜打撤战场">
      {/* Top Full-Screen Tactical HUD */}
      <header className="raid-fullscreen-hud">
        <div className="panel-title">
          <Compass size={ICON.md} />
          <div>
            <h2>
              {currentZone.name} · 区块 {curZoneId + 1}/4
            </h2>
            <small className="mono-num">
              坐标 ({pos.x}, {pos.y}) · 朝向 {facing.toUpperCase()} · WASD
              移动 / [B] 展开背囊
            </small>
          </div>
        </div>

        <div className="telemetry-strip">
          <div className="metric-cell">
            <span className="metric-label">沙暴倒计时</span>
            <span className="metric-value mono-num">
              {(timeLeftMs / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="metric-cell">
            <span className="metric-label">生命值</span>
            <span className="metric-value mono-num">
              {hp} / {maxHp}
            </span>
          </div>
          <div className="metric-cell">
            <span className="metric-label">攻 / 甲 / 步频</span>
            <span className="metric-value mono-num">
              {atk} / {def} / {effectiveMoveCooldownMs}ms
            </span>
          </div>
          <div className="metric-cell">
            <span className="metric-label">安全箱 / 背囊</span>
            <span className="metric-value mono-num">
              {safeBox.length}/{raidLoadout.safeSlotCount} · {backpack.length}/
              {raidLoadout.backpackCapacity}
            </span>
          </div>
        </div>

        {(galeLeftMs > 0 || scavLeftMs > 0 || cheatDeathActive) && (
          <div className="batch-pill-group" aria-label="激活药水状态">
            {galeLeftMs > 0 && (
              <span className="tag-badge tag-success mono-num">
                疾行 {(galeLeftMs / 1000).toFixed(1)}s
              </span>
            )}
            {scavLeftMs > 0 && (
              <span className="tag-badge tag-warning mono-num">
                速搜 {(scavLeftMs / 1000).toFixed(1)}s
              </span>
            )}
            {cheatDeathActive && (
              <span className="tag-badge tag-warning">免死护盾激活</span>
            )}
          </div>
        )}

        <div className="toolbar-actions">
          <button
            type="button"
            className={`btn-primary ${showLootModal ? "active" : ""}`}
            onClick={() => setShowLootModal((v) => !v)}
          >
            <Box size={ICON.xs} />
            <span className="mono-num">
              {showLootModal ? "收起背囊 (B)" : "展开背囊与整备 (B)"}
            </span>
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() => setConfirmAbandonOpen(true)}
          >
            放弃撤离 (仅保安全箱)
          </button>
        </div>
      </header>

      {/* Channeling Bar when opening a chest or calling extraction */}
      {channeling && (
        <div className="status-banner status-info" role="status">
          <span className="mono-num">
            {channeling.label}... ({channeling.progressPct}%)
          </span>
          <div className="opening-progress-bar">
            <div
              className="opening-progress-fill"
              ref={(el) => {
                if (el) {
                  el.style.setProperty(
                    "--progress-pct",
                    `${channeling.progressPct}%`,
                  );
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Main Full-Screen 2D Map Stage + Live Tactical Minimap Radar */}
      <div className="raid-fullscreen-stage">
        <div className="raid-battlefield-layout">
          <div className="raid-map-board-wrap">
            <div
              className="raid-map-grid"
              ref={(el) => {
                if (el) {
                  el.style.setProperty(
                    "--zone-cols",
                    String(currentZone.width),
                  );
                  el.style.setProperty(
                    "--zone-rows",
                    String(currentZone.height),
                  );
                }
              }}
            >
              {currentZone.tiles.map((tile) => {
                const isPlayer = tile.x === pos.x && tile.y === pos.y;
                const isAdjacent =
                  Math.abs(tile.x - pos.x) + Math.abs(tile.y - pos.y) === 1;
                const isExplored = tile.explored && tile.kind !== "fog";
                const isAliveEnemy =
                  isExplored &&
                  !tile.looted &&
                  (tile.kind === "enemy_raider" ||
                    tile.kind === "enemy_worm" ||
                    tile.kind === "enemy_boss");
                const combatPreview = isAliveEnemy
                  ? computeRaidCombatPreview(
                      tile.enemyHp,
                      tile.enemyAtk,
                      atk,
                      def,
                      hp,
                      cheatDeathActive,
                    )
                  : null;

                let tileTitle = "荒原空地";
                let tileBadge = "";
                if (!isExplored) tileTitle = "未探明战争迷雾";
                else if (tile.kind === "wall")
                  tileTitle = "断崖岩壁（不可通行）";
                else if (tile.kind === "spawn") {
                  tileTitle = "裂隙起点";
                  tileBadge = "起点";
                } else if (tile.kind === "portal") {
                  tileTitle = tile.portalLabel || "区块星盘传送门";
                  tileBadge = "星门";
                } else if (tile.kind === "extract_early") {
                  tileTitle = earlyExtractOpen
                    ? "外围限时撤离信标（踩上自动引导撤离）"
                    : "外围限时撤离信标（已关闭）";
                  tileBadge = earlyExtractOpen ? "撤离" : "关闭";
                } else if (tile.kind === "extract_deep") {
                  tileTitle = "深处常驻撤离信标（踩上自动引导撤离）";
                  tileBadge = "撤离";
                } else if (tile.kind === "merchant") {
                  tileTitle = "荒原游商营帐（踩上开启易物）";
                  tileBadge = "游商";
                } else if (tile.kind === "oasis") {
                  tileTitle = "甘泉绿洲";
                  tileBadge = tile.looted ? "" : "绿洲";
                } else if (tile.kind === "chest_wood") {
                  tileTitle = "破旧木箱 (1.1s)";
                  tileBadge = tile.looted ? "" : "木箱";
                } else if (tile.kind === "chest_iron") {
                  tileTitle = "铁皮军需箱 (2.2s)";
                  tileBadge = tile.looted ? "" : "军需";
                } else if (tile.kind === "chest_coffin") {
                  tileTitle = "远古机关石棺 (3.6s)";
                  tileBadge = tile.looted ? "" : "石棺";
                } else if (tile.kind === "chest_abyss") {
                  tileTitle = "深渊黑曜秘宝库 (5.4s)";
                  tileBadge = tile.looted ? "" : "秘宝";
                } else if (
                  tile.kind === "enemy_raider" ||
                  tile.kind === "enemy_worm" ||
                  tile.kind === "enemy_boss"
                ) {
                  if (combatPreview) {
                    tileTitle = `${tile.enemyName || "荒原敌军"} (HP ${tile.enemyHp} / 攻 ${tile.enemyAtk} · 交战预计受创 -${combatPreview.expectedDamage} HP${combatPreview.isLethal ? " · 致命危险！" : ""})`;
                    tileBadge = `HP${tile.enemyHp}·-${combatPreview.expectedDamage}`;
                  } else {
                    tileTitle = `${tile.enemyName || "荒原敌军"}（已肃清）`;
                  }
                }

                return (
                  <button
                    key={`${tile.x}_${tile.y}`}
                    type="button"
                    title={tileTitle}
                    disabled={!isAdjacent || tile.kind === "wall"}
                    className={`raid-tile-cell ${isPlayer ? "tile-player" : ""} ${
                      isAdjacent && tile.kind !== "wall" ? "tile-adjacent" : ""
                    } ${!isExplored ? "tile-fog" : ""} ${
                      tile.kind === "wall" ? "tile-wall" : ""
                    } ${combatPreview?.isLethal ? "tile-lethal-warn" : ""}`}
                    onClick={() => handleStep(tile.x - pos.x, tile.y - pos.y)}
                  >
                    {isPlayer ? (
                      <LordAvatarSVG
                        cosmetics={equippedCosmetics}
                        weaponKey={raidLoadout.weaponKey}
                        armorKey={raidLoadout.armorKey}
                        bootsKey={raidLoadout.bootsKey}
                        size="token"
                        facing={facing}
                        isMoving
                      />
                    ) : !isExplored ? (
                      <span className="tile-fog-pattern mono-num">?</span>
                    ) : (
                      <>
                        <RaidTileSpriteSVG
                          kind={tile.kind as RaidTileSpriteKind}
                          searched={tile.looted}
                          defeated={tile.looted}
                          extractOpen={earlyExtractOpen}
                        />
                        {tileBadge && (
                          <span className="tile-micro-badge mono-num">
                            {tileBadge}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bottom Floating Action Bar on Map */}
            <div className="raid-map-action-dock">
              <div className="quick-alloc-bar">
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => handleStep(0, -1)}
                >
                  ↑ 上移 (W)
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => handleStep(-1, 0)}
                >
                  ← 左移 (A)
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => handleStep(0, 1)}
                >
                  ↓ 下移 (S)
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => handleStep(1, 0)}
                >
                  → 右移 (D)
                </button>

                {carriedPotionKeys.map((potKey) => {
                  const used = usedPotions.includes(potKey);
                  const spec = raidGears.find((g) => g.itemKey === potKey);
                  return (
                    <button
                      key={potKey}
                      type="button"
                      className="btn-outline btn-sm"
                      disabled={used}
                      onClick={() => handleDrinkPotion(potKey)}
                    >
                      <FlaskConical size={ICON.xs} />
                      <span>
                        {spec?.name ?? potKey}
                        {used ? " (已饮)" : ""}
                      </span>
                    </button>
                  );
                })}

                {currentTile?.kind === "portal" && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleUsePortal}
                  >
                    <Compass size={ICON.xs} />
                    <span>{currentTile.portalLabel || "踏入星盘传送门"}</span>
                  </button>
                )}

                {canExtractHere && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={startExtractionChannel}
                  >
                    <Sparkles size={ICON.xs} />
                    <span>呼叫信标撤离 (带走全部背囊物资)</span>
                  </button>
                )}

                {currentTile?.kind === "merchant" && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setShowLootModal(true)}
                  >
                    <span>与荒原游商交易</span>
                  </button>
                )}
              </div>

              <div className="raid-live-log-ticker">
                <span>{raidLog[0] ?? "探索裂隙中..."}</span>
              </div>
            </div>
          </div>

          {/* Right Tactical Radar Minimap & 4-Zone Portal Topology Sidebar */}
          <aside className="raid-minimap-dock" aria-label="荒原裂隙战术小地图">
            <div className="subpanel-head">
              <h3>
                <Compass size={ICON.sm} />
                <span className="mono-num">
                  裂隙战术小地图 ({currentZone.width}×{currentZone.height})
                </span>
              </h3>
            </div>

            {/* 4-Zone Portal Topology Strip */}
            <div className="minimap-zone-topology">
              {zones.map((z) => {
                const isCur = z.id === curZoneId;
                const isVis = z.visited;
                return (
                  <div
                    key={z.id}
                    className={`minimap-zone-pill ${isCur ? "zone-pill-active" : isVis ? "zone-pill-visited" : ""}`}
                  >
                    <span className="mono-num">Z{z.id + 1}</span>
                    <strong>{z.name.split(" · ")[1] ?? z.name}</strong>
                  </div>
                );
              })}
            </div>

            {/* Live Dynamic-Dimension Pixel Radar Grid */}
            <div className="raid-minimap-radar-box">
              <div
                className="raid-minimap-grid"
                ref={(el) => {
                  if (el) {
                    el.style.setProperty(
                      "--zone-cols",
                      String(currentZone.width),
                    );
                    el.style.setProperty(
                      "--zone-rows",
                      String(currentZone.height),
                    );
                  }
                }}
              >
                {currentZone.tiles.map((t) => {
                  const isP = t.x === pos.x && t.y === pos.y;
                  const isExp = t.explored && t.kind !== "fog";
                  let cellCls = "minimap-floor";
                  if (isP) cellCls = "minimap-player";
                  else if (!isExp) cellCls = "minimap-fog";
                  else if (t.kind === "wall") cellCls = "minimap-wall";
                  else if (t.kind === "portal") cellCls = "minimap-portal";
                  else if (
                    t.kind === "extract_early" ||
                    t.kind === "extract_deep"
                  )
                    cellCls = "minimap-extract";
                  else if (t.kind === "merchant") cellCls = "minimap-merchant";
                  else if (
                    (t.kind === "chest_wood" ||
                      t.kind === "chest_iron" ||
                      t.kind === "chest_coffin" ||
                      t.kind === "chest_abyss") &&
                    !t.looted
                  )
                    cellCls = "minimap-chest";
                  else if (
                    (t.kind === "enemy_raider" ||
                      t.kind === "enemy_worm" ||
                      t.kind === "enemy_boss") &&
                    !t.looted
                  )
                    cellCls = "minimap-enemy";

                  return (
                    <span
                      key={`mm_${t.x}_${t.y}`}
                      className={`minimap-cell ${cellCls}`}
                    />
                  );
                })}
              </div>
              <div className="minimap-coord-bar mono-num">
                <span>
                  当前坐标 ({pos.x}, {pos.y})
                </span>
                <span>
                  已探明{" "}
                  {Math.round(
                    ((currentZone.exploredCount ?? currentZone.tiles.length) /
                      Math.max(1, currentZone.tiles.length)) *
                      100,
                  )}
                  %
                </span>
              </div>
            </div>

            {/* Minimap Legend */}
            <div className="minimap-legend-grid">
              <span>
                <i className="legend-dot minimap-player" /> 领主位置
              </span>
              <span>
                <i className="legend-dot minimap-portal" /> 星盘传送门
              </span>
              <span>
                <i className="legend-dot minimap-extract" /> 撤离信标
              </span>
              <span>
                <i className="legend-dot minimap-chest" /> 未开宝箱
              </span>
              <span>
                <i className="legend-dot minimap-merchant" /> 游商营帐
              </span>
              <span>
                <i className="legend-dot minimap-enemy" /> 荒原敌军
              </span>
            </div>

            <div className="tab-body">
              <button
                type="button"
                className="btn-primary btn-block mono-num"
                onClick={() => setShowLootModal(true)}
              >
                <Box size={ICON.xs} />
                <span>
                  打开行囊 ({backpack.length}/{raidLoadout.backpackCapacity})
                </span>
              </button>
            </div>
          </aside>
        </div>

        {/* 3-COLUMN LOOTING, CHARACTER & CARAVAN OVERLAY MODAL */}
        {showLootModal && (
          <ModalShell
            ariaLabel="三栏搜打撤摸金与整备界面"
            backdropClassName="modal-backdrop raid-loot-modal-backdrop"
            sheetClassName="modal-sheet raid-loot-3col-sheet"
            onClose={() => setShowLootModal(false)}
          >
            <div className="modal-header">
              <div>
                <h2>战术行囊与战利品搜刮（支持拖拽或一键转移）</h2>
                <p>
                  随身背囊与本季安全保险箱 · 领主披挂与战术药水 ·{" "}
                  {activeContainerTitle}
                </p>
              </div>
              <div className="toolbar-actions">
                {activeChestDrops.length > 0 && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={lootAllFromChest}
                  >
                    一键全部拾取
                  </button>
                )}
                <button
                  type="button"
                  className="btn-outline"
                  onClick={() => setShowLootModal(false)}
                >
                  继续探索地图 (ESC / B)
                </button>
              </div>
            </div>

            <div className="economy-tabs" aria-label="职业远征耗材">
              {(state.economy?.professional.consumables ?? [])
                .filter((c) => c.use === "raid" && c.inventoryMilli >= 1000)
                .map((c) => (
                  <button
                    type="button"
                    className="btn-outline"
                    key={c.itemKey}
                    disabled={usedPotions.includes(c.itemKey)}
                    title={c.effect}
                    onClick={() =>
                      void runAction(() =>
                        sendRaidAction({
                          action: "use_consumable",
                          itemKey: c.itemKey,
                          dx:
                            c.itemKey === "blink_scroll"
                              ? facing === "left"
                                ? -2
                                : facing === "right"
                                  ? 2
                                  : 0
                              : 0,
                          dy:
                            c.itemKey === "blink_scroll"
                              ? facing === "up"
                                ? -2
                                : facing === "down"
                                  ? 2
                                  : 0
                              : 0,
                        }),
                      )
                    }
                  >
                    {c.name}
                    {usedPotions.includes(c.itemKey)
                      ? "（本局已使用）"
                      : c.itemKey === "blink_scroll"
                        ? "（朝当前面向）"
                        : ""}
                  </button>
                ))}
            </div>

            <div className="tab-body split-3col">
              {/* LEFT COLUMN: Safe Box + Raid Backpack */}
              <div
                className="subpanel"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggedItem) {
                    transferItem(
                      draggedItem.item,
                      draggedItem.source,
                      "backpack",
                    );
                    setDraggedItem(null);
                  }
                }}
              >
                <div className="subpanel-head">
                  <h3>
                    <Shield size={ICON.sm} />
                    <span className="mono-num">
                      本季安全保险箱 ({safeBox.length}/
                      {raidLoadout.safeSlotCount}格 · 阵亡绝不掉落)
                    </span>
                  </h3>
                </div>
                <div
                  className="loot-dropzone"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.stopPropagation();
                    if (draggedItem) {
                      transferItem(
                        draggedItem.item,
                        draggedItem.source,
                        "safebox",
                      );
                      setDraggedItem(null);
                    }
                  }}
                >
                  {safeBox.length === 0 ? (
                    <div className="empty-stage-hint">
                      将右侧宝箱或下方背囊中的高价值图纸/S1限定外观放入此处，即使阵亡也 100% 带回！
                    </div>
                  ) : (
                    <div className="loot-slot-grid">
                      {safeBox.map((item) => {
                        const meta = describeLootMeta(item);
                        return (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={() =>
                              setDraggedItem({ item, source: "safebox" })
                            }
                            className="loot-item-tile"
                          >
                            <RaidItemIconSVG itemKey={item.key} size={ICON.xl} />
                            <div className="loot-item-text">
                              <strong>{item.name}</strong>
                              <div className="batch-pill-group">
                                <span
                                  className={`rarity-badge rarity-${item.rarity.toLowerCase()}`}
                                >
                                  {item.rarity}
                                </span>
                                {meta.priceTag && (
                                  <span className="tier-pill mono-num">
                                    {meta.priceTag}
                                  </span>
                                )}
                                {meta.collectionTag && (
                                  <span
                                    className={`tag-badge ${meta.collectionTag.highlight ? "tag-warning" : ""}`}
                                  >
                                    {meta.collectionTag.text}
                                  </span>
                                )}
                              </div>
                              <div className="loot-item-actions">
                                <button
                                  type="button"
                                  className="btn-link"
                                  disabled={
                                    backpack.length >=
                                    raidLoadout.backpackCapacity
                                  }
                                  onClick={() =>
                                    transferItem(item, "safebox", "backpack")
                                  }
                                >
                                  移回背囊
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="subpanel-head">
                  <h3>
                    <Box size={ICON.sm} />
                    <span className="mono-num">
                      随身摸金背囊 ({backpack.length}/
                      {raidLoadout.backpackCapacity}格 · 撤离带出)
                    </span>
                  </h3>
                </div>
                <div className="loot-dropzone">
                  {backpack.length === 0 ? (
                    <div className="empty-stage-hint">
                      随身背囊为空。从右侧打开的宝箱中拾取物资放入此处。
                    </div>
                  ) : (
                    <div className="loot-slot-grid">
                      {backpack.map((item) => {
                        const meta = describeLootMeta(item);
                        return (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={() =>
                              setDraggedItem({ item, source: "backpack" })
                            }
                            className="loot-item-tile"
                          >
                            <RaidItemIconSVG itemKey={item.key} size={ICON.xl} />
                            <div className="loot-item-text">
                              <strong>{item.name}</strong>
                              <div className="batch-pill-group">
                                <span
                                  className={`rarity-badge rarity-${item.rarity.toLowerCase()}`}
                                >
                                  {item.rarity}
                                </span>
                                {meta.priceTag && (
                                  <span className="tier-pill mono-num">
                                    {meta.priceTag}
                                  </span>
                                )}
                                {meta.collectionTag && (
                                  <span
                                    className={`tag-badge ${meta.collectionTag.highlight ? "tag-warning" : ""}`}
                                  >
                                    {meta.collectionTag.text}
                                  </span>
                                )}
                              </div>
                              <div className="loot-item-actions">
                                <button
                                  type="button"
                                  className="btn-link"
                                  disabled={
                                    safeBox.length >= raidLoadout.safeSlotCount
                                  }
                                  onClick={() =>
                                    transferItem(item, "backpack", "safebox")
                                  }
                                >
                                  存入安全箱
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* CENTER COLUMN: Lord Character + Equipped Gear + Tactical Potions */}
              <div className="subpanel">
                <div className="subpanel-head">
                  <h3>
                    <Swords size={ICON.sm} />
                    <span>领主披挂穿戴与局内药水使用</span>
                  </h3>
                </div>
                <div className="raid-center-avatar-stage">
                  <LordAvatarSVG
                    cosmetics={equippedCosmetics}
                    weaponKey={raidLoadout.weaponKey}
                    armorKey={raidLoadout.armorKey}
                    bootsKey={raidLoadout.bootsKey}
                    size="stage"
                    facing={facing}
                  />
                  <div className="quick-alloc-bar">
                    {(
                      [
                        ["down", "正面"],
                        ["right", "右侧"],
                        ["up", "背面"],
                        ["left", "左侧"],
                      ] as const
                    ).map(([dir, label]) => (
                      <button
                        key={dir}
                        type="button"
                        className={`btn-chip ${facing === dir ? "active" : ""}`}
                        onClick={() => setFacing(dir)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="tab-body">
                  <h4>当前穿戴作战装具</h4>
                  <div className="loot-slot-grid">
                    {[
                      { label: "武器", key: raidLoadout.weaponKey },
                      { label: "护甲", key: raidLoadout.armorKey },
                      { label: "战靴", key: raidLoadout.bootsKey },
                      { label: "安全箱", key: raidLoadout.safeBoxKey },
                    ].map((slot) => {
                      const gSpec = raidGears.find(
                        (g) => g.itemKey === slot.key,
                      );
                      return (
                        <div key={slot.label} className="loot-item-tile">
                          <RaidItemIconSVG
                            itemKey={slot.key || "flint"}
                            size={ICON.xl}
                          />
                          <div className="loot-item-text">
                            <small>{slot.label}</small>
                            <strong>{gSpec?.name ?? "未穿戴基础件"}</strong>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <hr className="ink-divider" />

                  <h4>随身战术药水（点击直接饮用）</h4>
                  <div className="loot-slot-grid">
                    {carriedPotionKeys.length === 0 ? (
                      <span className="muted-note">本局未携带战术药水</span>
                    ) : (
                      carriedPotionKeys.map((potKey) => {
                        const used = usedPotions.includes(potKey);
                        const spec = raidGears.find(
                          (g) => g.itemKey === potKey,
                        );
                        return (
                          <button
                            key={potKey}
                            type="button"
                            className="loot-item-tile"
                            disabled={used}
                            onClick={() => handleDrinkPotion(potKey)}
                          >
                            <RaidItemIconSVG itemKey={potKey} size={ICON.xl} />
                            <div className="loot-item-text">
                              <strong>{spec?.name ?? potKey}</strong>
                              <small>
                                {used ? "已饮用生效" : "点击立即饮用"}
                              </small>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Currently Opened Chest Grid OR In-Raid Caravan Merchant */}
              <div className="subpanel">
                <div className="subpanel-head">
                  <h3>
                    <Sparkles size={ICON.sm} />
                    <span>{activeContainerTitle}</span>
                  </h3>
                </div>

                {currentTile?.kind === "merchant" ? (
                  <div className="tab-body">
                    <p className="bp-desc">
                      荒原游商营帐仅在裂隙局内驻扎！可用刚摸出的燧石/残片换取续航与盲盒，或直接结算主城游商大宗易物契约：
                    </p>
                    <div className="blueprint-list">
                      <article className="bp-card">
                        <div className="bp-top">
                          <strong>局内急行补给包</strong>
                          <span className="tag-badge">生命+65 / 时间+30s</span>
                        </div>
                        <div className="bp-footer">
                          <span className="cost-chip mono-num">
                            消耗局内背囊：1×燧石结晶
                          </span>
                          <button
                            type="button"
                            className="btn-primary btn-sm"
                            disabled={!backpack.some((i) => i.key === "flint")}
                            onClick={() => handleMerchantBuy("heal")}
                          >
                            立即兑换
                          </button>
                        </div>
                      </article>

                      <article className="bp-card">
                        <div className="bp-top">
                          <strong>游商秘宝盲盒（高阶图纸/S1外观）</strong>
                          <span className="tag-badge tag-warning">
                            必出稀有物
                          </span>
                        </div>
                        <div className="bp-footer">
                          <span className="cost-chip mono-num">
                            消耗局内背囊：1×古文明残片
                          </span>
                          <button
                            type="button"
                            className="btn-primary btn-sm"
                            disabled={
                              !backpack.some((i) => i.key === "ancient_shard")
                            }
                            onClick={() => handleMerchantBuy("mystery_bp")}
                          >
                            开启盲盒
                          </button>
                        </div>
                      </article>

                      {(state.caravanOffers ?? []).map((cf) => (
                        <article
                          key={cf.offerCode}
                          className={`bp-card ${cf.canTrade ? "bp-ready" : ""}`}
                        >
                          <div className="bp-top">
                            <strong>{cf.title}</strong>
                            <span className="tag-badge">
                              {cf.rewardSummary}
                            </span>
                          </div>
                          <div className="bp-footer">
                            <div className="bp-costs">
                              {cf.costs.map((c) => (
                                <span
                                  key={c.resourceKey}
                                  className={`cost-chip mono-num ${
                                    c.currentMilli >= c.requiredMilli
                                      ? "cost-ok"
                                      : "cost-lack"
                                  }`}
                                >
                                  {c.resourceName}{" "}
                                  {formatResource(c.currentMilli, 0)}/
                                  {formatResource(c.requiredMilli, 0)}
                                </span>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="btn-primary btn-sm"
                              disabled={!cf.canTrade}
                              onClick={() =>
                                void runAction(() =>
                                  api.tradeCaravan({
                                    offerCode: cf.offerCode,
                                  }),
                                )
                              }
                            >
                              易物
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="loot-dropzone">
                    {activeChestDrops.length === 0 ? (
                      <div className="empty-stage-hint">
                        当前无待拾取物品。返回地图踩上木箱、军需箱、机关石棺或深渊秘宝库即可在此展开箱内空间！
                      </div>
                    ) : (
                      <div className="loot-slot-grid">
                        {activeChestDrops.map((item) => {
                          const meta = describeLootMeta(item);
                          return (
                            <div
                              key={item.id}
                              draggable
                              onDragStart={() =>
                                setDraggedItem({ item, source: "chest" })
                              }
                              className="loot-item-tile"
                            >
                              <RaidItemIconSVG
                                itemKey={item.key}
                                size={ICON.xl}
                              />
                              <div className="loot-item-text">
                                <strong>{item.name}</strong>
                                <div className="batch-pill-group">
                                  <span
                                    className={`rarity-badge rarity-${item.rarity.toLowerCase()}`}
                                  >
                                    {item.rarity}
                                  </span>
                                  {meta.priceTag && (
                                    <span className="tier-pill mono-num">
                                      {meta.priceTag}
                                    </span>
                                  )}
                                  {meta.collectionTag && (
                                    <span
                                      className={`tag-badge ${meta.collectionTag.highlight ? "tag-warning" : ""}`}
                                    >
                                      {meta.collectionTag.text}
                                    </span>
                                  )}
                                </div>
                                <div className="loot-item-actions">
                                  <button
                                    type="button"
                                    className="btn-link"
                                    disabled={
                                      safeBox.length >=
                                      raidLoadout.safeSlotCount
                                    }
                                    onClick={() =>
                                      transferItem(item, "chest", "safebox")
                                    }
                                  >
                                    存入安全箱
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-link"
                                    disabled={
                                      backpack.length >=
                                      raidLoadout.backpackCapacity
                                    }
                                    onClick={() =>
                                      transferItem(item, "chest", "backpack")
                                    }
                                  >
                                    收入背囊
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </ModalShell>
        )}

        {confirmAbandonOpen && (
          <ConfirmActionModal
            title="确认放弃撤离并脱离荒原裂隙？"
            subtitle="主动放弃将按「荒原迷失 (M.I.A.)」规则立即结算本局远征"
            severity="danger"
            consequences={[
              equippedDestroyableNames.length > 0
                ? `当前穿戴的作战装具将被沙暴损毁：${equippedDestroyableNames.join("、")}。`
                : "当前未穿戴高阶武器/护甲/战靴，无披挂损毁损失。",
              `随身摸金背囊内 ${backpack.length} 件物资将全部遗失于荒原。`,
              `本季安全保险箱内 ${safeBox.length} / ${raidLoadout.safeSlotCount} 件珍稀物资将 100% 安全带回主城。`,
            ]}
            confirmLabel="确认放弃撤离 (M.I.A.)"
            cancelLabel="继续留在裂隙"
            onCancel={() => setConfirmAbandonOpen(false)}
            onConfirm={() => {
              setConfirmAbandonOpen(false);
              triggerFinishRaid("MIA");
            }}
          />
        )}
      </div>
    </div>
  );
}
