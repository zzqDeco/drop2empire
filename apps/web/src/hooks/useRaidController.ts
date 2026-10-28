import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type DashboardStateResp,
  type RaidActionReq,
  type RaidLootItemDTO,
} from "@drop2empire/api-client";
import { advanceChannelingProgress, type ServerUpdate } from "../serverState";
import type { FacingDirection } from "../LordAvatarSVG";
import type { RaidTileSpriteKind } from "../RaidSpritesSVG";
import { CHEST_CHANNEL_LABELS } from "../config/gameConfig";

export type LootDrop = RaidLootItemDTO;

export interface ChannelingState {
  label: string;
  kind: RaidTileSpriteKind;
  x: number;
  y: number;
  startedAt: number;
  durationMs: number;
  progressPct: number;
}

export function useRaidController(
  state: DashboardStateResp,
  runAction: (fn: () => Promise<ServerUpdate>, msg?: string) => Promise<void>,
) {
  const { raidLoadout } = state;
  const activeSession = raidLoadout.activeSession ?? null;
  const inRaid = activeSession !== null;

  const [preStage, setPreStage] = useState<"armory" | "draft">("armory");
  const [armoryFacing, setArmoryFacing] = useState<FacingDirection>("down");
  const [gearTab, setGearTab] = useState<
    "all" | "weapon" | "armor" | "boots" | "safe_box" | "potion"
  >("all");
  const [replaceSlotIdx, setReplaceSlotIdx] = useState<number>(0);

  const [dismissedSettlementRaidId, setDismissedSettlementRaidId] =
    useState<string>("");

  const [facing, setFacing] = useState<FacingDirection>("right");
  const [timeLeftMs, setTimeLeftMs] = useState(180000);
  const [lastMoveAtMs, setLastMoveAtMs] = useState(0);

  const [showLootModal, setShowLootModal] = useState(false);
  const [draggedItem, setDraggedItem] = useState<{
    item: LootDrop;
    source: "chest" | "backpack" | "safebox";
  } | null>(null);

  const [channeling, setChanneling] = useState<ChannelingState | null>(null);

  const settlingRef = useRef(false);
  const activeRaidId = activeSession?.raidId ?? "";
  const serverTimeRemMs = activeSession?.timeRemainingMs ?? 0;
  const countdownDeadlineRef = useRef(0);
  const serverFacing = activeSession?.facing ?? "right";

  useEffect(() => {
    if (!inRaid || !activeRaidId) {
      setChanneling(null);
      setShowLootModal(false);
      settlingRef.current = false;
      return;
    }
    countdownDeadlineRef.current = performance.now() + serverTimeRemMs;
    setTimeLeftMs(serverTimeRemMs);
    if (
      serverFacing === "up" ||
      serverFacing === "down" ||
      serverFacing === "left" ||
      serverFacing === "right"
    ) {
      setFacing(serverFacing);
    }
    settlingRef.current = false;
  }, [inRaid, activeRaidId, serverTimeRemMs, serverFacing]);

  const commandPendingRef = useRef(false);
  const sessionRef = useRef(activeSession);
  const channelDeadlineRef = useRef(0);
  useEffect(() => {
    sessionRef.current = activeSession;
    channelDeadlineRef.current =
      performance.now() + (activeSession?.channelRemainingMs ?? 0);
  }, [activeSession]);

  const sendRaidCommand = useCallback(
    async (
      command:
        | Omit<RaidActionReq, "raidId" | "commandSeq">
        | { status: "EXTRACTED" | "MIA" },
    ) => {
      const session = sessionRef.current;
      if (!session || commandPendingRef.current)
        throw new Error("请等待当前远征指令完成");
      commandPendingRef.current = true;
      const identity = {
        raidId: session.raidId,
        commandSeq: session.lastCommandSeq + 1,
      };
      try {
        const response =
          "status" in command
            ? await api.finishRaid({ ...command, ...identity })
            : await api.raidAction({ ...command, ...identity });
        sessionRef.current = response.raidLoadout.activeSession ?? null;
        return response;
      } finally {
        commandPendingRef.current = false;
      }
    },
    [],
  );

  const sendRaidAction = useCallback(
    (command: Omit<RaidActionReq, "raidId" | "commandSeq">) =>
      sendRaidCommand(command),
    [sendRaidCommand],
  );

  const triggerFinishRaid = useCallback(
    (status: "EXTRACTED" | "MIA") => {
      if (settlingRef.current || commandPendingRef.current) return;
      settlingRef.current = true;
      setChanneling(null);
      setShowLootModal(false);
      setPreStage("armory");

      void runAction(() => sendRaidCommand({ status })).finally(() => {
        settlingRef.current = false;
      });
    },
    [runAction, sendRaidCommand],
  );

  useEffect(() => {
    if (!inRaid || !activeRaidId) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(
        0,
        countdownDeadlineRef.current - performance.now(),
      );
      setTimeLeftMs(remaining);
      if (remaining === 0 && !commandPendingRef.current)
        triggerFinishRaid("MIA");

      setChanneling((cur) =>
        advanceChannelingProgress(cur, now, commandPendingRef.current),
      );
    }, 100);
    return () => window.clearInterval(id);
  }, [inRaid, activeRaidId, triggerFinishRaid]);

  useEffect(() => {
    if (
      !channeling ||
      channeling.progressPct < 100 ||
      commandPendingRef.current
    )
      return;
    const done = channeling;
    setChanneling(null);

    if (done.kind === "extract_early" || done.kind === "extract_deep") {
      triggerFinishRaid("EXTRACTED");
      return;
    }

    setShowLootModal(true);
    void runAction(() => sendRaidAction({ action: "open_chest" }));
  }, [channeling, triggerFinishRaid, runAction, sendRaidAction]);

  const zones = activeSession?.zones ?? [];
  const curZoneId = activeSession?.currentZoneId ?? 0;
  const currentZone = zones.find((zone) => zone.id === curZoneId);
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
  const usedPotions = useMemo(
    () => activeSession?.usedPotionKeys ?? [],
    [activeSession?.usedPotionKeys],
  );
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
      if (
        !inRaid ||
        !currentZone ||
        settlingRef.current ||
        commandPendingRef.current
      )
        return;
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

      void runAction(async () => {
        const resp = await sendRaidAction({ action: "move", dx, dy });
        const nextSess = resp.raidLoadout.activeSession;
        if (!nextSess) {
          setChanneling(null);
          setShowLootModal(false);
          return resp;
        }
        const nextZone = nextSess.zones.find(
          (zone) => zone.id === nextSess.currentZoneId,
        );
        const landed =
          nextZone?.tiles[nextSess.playerY * nextZone.width + nextSess.playerX];
        if (!landed) return resp;

        if (
          (isBossAlive && nextSess.activeChestDrops.length > 0) ||
          landed.kind === "merchant"
        ) {
          setShowLootModal(true);
        } else if (
          (landed.kind === "chest_wood" ||
            landed.kind === "chest_iron" ||
            landed.kind === "chest_coffin" ||
            landed.kind === "chest_abyss") &&
          !landed.looted
        ) {
          const dur = Math.max(1, nextSess.channelRemainingMs);
          setChanneling({
            label: CHEST_CHANNEL_LABELS[landed.kind] ?? "正在搜索容器",
            kind: landed.kind as RaidTileSpriteKind,
            x: nextSess.playerX,
            y: nextSess.playerY,
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
      runAction,
      sendRaidAction,
    ],
  );

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

  const handleUsePortal = useCallback(() => {
    if (!currentTile || currentTile.kind !== "portal") {
      return;
    }
    setChanneling(null);
    setShowLootModal(false);
    void runAction(() => sendRaidAction({ action: "use_portal" }));
  }, [currentTile, runAction, sendRaidAction]);

  const handleDrinkPotion = useCallback(
    (potKey: string) => {
      if (usedPotions.includes(potKey)) return;
      void runAction(() =>
        sendRaidAction({ action: "drink_potion", itemKey: potKey }),
      );
    },
    [usedPotions, runAction, sendRaidAction],
  );

  const transferItem = useCallback(
    (
      item: LootDrop,
      from: "chest" | "backpack" | "safebox",
      to: "backpack" | "safebox",
    ) => {
      if (from === to) return;
      if (to === "safebox" && safeBox.length >= raidLoadout.safeSlotCount)
        return;
      if (to === "backpack" && backpack.length >= raidLoadout.backpackCapacity)
        return;
      void runAction(() =>
        sendRaidAction({
          action: "transfer_loot",
          itemId: item.id,
          fromContainer: from,
          toContainer: to,
        }),
      );
    },
    [safeBox.length, backpack.length, raidLoadout, runAction, sendRaidAction],
  );

  const lootAllFromChest = useCallback(() => {
    if (activeChestDrops.length === 0) return;
    void runAction(() => sendRaidAction({ action: "loot_all" }));
  }, [activeChestDrops.length, runAction, sendRaidAction]);

  const handleMerchantBuy = useCallback(
    (offer: "heal" | "mystery_bp") => {
      void runAction(() =>
        sendRaidAction({ action: "merchant_buy", itemKey: offer }),
      );
    },
    [runAction, sendRaidAction],
  );

  const startExtractionChannel = useCallback(() => {
    if (!currentTile) return;
    setChanneling({
      label: "正在呼叫信标撤离",
      kind: currentTile.kind as RaidTileSpriteKind,
      x: pos.x,
      y: pos.y,
      startedAt: Date.now(),
      durationMs: Math.max(1, channelDeadlineRef.current - performance.now()),
      progressPct: 0,
    });
  }, [currentTile, pos.x, pos.y]);

  const serverReport = raidLoadout.lastSettlementReport ?? null;
  const reportKey = serverReport ? serverReport.raidId : "";
  const settlementReport =
    !inRaid && serverReport && dismissedSettlementRaidId !== reportKey
      ? serverReport
      : null;

  return {
    inRaid,
    preStage,
    setPreStage,
    armoryFacing,
    setArmoryFacing,
    gearTab,
    setGearTab,
    replaceSlotIdx,
    setReplaceSlotIdx,
    reportKey,
    settlementReport,
    setDismissedSettlementRaidId,
    facing,
    setFacing,
    timeLeftMs,
    lastMoveAtMs,
    showLootModal,
    setShowLootModal,
    draggedItem,
    setDraggedItem,
    channeling,
    setChanneling,
    zones,
    curZoneId,
    currentZone,
    pos,
    hp,
    maxHp,
    atk,
    def,
    effectiveMoveCooldownMs,
    usedPotions,
    backpack,
    safeBox,
    activeChestDrops,
    activeContainerTitle,
    raidLog,
    currentTile,
    handleStep,
    handleUsePortal,
    handleDrinkPotion,
    transferItem,
    lootAllFromChest,
    handleMerchantBuy,
    startExtractionChannel,
    triggerFinishRaid,
  };
}
