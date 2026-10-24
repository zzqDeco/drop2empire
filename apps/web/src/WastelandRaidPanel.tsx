import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type DashboardStateResp,
  type RaidGearSpecDTO,
  type RaidLootItemDTO,
} from "@drop2empire/api-client";
import {
  Award,
  Box,
  Compass,
  Layers,
  RefreshCw,
  Shield,
  Sparkles,
  Swords,
} from "lucide-react";
import { ICON } from "./icons";
import { formatResource } from "./format";
import { type FacingDirection, LordAvatarSVG } from "./LordAvatarSVG";
import {
  BlueprintEtchedCard,
  RaidItemIconSVG,
  RaidTileSpriteSVG,
  type RaidTileSpriteKind,
} from "./RaidSpritesSVG";
import {
  CHEST_CHANNEL_LABELS,
  EARLY_EXTRACT_CUTOFF_MS,
  computeChestChannelMs,
} from "./config/gameConfig";

interface WastelandRaidPanelProps {
  state: DashboardStateResp;
  busy?: boolean;
  runAction: (
    fn: () => Promise<DashboardStateResp>,
    msg?: string,
  ) => Promise<void>;
}

type TileKind = RaidTileSpriteKind;

export type LootDrop = RaidLootItemDTO;

export function WastelandRaidPanel({
  state,
  runAction,
}: WastelandRaidPanelProps) {
  const { raidLoadout, raidGears, equippedCosmetics } = state;
  const activeSession = raidLoadout.activeSession ?? null;
  const inRaid = raidLoadout.activeRaidSeed > 0 && activeSession !== null;

  // 2-Stage Pre-Raid Progression: "armory" (Act 1) -> "draft" (Act 2)
  const [preStage, setPreStage] = useState<"armory" | "draft">("armory");
  const [armoryFacing, setArmoryFacing] = useState<FacingDirection>("down");
  const [gearTab, setGearTab] = useState<
    "all" | "weapon" | "armor" | "boots" | "safe_box" | "potion"
  >("all");
  const [replaceSlotIdx, setReplaceSlotIdx] = useState<number>(0);

  // Ceremonial Post-Raid Settlement Overlay State (driven by server's lastSettlementReport)
  const [dismissedSettlementSeed, setDismissedSettlementSeed] =
    useState<string>("");

  const [facing, setFacing] = useState<FacingDirection>("right");
  const [timeLeftMs, setTimeLeftMs] = useState(180000);
  const [lastMoveAtMs, setLastMoveAtMs] = useState(0);

  // Hidden Backpack by default; opens on [B]/[Tab], button click, or when opening a chest / Caravan
  const [showLootModal, setShowLootModal] = useState(false);
  const [draggedItem, setDraggedItem] = useState<{
    item: LootDrop;
    source: "chest" | "backpack" | "safebox";
  } | null>(null);

  const [channeling, setChanneling] = useState<{
    label: string;
    kind: TileKind;
    x: number;
    y: number;
    startedAt: number;
    durationMs: number;
    progressPct: number;
  } | null>(null);

  const settlingRef = useRef(false);

  // Sync local countdown & facing from authoritative server session
  useEffect(() => {
    if (!inRaid || !activeSession) {
      setChanneling(null);
      setShowLootModal(false);
      settlingRef.current = false;
      return;
    }
    setTimeLeftMs(activeSession.timeRemainingMs);
    if (
      activeSession.facing === "up" ||
      activeSession.facing === "down" ||
      activeSession.facing === "left" ||
      activeSession.facing === "right"
    ) {
      setFacing(activeSession.facing);
    }
    settlingRef.current = false;
  }, [
    inRaid,
    activeSession?.seed,
    activeSession?.timeRemainingMs,
    activeSession?.facing,
    activeSession,
  ]);

  const triggerFinishRaid = useCallback(
    (status: "EXTRACTED" | "MIA") => {
      if (settlingRef.current) return;
      settlingRef.current = true;
      setChanneling(null);
      setShowLootModal(false);
      setPreStage("armory");

      void runAction(
        () => api.finishRaid({ status }),
        status === "EXTRACTED"
          ? "凯旋归城！背囊与安全箱全部战利品已入库。"
          : "荒原迷失 (MIA)！仅安全保险箱内物资成功带回。",
      );
    },
    [runAction],
  );

  // Real-time countdown & channeling ticker (100ms)
  useEffect(() => {
    if (!inRaid || !activeSession) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setTimeLeftMs((prev) => {
        const next = prev - 100;
        if (next <= 0) {
          triggerFinishRaid("MIA");
          return 0;
        }
        return next;
      });

      setChanneling((cur) => {
        if (!cur) return null;
        const elapsed = now - cur.startedAt;
        if (elapsed >= cur.durationMs) {
          return { ...cur, progressPct: 100 };
        }
        return {
          ...cur,
          progressPct: Math.min(
            99,
            Math.floor((elapsed / cur.durationMs) * 100),
          ),
        };
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [inRaid, activeSession, triggerFinishRaid]);

  // Complete channeling when progressPct reaches 100 -> Request Server Chest Roll or Extraction!
  useEffect(() => {
    if (!channeling || channeling.progressPct < 100) return;
    const done = channeling;
    setChanneling(null);

    if (done.kind === "extract_early" || done.kind === "extract_deep") {
      triggerFinishRaid("EXTRACTED");
      return;
    }

    setShowLootModal(true);
    void runAction(() => api.raidAction({ action: "open_chest" }));
  }, [channeling, triggerFinishRaid, runAction]);

  const zones = activeSession?.zones ?? [];
  const curZoneId = activeSession?.currentZoneId ?? 0;
  const currentZone = zones[curZoneId];
  const pos = useMemo(
    () => ({
      x: activeSession?.playerX ?? 1,
      y: activeSession?.playerY ?? 3,
    }),
    [activeSession?.playerX, activeSession?.playerY],
  );
  const hp = activeSession?.hp ?? raidLoadout.totalMaxHp;
  const maxHp = activeSession?.maxHp ?? raidLoadout.totalMaxHp;
  const atk = activeSession?.atk ?? raidLoadout.totalAtk;
  const def = activeSession?.def ?? raidLoadout.totalDef;
  const effectiveMoveCooldownMs =
    activeSession?.effectiveMoveCooldownMs ?? raidLoadout.moveCooldownMs ?? 360;
  const scavRemMs = activeSession?.scavRemainingMs ?? 0;
  const usedPotions = activeSession?.usedPotionKeys ?? [];
  const backpack = activeSession?.backpack ?? [];
  const safeBox = activeSession?.safeBox ?? [];
  const activeChestDrops = activeSession?.activeChestDrops ?? [];
  const activeContainerTitle =
    activeSession?.activeContainerTitle ?? "未开启容器";
  const raidLog = activeSession?.logs ?? [];

  const currentTile = useMemo(() => {
    if (!currentZone) return null;
    return currentZone.tiles[pos.y * currentZone.width + pos.x] ?? null;
  }, [currentZone, pos]);

  const handleStep = useCallback(
    (dx: number, dy: number) => {
      if (!inRaid || !currentZone || settlingRef.current) return;
      if (dx < 0) setFacing("left");
      else if (dx > 0) setFacing("right");
      else if (dy < 0) setFacing("up");
      else if (dy > 0) setFacing("down");

      const now = Date.now();
      if (now - lastMoveAtMs < effectiveMoveCooldownMs) {
        return;
      }
      const nx = pos.x + dx;
      const ny = pos.y + dy;
      if (
        nx < 0 ||
        nx >= currentZone.width ||
        ny < 0 ||
        ny >= currentZone.height
      ) {
        return;
      }
      const dest = currentZone.tiles[ny * currentZone.width + nx];
      if (!dest || dest.kind === "wall") {
        return;
      }

      setLastMoveAtMs(now);
      setChanneling(null);

      const isBossAlive = dest.kind === "enemy_boss" && !dest.looted;
      const isMerchant = dest.kind === "merchant";
      const isUnsearchedChest =
        (dest.kind === "chest_wood" ||
          dest.kind === "chest_iron" ||
          dest.kind === "chest_coffin" ||
          dest.kind === "chest_abyss") &&
        !dest.looted;

      void runAction(async () => {
        const resp = await api.raidAction({ action: "move", dx, dy });
        if (isBossAlive || isMerchant) {
          setShowLootModal(true);
        } else if (isUnsearchedChest) {
          const dur = computeChestChannelMs(
            dest.kind,
            scavRemMs > 0,
            dest.channelMs,
          );
          setChanneling({
            label: CHEST_CHANNEL_LABELS[dest.kind] ?? "正在搜索容器",
            kind: dest.kind as TileKind,
            x: nx,
            y: ny,
            startedAt: Date.now(),
            durationMs: dur,
            progressPct: 0,
          });
        }
        return resp;
      });
    },
    [
      inRaid,
      currentZone,
      lastMoveAtMs,
      effectiveMoveCooldownMs,
      pos,
      scavRemMs,
      runAction,
    ],
  );

  // Keyboard WASD / Arrow navigation + [B]/[Tab] toggle for hidden backpack
  useEffect(() => {
    if (!inRaid) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "b" || e.key === "B" || e.key === "Tab") {
        e.preventDefault();
        setShowLootModal((v) => !v);
        return;
      }
      if (e.key === "Escape" && showLootModal) {
        e.preventDefault();
        setShowLootModal(false);
        return;
      }
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") {
        e.preventDefault();
        handleStep(0, -1);
      } else if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") {
        e.preventDefault();
        handleStep(0, 1);
      } else if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
        e.preventDefault();
        handleStep(-1, 0);
      } else if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
        e.preventDefault();
        handleStep(1, 0);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inRaid, handleStep, showLootModal]);

  const handleUsePortal = () => {
    if (!currentTile || currentTile.kind !== "portal") {
      return;
    }
    setChanneling(null);
    setShowLootModal(false);
    void runAction(() => api.raidAction({ action: "use_portal" }));
  };

  const handleDrinkPotion = (potKey: string) => {
    if (usedPotions.includes(potKey)) return;
    void runAction(() =>
      api.raidAction({ action: "drink_potion", itemKey: potKey }),
    );
  };

  // Drag-and-Drop & Click Item Transfer Handlers between Chest <-> Backpack <-> SafeBox
  const transferItem = (
    item: LootDrop,
    from: "chest" | "backpack" | "safebox",
    to: "backpack" | "safebox",
  ) => {
    if (from === to) return;
    if (to === "safebox" && safeBox.length >= raidLoadout.safeSlotCount) return;
    if (to === "backpack" && backpack.length >= raidLoadout.backpackCapacity)
      return;
    void runAction(() =>
      api.raidAction({
        action: "transfer_loot",
        itemId: item.id,
        fromContainer: from,
        toContainer: to,
      }),
    );
  };

  const lootAllFromChest = () => {
    if (activeChestDrops.length === 0) return;
    void runAction(() => api.raidAction({ action: "loot_all" }));
  };

  const handleMerchantBuy = (offer: "heal" | "mystery_bp") => {
    void runAction(() =>
      api.raidAction({ action: "merchant_buy", itemKey: offer }),
    );
  };

  const serverReport = raidLoadout.lastSettlementReport ?? null;
  const reportKey = serverReport
    ? `${serverReport.status}_${serverReport.zonesVisited}_${serverReport.chestsOpened}_${serverReport.bossesKilled}_${serverReport.backpackItems.length}_${serverReport.safeBoxItems.length}`
    : "";
  const settlementReport =
    !inRaid && serverReport && dismissedSettlementSeed !== reportKey
      ? serverReport
      : null;

  // ============================================================================
  // ACT 4: CEREMONIAL POST-RAID SETTLEMENT OVERLAY (仪式感结算卷轴画面)
  // ============================================================================
  if (settlementReport) {
    const isExtracted = settlementReport.status === "EXTRACTED";
    return (
      <div
        className="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-label="荒原远征结算卷轴"
      >
        <div className="modal-sheet raid-settlement-scroll">
          <div className="raid-settlement-header">
            <div className="raid-settlement-title-group">
              <span className="tag-badge">荒原远征战报 · 墨械枢密院核验</span>
              <h2>
                {isExtracted
                  ? "凯旋归城 · 裂隙信标撤离成功"
                  : "迷失荒原 · 沙暴吞噬未能撤离"}
              </h2>
              <p>
                {isExtracted
                  ? "斥候小队携随身背囊与安全保险箱全部战利品安全返回领主主城。"
                  : "随身背囊与穿戴的武器、护甲、战靴已在沙暴中损毁，仅本赛季安全保险箱物资完好带回。"}
              </p>
            </div>
            <div
              className={`raid-cinnabar-seal ${isExtracted ? "seal-victory" : "seal-mia"}`}
            >
              <span>{isExtracted ? "凯旋归城" : "荒原迷失"}</span>
              <small className="mono-num">
                {isExtracted ? "EXTRACTED" : "M.I.A."}
              </small>
            </div>
          </div>

          <div className="tab-body split-2col">
            <div className="subpanel">
              <div className="subpanel-head">
                <h3>
                  <Compass size={ICON.sm} />
                  <span>领主体素立绘与远征统计</span>
                </h3>
              </div>
              <div className="raid-settlement-hero">
                <LordAvatarSVG
                  cosmetics={equippedCosmetics}
                  weaponKey={raidLoadout.weaponKey}
                  armorKey={raidLoadout.armorKey}
                  bootsKey={raidLoadout.bootsKey}
                  size="stage"
                  facing="down"
                />
                <div className="ledger-audit-box mono-num">
                  <div className="ledger-row">
                    <span>踏足裂隙区块</span>
                    <strong>{settlementReport.zonesVisited} 处</strong>
                  </div>
                  <div className="ledger-row">
                    <span>破译开启宝箱</span>
                    <strong>{settlementReport.chestsOpened} 个</strong>
                  </div>
                  <div className="ledger-row">
                    <span>讨伐深渊首领</span>
                    <strong>{settlementReport.bossesKilled} 尊</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="subpanel">
              <div className="subpanel-head">
                <h3>
                  <Award size={ICON.sm} />
                  <span>战利品入库清册</span>
                </h3>
              </div>
              <div className="tab-body">
                <h4>
                  安全保险箱带回 ({settlementReport.safeBoxItems.length} 件 ·
                  绝不掉落)
                </h4>
                <div className="loot-slot-grid">
                  {settlementReport.safeBoxItems.length === 0 ? (
                    <span className="muted-note">安全保险箱未存放物品</span>
                  ) : (
                    settlementReport.safeBoxItems.map((item) => (
                      <div key={item.id} className="loot-item-tile">
                        <RaidItemIconSVG itemKey={item.key} size={ICON.xl} />
                        <div>
                          <strong>{item.name}</strong>
                          <span
                            className={`rarity-badge rarity-${item.rarity.toLowerCase()}`}
                          >
                            {item.rarity}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <hr className="ink-divider" />

                <h4>
                  随身背囊带出 ({settlementReport.backpackItems.length} 件)
                </h4>
                <div className="loot-slot-grid">
                  {settlementReport.backpackItems.length === 0 ? (
                    <span className="muted-note">
                      {isExtracted
                        ? "随身背囊未携带额外战利品"
                        : "随身背囊物资已在荒原迷失中损毁"}
                    </span>
                  ) : (
                    settlementReport.backpackItems.map((item) => (
                      <div key={item.id} className="loot-item-tile">
                        <RaidItemIconSVG itemKey={item.key} size={ICON.xl} />
                        <div>
                          <strong>{item.name}</strong>
                          <span
                            className={`rarity-badge rarity-${item.rarity.toLowerCase()}`}
                          >
                            {item.rarity}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ marginTop: "var(--space-4)" }}>
                  <button
                    type="button"
                    className="btn-primary btn-block"
                    onClick={() => setDismissedSettlementSeed(reportKey)}
                  >
                    收拢战利品 · 返回斥候大本营
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ACT 3: FULL-SCREEN 2D MULTI-ZONE MAP + HIDDEN BACKPACK + 3-COLUMN LOOTING
  // ============================================================================
  if (inRaid && currentZone) {
    const earlyExtractOpen = timeLeftMs >= EARLY_EXTRACT_CUTOFF_MS;
    const canExtractHere =
      currentTile?.kind === "extract_deep" ||
      (currentTile?.kind === "extract_early" && earlyExtractOpen);

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
                {safeBox.length}/{raidLoadout.safeSlotCount} · {backpack.length}
                /{raidLoadout.backpackCapacity}
              </span>
            </div>
          </div>

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
              onClick={() => triggerFinishRaid("MIA")}
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
                style={{ width: `${channeling.progressPct}%` }}
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
                style={{
                  gridTemplateColumns: `repeat(${currentZone.width}, 64px)`,
                }}
              >
                {currentZone.tiles.map((tile) => {
                  const isPlayer = tile.x === pos.x && tile.y === pos.y;
                  const isAdjacent =
                    Math.abs(tile.x - pos.x) + Math.abs(tile.y - pos.y) === 1;
                  const isExplored = tile.explored && tile.kind !== "fog";

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
                      ? "外围限时撤离信标（开放中）"
                      : "外围限时撤离信标（已关闭）";
                    tileBadge = earlyExtractOpen ? "撤离" : "关闭";
                  } else if (tile.kind === "extract_deep") {
                    tileTitle = "深处常驻撤离信标";
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
                    tileTitle = `${tile.enemyName || "荒原敌军"} (HP ${tile.enemyHp} / 攻 ${tile.enemyAtk})`;
                    tileBadge = tile.looted ? "" : `HP${tile.enemyHp}`;
                  }

                  return (
                    <button
                      key={`${tile.x}_${tile.y}`}
                      type="button"
                      title={tileTitle}
                      disabled={!isAdjacent || tile.kind === "wall"}
                      className={`raid-tile-cell ${isPlayer ? "tile-player" : ""} ${
                        isAdjacent && tile.kind !== "wall"
                          ? "tile-adjacent"
                          : ""
                      } ${!isExplored ? "tile-fog" : ""} ${
                        tile.kind === "wall" ? "tile-wall" : ""
                      }`}
                      onClick={() =>
                        handleStep(tile.x - pos.x, tile.y - pos.y)
                      }
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
                            kind={tile.kind as TileKind}
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
                      onClick={() =>
                        setChanneling({
                          label: "正在呼叫信标撤离 (2.8s)",
                          kind: currentTile.kind as TileKind,
                          x: pos.x,
                          y: pos.y,
                          startedAt: Date.now(),
                          durationMs: computeChestChannelMs(
                            currentTile.kind,
                            scavRemMs > 0,
                            currentTile.channelMs,
                          ),
                          progressPct: 0,
                        })
                      }
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
                  <span>裂隙战术小地图</span>
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

              {/* Live 9x9 Pixel Radar Grid */}
              <div className="raid-minimap-radar-box">
                <div
                  className="raid-minimap-grid"
                  style={{
                    gridTemplateColumns: `repeat(${currentZone.width}, 18px)`,
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
                    else if (t.kind === "merchant")
                      cellCls = "minimap-merchant";
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
                      (currentZone.exploredCount / currentZone.tiles.length) *
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

          {/* ====================================================================
              3-COLUMN LOOTING, CHARACTER & CARAVAN OVERLAY MODAL
              (Left: Backpack & SafeBox | Center: Voxel Lord & Potions | Right: Opened Chest / Caravan)
              ==================================================================== */}
          {showLootModal && (
            <div
              className="raid-loot-modal-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label="三栏搜打撤摸金与整备界面"
            >
              <div className="raid-loot-3col-sheet">
                <div className="modal-header">
                  <div>
                    <h2>战术行囊与战利品搜刮（支持鼠标拖拽或点击转移）</h2>
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

                <div className="tab-body split-3col">
                  {/* LEFT COLUMN: Safe Box + Raid Backpack (Drop Targets) */}
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
                          将右侧宝箱或下方背囊中的高价值图纸/S1限定外观拖拽至此，即使阵亡也 100% 带回！
                        </div>
                      ) : (
                        <div className="loot-slot-grid">
                          {safeBox.map((item) => (
                            <div
                              key={item.id}
                              draggable
                              onDragStart={() =>
                                setDraggedItem({ item, source: "safebox" })
                              }
                              onClick={() =>
                                transferItem(item, "safebox", "backpack")
                              }
                              className="loot-item-tile"
                              title="拖拽或点击移回随身背囊"
                            >
                              <RaidItemIconSVG itemKey={item.key} size={ICON.xl} />
                              <div className="loot-item-text">
                                <strong>{item.name}</strong>
                                <span
                                  className={`rarity-badge rarity-${item.rarity.toLowerCase()}`}
                                >
                                  {item.rarity}
                                </span>
                              </div>
                            </div>
                          ))}
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
                          随身背囊为空。从右侧打开的宝箱中拖拽物资放入此处。
                        </div>
                      ) : (
                        <div className="loot-slot-grid">
                          {backpack.map((item) => (
                            <div
                              key={item.id}
                              draggable
                              onDragStart={() =>
                                setDraggedItem({ item, source: "backpack" })
                              }
                              onClick={() =>
                                transferItem(item, "backpack", "safebox")
                              }
                              className="loot-item-tile"
                              title="拖拽或点击存入安全保险箱"
                            >
                              <RaidItemIconSVG itemKey={item.key} size={ICON.xl} />
                              <div className="loot-item-text">
                                <strong>{item.name}</strong>
                                <span
                                  className={`rarity-badge rarity-${item.rarity.toLowerCase()}`}
                                >
                                  {item.rarity}
                                </span>
                              </div>
                            </div>
                          ))}
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
                        {raidLoadout.equippedPotions.length === 0 ? (
                          <span className="muted-note">
                            本局未携带战术药水
                          </span>
                        ) : (
                          raidLoadout.equippedPotions.map((potKey) => {
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
                                  !backpack.some(
                                    (i) => i.key === "ancient_shard",
                                  )
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
                            {activeChestDrops.map((item) => (
                              <div
                                key={item.id}
                                draggable
                                onDragStart={() =>
                                  setDraggedItem({ item, source: "chest" })
                                }
                                onClick={() =>
                                  transferItem(
                                    item,
                                    "chest",
                                    item.rarity === "LEGENDARY" ||
                                      item.rarity === "EPIC"
                                      ? safeBox.length <
                                        raidLoadout.safeSlotCount
                                        ? "safebox"
                                        : "backpack"
                                      : "backpack",
                                  )
                                }
                                className="loot-item-tile"
                                title="拖拽至左侧背囊/保险箱，或直接点击拾取"
                              >
                                <RaidItemIconSVG itemKey={item.key} size={ICON.xl} />
                                <div className="loot-item-text">
                                  <strong>{item.name}</strong>
                                  <span
                                    className={`rarity-badge rarity-${item.rarity.toLowerCase()}`}
                                  >
                                    {item.rarity} · 点击或拖拽拾取
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // ACT 2: DEDICATED 3D ANIMATED BUFF CARD DRAFT STAGE (敕令刻印抽卡台)
  // ============================================================================
  if (preStage === "draft") {
    const equippedFull = raidLoadout.equippedBuffCards.length >= 4;

    return (
      <section
        className="lower-workspace"
        style={{ marginTop: "var(--space-3)" }}
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

          {/* 3D Spring-Physics Etched Buff Cards Stage (Modeled on fearless-bose) */}
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

  // ============================================================================
  // ACT 1: PRE-RAID ARMORY & LOADOUT STAGE (第一阶段：斥候军械整备厅)
  // ============================================================================
  const filteredGears = raidGears.filter(
    (g) => gearTab === "all" || g.category === gearTab,
  );

  return (
    <section
      className="lower-workspace"
      style={{ marginTop: "var(--space-3)" }}
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
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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

/**
 * Integrated Personal Lord Profile & Wardrobe Card (Used on Main Settlement Screen & Relic Vault).
 */
export function LordProfileWardrobeBar({
  state,
  runAction,
  defaultExpanded = false,
}: {
  state: DashboardStateResp;
  busy?: boolean;
  defaultExpanded?: boolean;
  runAction: (
    fn: () => Promise<DashboardStateResp>,
    msg?: string,
  ) => Promise<void>;
}) {
  const [showWardrobe, setShowWardrobe] = useState(defaultExpanded);
  const [previewFacing, setPreviewFacing] = useState<FacingDirection>("down");
  const { player, equippedCosmetics, cosmetics, raidLoadout } = state;
  const ownedCosCount = cosmetics.filter((c) => c.ownedCount > 0).length;

  return (
    <section className="panel" aria-label="领主个人档案与体素衣橱">
      <div className="panel-header">
        <div className="panel-title">
          <Award size={ICON.sm} />
          <h2>领主档案 · {player.handle}</h2>
        </div>
        <span className="tag-badge">
          {player.profession !== "none" ? player.professionName : "拓荒领主"}
        </span>
      </div>

      <div className="lord-main-profile-card">
        <div className="lord-voxel-showcase">
          <LordAvatarSVG
            cosmetics={equippedCosmetics}
            weaponKey={raidLoadout.weaponKey}
            armorKey={raidLoadout.armorKey}
            bootsKey={raidLoadout.bootsKey}
            size="profile"
            facing={previewFacing}
          />
          <div className="voxel-turn-controls">
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
                className={`btn-chip ${previewFacing === dir ? "active" : ""}`}
                onClick={() => setPreviewFacing(dir)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="lord-profile-details">
          <div className="water-label">
            领主真身披挂 · 荒原出征与主城同辉
          </div>
          <div className="water-rate mono-num">
            S1 外观典藏：{ownedCosCount}/{cosmetics.length} · 唯一秘宝：
            {state.collectibles.length} 件
          </div>
          <div className="bp-costs" style={{ marginTop: "6px" }}>
            <span className="cost-chip mono-num">
              生命 {raidLoadout.totalMaxHp}
            </span>
            <span className="cost-chip mono-num">
              攻击 {raidLoadout.totalAtk}
            </span>
            <span className="cost-chip mono-num">
              护甲 {raidLoadout.totalDef}
            </span>
            <span className="cost-chip mono-num">
              安全箱 {raidLoadout.safeSlotCount}格
            </span>
          </div>
          <div style={{ marginTop: "8px" }}>
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => setShowWardrobe((v) => !v)}
            >
              <Sparkles size={ICON.xs} />
              <span>
                {showWardrobe
                  ? "收起赛季外观衣橱"
                  : `更换赛季外观 (${ownedCosCount}/${cosmetics.length})`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {showWardrobe && (
        <div
          className={defaultExpanded ? "blueprint-list" : "modal-backdrop"}
          role={defaultExpanded ? undefined : "dialog"}
          aria-modal={defaultExpanded ? undefined : "true"}
          aria-label="领主赛季外观衣橱"
        >
          <div className={defaultExpanded ? "blueprint-list" : "modal-sheet"}>
            {!defaultExpanded && (
              <div className="modal-header">
                <div>
                  <h2>领主衣橱 · S1 赛季限定外观披挂</h2>
                  <p>
                    穿戴后将在主城个人档案、斥候整备厅与荒原 2D 裂隙战场中实时显形（已解锁{" "}
                    {ownedCosCount} / {cosmetics.length} 件）
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setShowWardrobe(false)}
                >
                  完成穿戴
                </button>
              </div>
            )}
            <div className="blueprint-list">
              {cosmetics.map((cos) => (
                <article
                  key={cos.itemKey}
                  className={`bp-card ${cos.equipped ? "bp-ready" : ""}`}
                >
                  <div className="bp-top">
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <RaidItemIconSVG itemKey={cos.itemKey} size={ICON.xl} />
                      <div>
                        <strong>{cos.name}</strong>
                        <span
                          className={`rarity-badge rarity-${cos.rarity.toLowerCase()}`}
                        >
                          {cos.rarity}
                        </span>
                      </div>
                    </div>
                    <span className="tag-badge mono-num">
                      持有 {cos.ownedCount}
                    </span>
                  </div>
                  <p className="bp-desc">
                    {cos.seasonTag} · {cos.visualEffect}
                  </p>
                  <div className="bp-footer">
                    <span className="cost-chip">{cos.slot}</span>
                    <button
                      type="button"
                      className={
                        cos.equipped
                          ? "btn-outline btn-sm"
                          : "btn-primary btn-sm"
                      }
                      data-pop={cos.equipped ? "卸下外观" : `✦ 穿戴 ${cos.name}`}
                      disabled={cos.ownedCount <= 0 && !cos.equipped}
                      onClick={() =>
                        void runAction(() =>
                          api.equipCosmetic({
                            slot: cos.slot,
                            itemKey: cos.equipped ? "" : cos.itemKey,
                          }),
                        )
                      }
                    >
                      {cos.equipped
                        ? "卸下"
                        : cos.ownedCount > 0
                          ? "穿戴"
                          : "荒原秘宝库掉落 / 市场求购"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
