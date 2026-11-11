import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  ApiError,
  type DashboardStateResp,
  type RaidActionReq,
  type RaidLootItemDTO,
} from "@drop2empire/api-client";
import { advanceChannelingProgress, type ServerUpdate } from "../serverState";
import type { FacingDirection } from "../LordAvatarSVG";
import type { RaidTileSpriteKind } from "../RaidSpritesSVG";
import {
  CHEST_CHANNEL_LABELS,
  EARLY_EXTRACT_CUTOFF_MS,
} from "../config/gameConfig";

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
  runAction: (
    fn: () => Promise<ServerUpdate>,
    msg?: string,
    scope?: string,
  ) => Promise<void>,
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
  const [galeLeftMs, setGaleLeftMs] = useState(0);
  const [scavLeftMs, setScavLeftMs] = useState(0);
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
  const serverGaleRemMs = activeSession?.galeRemainingMs ?? 0;
  const serverScavRemMs = activeSession?.scavRemainingMs ?? 0;
  const countdownDeadlineRef = useRef(0);
  const galeDeadlineRef = useRef(0);
  const scavDeadlineRef = useRef(0);
  const serverFacing = activeSession?.facing ?? "right";

  useEffect(() => {
    if (!inRaid || !activeRaidId) {
      setChanneling(null);
      setShowLootModal(false);
      setGaleLeftMs(0);
      setScavLeftMs(0);
      settlingRef.current = false;
      return;
    }
    const nowPerf = performance.now();
    countdownDeadlineRef.current = nowPerf + serverTimeRemMs;
    galeDeadlineRef.current = nowPerf + serverGaleRemMs;
    scavDeadlineRef.current = nowPerf + serverScavRemMs;
    setTimeLeftMs(serverTimeRemMs);
    setGaleLeftMs(serverGaleRemMs);
    setScavLeftMs(serverScavRemMs);
    if (
      serverFacing === "up" ||
      serverFacing === "down" ||
      serverFacing === "left" ||
      serverFacing === "right"
    ) {
      setFacing(serverFacing);
    }
    settlingRef.current = false;
  }, [
    inRaid,
    activeRaidId,
    serverTimeRemMs,
    serverGaleRemMs,
    serverScavRemMs,
    serverFacing,
  ]);

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
        if (
          "action" in command &&
          (command.action === "move" || command.action === "use_consumable")
        ) {
          const next = sessionRef.current;
          const zone = next?.zones.find((z) => z.id === next.currentZoneId);
          const tile =
            next && zone
              ? zone.tiles[next.playerY * zone.width + next.playerX]
              : undefined;
          channelDeadlineRef.current =
            performance.now() + (next?.channelRemainingMs ?? 0);
          setChanneling((current) => {
            if (!next || !tile) return null;
            const chest = tile.kind.startsWith("chest_") && !tile.looted;
            if (chest) {
              return {
                label: CHEST_CHANNEL_LABELS[tile.kind] ?? "正在搜索容器",
                kind: tile.kind as RaidTileSpriteKind,
                x: next.playerX,
                y: next.playerY,
                startedAt: Date.now(),
                durationMs: Math.max(1, next.channelRemainingMs),
                progressPct: 0,
              };
            }
            const isExtractTile =
              tile.kind === "extract_deep" ||
              (tile.kind === "extract_early" &&
                next.timeRemainingMs >= EARLY_EXTRACT_CUTOFF_MS);
            if (command.action === "move" && isExtractTile) {
              return {
                label: CHEST_CHANNEL_LABELS[tile.kind] ?? "正在引导撤离信标",
                kind: tile.kind as RaidTileSpriteKind,
                x: next.playerX,
                y: next.playerY,
                startedAt: Date.now(),
                durationMs: Math.max(1, next.channelRemainingMs) + 60,
                progressPct: 0,
              };
            }
            const continuingExtraction =
              current &&
              (tile.kind === "extract_early" || tile.kind === "extract_deep") &&
              current.kind === tile.kind &&
              current.x === next.playerX &&
              current.y === next.playerY;
            if (continuingExtraction) {
              return {
                ...current,
                startedAt: Date.now(),
                durationMs: Math.max(1, next.channelRemainingMs),
                progressPct: 0,
              };
            }
            return null;
          });
        }
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

      void runAction(
        async () => {
          try {
            return await sendRaidCommand({ status });
          } catch (err: unknown) {
            const isIncomplete =
              status === "EXTRACTED" &&
              ((err instanceof ApiError &&
                err.code === "channeling_incomplete") ||
                (err instanceof Error &&
                  (err.message.includes("channeling_incomplete") ||
                    err.message.includes("读条") ||
                    err.message.includes("引导"))));
            if (isIncomplete) {
              await new Promise((resolve) => window.setTimeout(resolve, 260));
              return await sendRaidCommand({ status });
            }
            throw err;
          }
        },
        undefined,
        "raid:finish",
      ).finally(() => {
        settlingRef.current = false;
      });
    },
    [runAction, sendRaidCommand],
  );

  useEffect(() => {
    if (!inRaid || !activeRaidId) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      const nowPerf = performance.now();
      const remaining = Math.max(0, countdownDeadlineRef.current - nowPerf);
      setTimeLeftMs(remaining);
      setGaleLeftMs(Math.max(0, galeDeadlineRef.current - nowPerf));
      setScavLeftMs(Math.max(0, scavDeadlineRef.current - nowPerf));
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
    void runAction(
      () => sendRaidAction({ action: "open_chest" }),
      undefined,
      "raid:chest",
    );
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
  const cheatDeathActive = Boolean(activeSession?.cheatDeathActive);
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

  const syncLandingInteraction = useCallback(
    (
      nextSess: NonNullable<DashboardStateResp["raidLoadout"]["activeSession"]>,
      wasBossAlive: boolean,
    ) => {
      const nextZone = nextSess.zones.find(
        (zone) => zone.id === nextSess.currentZoneId,
      );
      const landed =
        nextZone?.tiles[nextSess.playerY * nextZone.width + nextSess.playerX];
      if (!landed) return;

      if (
        (wasBossAlive && nextSess.activeChestDrops.length > 0) ||
        landed.kind === "merchant"
      ) {
        setShowLootModal(true);
      }
    },
    [],
  );

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

      void runAction(
        async () => {
          const resp = await sendRaidAction({ action: "move", dx, dy });
          const nextSess = resp.raidLoadout.activeSession;
          if (!nextSess) {
            setChanneling(null);
            setShowLootModal(false);
            return resp;
          }
          syncLandingInteraction(nextSess, isBossAlive);
          return resp;
        },
        undefined,
        "raid:step",
      );
    },
    [
      inRaid,
      currentZone,
      lastMoveAtMs,
      effectiveMoveCooldownMs,
      pos,
      runAction,
      sendRaidAction,
      syncLandingInteraction,
    ],
  );

  useEffect(() => {
    if (!inRaid) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (
        typeof document !== "undefined" &&
        document.querySelector(
          '[role="dialog"][aria-modal="true"]:not(.raid-loot-modal-backdrop)',
        ) !== null
      ) {
        return;
      }
      if (
        e.key === "b" ||
        e.key === "B" ||
        (!showLootModal && e.key === "Tab")
      ) {
        e.preventDefault();
        setShowLootModal((v) => !v);
        return;
      }
      if (showLootModal) {
        if (e.key === "Escape") {
          e.preventDefault();
          setShowLootModal(false);
        }
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
    void runAction(
      async () => {
        const resp = await sendRaidAction({ action: "use_portal" });
        const nextSess = resp.raidLoadout.activeSession;
        if (nextSess) {
          syncLandingInteraction(nextSess, false);
        }
        return resp;
      },
      undefined,
      "raid:portal",
    );
  }, [currentTile, runAction, sendRaidAction, syncLandingInteraction]);

  const handleDrinkPotion = useCallback(
    (potKey: string) => {
      if (usedPotions.includes(potKey)) return;
      void runAction(
        () => sendRaidAction({ action: "drink_potion", itemKey: potKey }),
        undefined,
        "raid:potion",
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
      void runAction(
        () =>
          sendRaidAction({
            action: "transfer_loot",
            itemId: item.id,
            fromContainer: from,
            toContainer: to,
          }),
        undefined,
        "raid:transfer",
      );
    },
    [safeBox.length, backpack.length, raidLoadout, runAction, sendRaidAction],
  );

  const lootAllFromChest = useCallback(() => {
    if (activeChestDrops.length === 0) return;
    void runAction(
      () => sendRaidAction({ action: "loot_all" }),
      undefined,
      "raid:loot",
    );
  }, [activeChestDrops.length, runAction, sendRaidAction]);

  const handleMerchantBuy = useCallback(
    (offer: "heal" | "mystery_bp") => {
      void runAction(
        () => sendRaidAction({ action: "merchant_buy", itemKey: offer }),
        undefined,
        "raid:merchant",
      );
    },
    [runAction, sendRaidAction],
  );

  const startExtractionChannel = useCallback(() => {
    if (!currentTile) return;
    const rem = channelDeadlineRef.current - performance.now();
    if (rem <= 0) {
      triggerFinishRaid("EXTRACTED");
      return;
    }
    setChanneling({
      label: CHEST_CHANNEL_LABELS[currentTile.kind] ?? "正在引导撤离信标",
      kind: currentTile.kind as RaidTileSpriteKind,
      x: pos.x,
      y: pos.y,
      startedAt: Date.now(),
      durationMs: Math.max(250, rem + 60),
      progressPct: 0,
    });
  }, [currentTile, pos.x, pos.y, triggerFinishRaid]);

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
    galeLeftMs,
    scavLeftMs,
    cheatDeathActive,
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
    sendRaidAction,
  };
}
