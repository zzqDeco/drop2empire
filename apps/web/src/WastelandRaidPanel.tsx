import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type DashboardStateResp,
  type RaidGearSpecDTO,
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

interface WastelandRaidPanelProps {
  state: DashboardStateResp;
  busy?: boolean;
  runAction: (
    fn: () => Promise<DashboardStateResp>,
    msg?: string,
  ) => Promise<void>;
}

type TileKind = RaidTileSpriteKind;

interface MapTile {
  x: number;
  y: number;
  kind: TileKind;
  searched?: boolean;
  defeated?: boolean;
  enemyHp?: number;
  enemyMaxHp?: number;
  enemyAtk?: number;
  enemyName?: string;
  portalTargetZone?: number;
  portalTargetX?: number;
  portalTargetY?: number;
  portalLabel?: string;
}

interface RaidZone {
  id: number;
  name: string;
  subtitle: string;
  width: number;
  height: number;
  tiles: MapTile[];
  explored: Set<string>;
}

export interface LootDrop {
  id: string;
  key: string;
  name: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
}

interface SettlementSummary {
  status: "EXTRACTED" | "MIA";
  extractedBag: LootDrop[];
  savedSafeBox: LootDrop[];
  zonesVisited: number;
  chestsOpened: number;
  bossesKilled: number;
}

const LOOT_META: Record<
  string,
  { name: string; rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY" }
> = {
  flint: { name: "燧石结晶", rarity: "COMMON" },
  ancient_shard: { name: "古文明残片", rarity: "RARE" },
  meteor_ore: { name: "星陨秘银", rarity: "EPIC" },
  bp_crossbow: { name: "★图纸：墨械连发手弩", rarity: "RARE" },
  bp_carapace_armor: { name: "★图纸：沙虫壳胸甲", rarity: "RARE" },
  bp_spring_boots: { name: "★图纸：墨械弹簧战靴", rarity: "RARE" },
  bp_cipher_safe: { name: "★图纸：墨械密码保险箱", rarity: "EPIC" },
  bp_scavenge_elixir: { name: "★图纸：速搜合剂配方", rarity: "RARE" },
  bp_titan_hammer: { name: "★★图纸：泰坦裂地重锤", rarity: "EPIC" },
  bp_hydro_armor: { name: "★★图纸：水压动力重甲", rarity: "EPIC" },
  bp_hermes_boots: { name: "★★图纸：赫尔墨斯风行靴", rarity: "EPIC" },
  bp_aether_safe: { name: "★★图纸：泰坦次元保险箱", rarity: "LEGENDARY" },
  bp_berserk_elixir: { name: "★★图纸：狂暴圣水配方", rarity: "EPIC" },
  cos_goggles: { name: "外观：荒原防风护目镜", rarity: "RARE" },
  cos_sand_cloak: { name: "外观：沙行旅人斗篷", rarity: "RARE" },
  cos_compass: { name: "外观：寻脉青铜罗盘", rarity: "RARE" },
  cos_wood_frog: { name: "外观：汲水发条木蛙", rarity: "RARE" },
  cos_steam_crown: { name: "外观：墨械蒸汽齿轮冠", rarity: "EPIC" },
  cos_hydro_wings: { name: "外观：阿基米德水翼背甲", rarity: "EPIC" },
  cos_alch_lantern: { name: "外观：赫尔墨斯荧光提灯", rarity: "EPIC" },
  cos_mech_owl: { name: "外观：炼金机械猫头鹰", rarity: "EPIC" },
  cos_obsidian_crown: { name: "★S1限定：曜石星辉王冠", rarity: "LEGENDARY" },
  cos_astral_wings: { name: "★S1限定：星界流光羽翼", rarity: "LEGENDARY" },
  cos_thunder_staff: { name: "★S1限定：泰坦雷鸣权杖", rarity: "LEGENDARY" },
  cos_aether_drake: { name: "★S1限定：星界以太幼龙", rarity: "LEGENDARY" },
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rollContainerLoot(
  rng: () => number,
  chestKind: TileKind,
): LootDrop[] {
  const drops: LootDrop[] = [];
  const makeDrop = (key: string): LootDrop => ({
    id: `${key}_${Math.random().toString(36).slice(2, 8)}`,
    key,
    name: LOOT_META[key]?.name ?? key,
    rarity: LOOT_META[key]?.rarity ?? "COMMON",
  });

  const r1 = rng();
  if (chestKind === "chest_wood") {
    drops.push(makeDrop("flint"));
    if (r1 < 0.25) drops.push(makeDrop("ancient_shard"));
  } else if (chestKind === "chest_iron") {
    drops.push(makeDrop("flint"));
    if (r1 < 0.35) drops.push(makeDrop("ancient_shard"));
    const r2 = rng();
    const t2Bps = [
      "bp_crossbow",
      "bp_carapace_armor",
      "bp_spring_boots",
      "bp_scavenge_elixir",
    ];
    const rareCos = [
      "cos_goggles",
      "cos_sand_cloak",
      "cos_compass",
      "cos_wood_frog",
    ];
    if (r2 < 0.008) {
      drops.push(makeDrop(rareCos[Math.floor(rng() * rareCos.length)]));
    } else if (r2 < 0.045) {
      drops.push(makeDrop(t2Bps[Math.floor(rng() * t2Bps.length)]));
    }
  } else if (chestKind === "chest_coffin") {
    drops.push(makeDrop("ancient_shard"));
    if (r1 < 0.2) drops.push(makeDrop("meteor_ore"));
    const r2 = rng();
    const midBps = [
      "bp_crossbow",
      "bp_carapace_armor",
      "bp_spring_boots",
      "bp_cipher_safe",
      "bp_scavenge_elixir",
    ];
    const epicCos = [
      "cos_steam_crown",
      "cos_hydro_wings",
      "cos_alch_lantern",
      "cos_mech_owl",
    ];
    if (r2 < 0.004) {
      drops.push(makeDrop(epicCos[Math.floor(rng() * epicCos.length)]));
    } else if (r2 < 0.068) {
      drops.push(makeDrop(midBps[Math.floor(rng() * midBps.length)]));
    }
  } else if (chestKind === "chest_abyss") {
    drops.push(makeDrop("ancient_shard"));
    if (r1 < 0.42) drops.push(makeDrop("meteor_ore"));
    const r2 = rng();
    const highBps = [
      "bp_titan_hammer",
      "bp_hydro_armor",
      "bp_hermes_boots",
      "bp_aether_safe",
      "bp_berserk_elixir",
      "bp_cipher_safe",
    ];
    const legCos = [
      "cos_obsidian_crown",
      "cos_astral_wings",
      "cos_thunder_staff",
      "cos_aether_drake",
    ];
    const epicCos = [
      "cos_steam_crown",
      "cos_hydro_wings",
      "cos_alch_lantern",
      "cos_mech_owl",
    ];
    if (r2 < 0.0015) {
      drops.push(makeDrop(legCos[Math.floor(rng() * legCos.length)]));
    } else if (r2 < 0.009) {
      drops.push(makeDrop(epicCos[Math.floor(rng() * epicCos.length)]));
    } else if (r2 < 0.095) {
      drops.push(makeDrop(highBps[Math.floor(rng() * highBps.length)]));
    }
  }
  return drops;
}

function generateMultiZoneWorld(seed: number): RaidZone[] {
  const rng = mulberry32(seed || 1337);

  const buildZone = (
    id: number,
    name: string,
    subtitle: string,
    width: number,
    height: number,
  ): RaidZone => {
    const tiles: MapTile[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        tiles.push({ x, y, kind: "empty" });
      }
    }
    return {
      id,
      name,
      subtitle,
      width,
      height,
      tiles,
      explored: new Set<string>(),
    };
  };

  const z0 = buildZone(0, "外围 · 沙暴荒原", "11×7 起始裂隙与游商营帐", 11, 7);
  const z1 = buildZone(1, "北境 · 断崖古矿坑", "9×9 矿脉与黑市", 9, 9);
  const z2 = buildZone(2, "南境 · 枯木迷林", "10×8 密林撤离区", 10, 8);
  const z3 = buildZone(3, "核心 · 沉没黑曜圣殿", "8×8 高危深渊禁区", 8, 8);

  const tileAt = (z: RaidZone, x: number, y: number) =>
    z.tiles[y * z.width + x];

  // Zone 0 setup (11x7) - Includes Caravan Tent right inside Zone 0 at (4,2) so players can encounter Caravan in-raid!
  tileAt(z0, 1, 3).kind = "spawn";
  tileAt(z0, 4, 2).kind = "merchant";
  tileAt(z0, 10, 1).kind = "extract_early";
  tileAt(z0, 9, 3).kind = "portal";
  tileAt(z0, 9, 3).portalTargetZone = 1;
  tileAt(z0, 9, 3).portalTargetX = 1;
  tileAt(z0, 9, 3).portalTargetY = 4;
  tileAt(z0, 9, 3).portalLabel = "传送至【断崖古矿坑】";

  tileAt(z0, 5, 6).kind = "portal";
  tileAt(z0, 5, 6).portalTargetZone = 2;
  tileAt(z0, 5, 6).portalTargetX = 4;
  tileAt(z0, 5, 6).portalTargetY = 1;
  tileAt(z0, 5, 6).portalLabel = "传送至【枯木迷林】";

  for (const t of z0.tiles) {
    if (t.kind !== "empty") continue;
    const r = rng();
    if (r < 0.13 && !(t.x === 2 && t.y === 3)) t.kind = "wall";
    else if (r < 0.25) t.kind = "chest_wood";
    else if (r < 0.31) t.kind = "chest_iron";
    else if (r < 0.39) {
      t.kind = "enemy_raider";
      t.enemyName = "荒原劫掠者";
      t.enemyHp = 38;
      t.enemyMaxHp = 38;
      t.enemyAtk = 9;
    }
  }

  // Zone 1 setup (9x9)
  tileAt(z1, 1, 4).kind = "portal";
  tileAt(z1, 1, 4).portalTargetZone = 0;
  tileAt(z1, 1, 4).portalTargetX = 9;
  tileAt(z1, 1, 4).portalTargetY = 3;
  tileAt(z1, 1, 4).portalLabel = "返回【沙暴荒原】";

  tileAt(z1, 7, 7).kind = "portal";
  tileAt(z1, 7, 7).portalTargetZone = 3;
  tileAt(z1, 7, 7).portalTargetX = 1;
  tileAt(z1, 7, 7).portalTargetY = 3;
  tileAt(z1, 7, 7).portalLabel = "深潜【沉没黑曜圣殿】";

  tileAt(z1, 4, 2).kind = "merchant";

  for (const t of z1.tiles) {
    if (t.kind !== "empty") continue;
    const r = rng();
    if (r < 0.15) t.kind = "wall";
    else if (r < 0.24) t.kind = "chest_iron";
    else if (r < 0.31) t.kind = "chest_coffin";
    else if (r < 0.41) {
      t.kind = "enemy_worm";
      t.enemyName = "岩甲沙虫";
      t.enemyHp = 65;
      t.enemyMaxHp = 65;
      t.enemyAtk = 14;
    }
  }

  // Zone 2 setup (10x8)
  tileAt(z2, 4, 1).kind = "portal";
  tileAt(z2, 4, 1).portalTargetZone = 0;
  tileAt(z2, 4, 1).portalTargetX = 5;
  tileAt(z2, 4, 1).portalTargetY = 6;
  tileAt(z2, 4, 1).portalLabel = "返回【沙暴荒原】";

  tileAt(z2, 8, 6).kind = "extract_deep";
  tileAt(z2, 2, 5).kind = "oasis";
  tileAt(z2, 8, 2).kind = "portal";
  tileAt(z2, 8, 2).portalTargetZone = 3;
  tileAt(z2, 8, 2).portalTargetX = 6;
  tileAt(z2, 8, 2).portalTargetY = 6;
  tileAt(z2, 8, 2).portalLabel = "深潜【沉没黑曜圣殿】";

  for (const t of z2.tiles) {
    if (t.kind !== "empty") continue;
    const r = rng();
    if (r < 0.14) t.kind = "wall";
    else if (r < 0.24) t.kind = "chest_wood";
    else if (r < 0.32) t.kind = "chest_iron";
    else if (r < 0.36) t.kind = "chest_coffin";
    else if (r < 0.44) {
      t.kind = "enemy_raider";
      t.enemyName = "迷林猎手";
      t.enemyHp = 52;
      t.enemyMaxHp = 52;
      t.enemyAtk = 12;
    }
  }

  // Zone 3 setup (8x8)
  tileAt(z3, 1, 3).kind = "portal";
  tileAt(z3, 1, 3).portalTargetZone = 1;
  tileAt(z3, 1, 3).portalTargetX = 7;
  tileAt(z3, 1, 3).portalTargetY = 7;
  tileAt(z3, 1, 3).portalLabel = "返回【断崖古矿坑】";

  tileAt(z3, 6, 6).kind = "portal";
  tileAt(z3, 6, 6).portalTargetZone = 2;
  tileAt(z3, 6, 6).portalTargetX = 8;
  tileAt(z3, 6, 6).portalTargetY = 2;
  tileAt(z3, 6, 6).portalLabel = "返回【枯木迷林】";

  tileAt(z3, 4, 3).kind = "enemy_boss";
  tileAt(z3, 4, 3).enemyName = "★墨械圣殿重装巨像";
  tileAt(z3, 4, 3).enemyHp = 135;
  tileAt(z3, 4, 3).enemyMaxHp = 135;
  tileAt(z3, 4, 3).enemyAtk = 22;

  tileAt(z3, 4, 1).kind = "chest_abyss";
  tileAt(z3, 6, 2).kind = "chest_abyss";
  tileAt(z3, 2, 6).kind = "chest_coffin";
  tileAt(z3, 7, 1).kind = "extract_deep";

  for (const t of z3.tiles) {
    if (t.kind !== "empty") continue;
    const r = rng();
    if (r < 0.12) t.kind = "wall";
    else if (r < 0.24) t.kind = "chest_coffin";
    else if (r < 0.34) {
      t.kind = "enemy_worm";
      t.enemyName = "黑曜巡逻傀儡";
      t.enemyHp = 78;
      t.enemyMaxHp = 78;
      t.enemyAtk = 16;
    }
  }

  return [z0, z1, z2, z3];
}

function getChestChannelMs(kind: TileKind, speedBuffActive: boolean): number {
  let base = 1100;
  if (kind === "chest_iron") base = 2200;
  else if (kind === "chest_coffin") base = 3600;
  else if (kind === "chest_abyss") base = 5400;
  else if (kind === "extract_early" || kind === "extract_deep") base = 2800;
  return speedBuffActive ? Math.floor(base * 0.5) : base;
}

export function WastelandRaidPanel({
  state,
  runAction,
}: WastelandRaidPanelProps) {
  const { raidLoadout, raidGears, equippedCosmetics } = state;
  const inRaid = raidLoadout.activeRaidSeed > 0;

  // 2-Stage Pre-Raid Progression: "armory" (Act 1) -> "draft" (Act 2)
  const [preStage, setPreStage] = useState<"armory" | "draft">("armory");
  const [armoryFacing, setArmoryFacing] = useState<FacingDirection>("down");
  const [gearTab, setGearTab] = useState<
    "all" | "weapon" | "armor" | "boots" | "safe_box" | "potion"
  >("all");
  const [replaceSlotIdx, setReplaceSlotIdx] = useState<number>(0);

  // Ceremonial Post-Raid Settlement Overlay State
  const [settlementReport, setSettlementReport] =
    useState<SettlementSummary | null>(null);

  // In-raid live 2D state
  const [zones, setZones] = useState<RaidZone[]>([]);
  const [curZoneId, setCurZoneId] = useState(0);
  const [pos, setPos] = useState({ x: 1, y: 3 });
  const [facing, setFacing] = useState<FacingDirection>("down");
  const [hp, setHp] = useState(100);
  const [maxHp, setMaxHp] = useState(100);
  const [atk, setAtk] = useState(12);
  const [def, setDef] = useState(2);
  const [cheatDeath, setCheatDeath] = useState(false);
  const [timeLeftMs, setTimeLeftMs] = useState(180000);
  const [lastMoveAtMs, setLastMoveAtMs] = useState(0);
  const [galeRemMs, setGaleRemMs] = useState(0);
  const [scavRemMs, setScavRemMs] = useState(0);
  const [usedPotions, setUsedPotions] = useState<string[]>([]);
  const [backpack, setBackpack] = useState<LootDrop[]>([]);
  const [safeBox, setSafeBox] = useState<LootDrop[]>([]);
  const [raidLog, setRaidLog] = useState<string[]>([]);
  const [zonesVisitedSet, setZonesVisitedSet] = useState<Set<number>>(
    () => new Set([0]),
  );
  const [chestsOpenedCount, setChestsOpenedCount] = useState(0);
  const [bossesKilledCount, setBossesKilledCount] = useState(0);

  // Hidden Backpack by default; opens on [B]/[Tab], button click, or when opening a chest / Caravan
  const [showLootModal, setShowLootModal] = useState(false);
  const [activeChestDrops, setActiveChestDrops] = useState<LootDrop[]>([]);
  const [activeContainerTitle, setActiveContainerTitle] =
    useState<string>("未开启容器");
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

  const rngRef = useRef<() => number>(() => Math.random());
  const settlingRef = useRef(false);

  const revealAround = useCallback(
    (zList: RaidZone[], zId: number, cx: number, cy: number) => {
      const target = zList[zId];
      if (!target) return zList;
      const radius = 2;
      const nextExplored = new Set(target.explored);
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < target.width && ny >= 0 && ny < target.height) {
            nextExplored.add(`${nx},${ny}`);
          }
        }
      }
      const next = [...zList];
      next[zId] = { ...target, explored: nextExplored };
      return next;
    },
    [],
  );

  // Initialize 2D multi-zone map when activeRaidSeed turns positive
  useEffect(() => {
    if (!inRaid) {
      setZones([]);
      setChanneling(null);
      setShowLootModal(false);
      setActiveChestDrops([]);
      settlingRef.current = false;
      return;
    }
    rngRef.current = mulberry32(raidLoadout.activeRaidSeed);
    const built = generateMultiZoneWorld(raidLoadout.activeRaidSeed);
    const revealed = revealAround(built, 0, 1, 3);
    setZones(revealed);
    setCurZoneId(0);
    setPos({ x: 1, y: 3 });
    setFacing("right");
    setHp(raidLoadout.totalMaxHp);
    setMaxHp(raidLoadout.totalMaxHp);
    setAtk(raidLoadout.totalAtk);
    setDef(raidLoadout.totalDef);
    setCheatDeath(false);
    setTimeLeftMs(raidLoadout.raidDurationSeconds * 1000);
    setGaleRemMs(0);
    setScavRemMs(0);
    setUsedPotions([]);
    setBackpack([]);
    setSafeBox([]);
    setActiveChestDrops([]);
    setShowLootModal(false);
    setZonesVisitedSet(new Set([0]));
    setChestsOpenedCount(0);
    setBossesKilledCount(0);
    setRaidLog([
      "已踏入【外围 · 沙暴荒原】全屏视野！按 WASD 或点击相邻格移动，平时背囊隐藏，搜索宝箱或按 [B] 键可呼出三栏摸金界面。",
    ]);
    settlingRef.current = false;
  }, [
    inRaid,
    raidLoadout.activeRaidSeed,
    raidLoadout.totalMaxHp,
    raidLoadout.totalAtk,
    raidLoadout.totalDef,
    raidLoadout.raidDurationSeconds,
    revealAround,
  ]);

  const triggerFinishRaid = useCallback(
    (status: "EXTRACTED" | "MIA") => {
      if (settlingRef.current) return;
      settlingRef.current = true;
      setChanneling(null);
      setShowLootModal(false);

      const summarySnapshot: SettlementSummary = {
        status,
        extractedBag: status === "EXTRACTED" ? [...backpack] : [],
        savedSafeBox: [...safeBox],
        zonesVisited: zonesVisitedSet.size,
        chestsOpened: chestsOpenedCount,
        bossesKilled: bossesKilledCount,
      };
      setSettlementReport(summarySnapshot);
      setPreStage("armory");

      void runAction(
        () =>
          api.finishRaid({
            status,
            backpackLootKeys: backpack.map((d) => d.key),
            safeBoxLootKeys: safeBox.map((d) => d.key),
            usedPotionKeys: usedPotions,
            zonesVisited: zonesVisitedSet.size,
            chestsOpened: chestsOpenedCount,
            bossesKilled: bossesKilledCount,
          }),
        status === "EXTRACTED"
          ? "凯旋归城！背囊与安全箱全部战利品已入库。"
          : "荒原迷失 (MIA)！仅安全保险箱内物资成功带回。",
      );
    },
    [
      backpack,
      safeBox,
      usedPotions,
      zonesVisitedSet,
      chestsOpenedCount,
      bossesKilledCount,
      runAction,
    ],
  );

  // Real-time countdown & channeling ticker (100ms)
  useEffect(() => {
    if (!inRaid || zones.length === 0) return;
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
      setGaleRemMs((prev) => (prev > 0 ? Math.max(0, prev - 100) : 0));
      setScavRemMs((prev) => (prev > 0 ? Math.max(0, prev - 100) : 0));

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
  }, [inRaid, zones.length, triggerFinishRaid]);

  // Complete channeling when progressPct reaches 100 -> Open 3-Column Looting Modal!
  useEffect(() => {
    if (!channeling || channeling.progressPct < 100) return;
    const done = channeling;
    setChanneling(null);

    if (done.kind === "extract_early" || done.kind === "extract_deep") {
      triggerFinishRaid("EXTRACTED");
      return;
    }

    const rolled = rollContainerLoot(rngRef.current, done.kind);
    setZones((prev) => {
      const z = prev[curZoneId];
      if (!z) return prev;
      const nextTiles = z.tiles.map((t) =>
        t.x === done.x && t.y === done.y ? { ...t, searched: true } : t,
      );
      const next = [...prev];
      next[curZoneId] = { ...z, tiles: nextTiles };
      return next;
    });
    setChestsOpenedCount((c) => c + 1);

    setActiveContainerTitle(done.label.replace("正在", ""));
    setActiveChestDrops(rolled);
    setShowLootModal(true);

    if (rolled.length === 0) {
      setRaidLog((prev) => [
        "开启了容器，内部空无一物。",
        ...prev.slice(0, 7),
      ]);
    } else {
      setRaidLog((l) => [
        `开启容器发现：${rolled.map((r) => r.name).join("、")}！拖拽或点击可收入背囊/保险箱。`,
        ...l.slice(0, 7),
      ]);
    }
  }, [channeling, curZoneId, triggerFinishRaid]);

  const effectiveMoveCooldownMs = useMemo(() => {
    const base = raidLoadout.moveCooldownMs || 360;
    if (galeRemMs > 0) {
      return Math.max(95, Math.floor(base * 0.65));
    }
    return base;
  }, [raidLoadout.moveCooldownMs, galeRemMs]);

  const currentZone = zones[curZoneId];
  const currentTile = useMemo(() => {
    if (!currentZone) return null;
    return currentZone.tiles[pos.y * currentZone.width + pos.x] ?? null;
  }, [currentZone, pos]);

  const handleStep = useCallback(
    (dx: number, dy: number) => {
      if (!inRaid || !currentZone || settlingRef.current) return;
      // Update 2.5D Minecraft Voxel character facing immediately even if rate-limited
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
      setActiveChestDrops([]);
      setPos({ x: nx, y: ny });
      setZones((prev) => revealAround(prev, curZoneId, nx, ny));

      if (
        (dest.kind === "enemy_raider" ||
          dest.kind === "enemy_worm" ||
          dest.kind === "enemy_boss") &&
        !dest.defeated
      ) {
        const eHp = dest.enemyHp ?? 50;
        const eAtk = dest.enemyAtk ?? 12;
        const playerDmg = Math.max(6, atk);
        const rounds = Math.ceil(eHp / playerDmg);
        const dmgPerRound = Math.max(2, eAtk - def);
        const totalTaken = Math.max(0, (rounds - 1) * dmgPerRound);

        const nextHp = hp - totalTaken;
        if (nextHp <= 0 && !cheatDeath) {
          setHp(0);
          triggerFinishRaid("MIA");
          return;
        }
        if (nextHp <= 0 && cheatDeath) {
          setCheatDeath(false);
          setHp(35);
          setRaidLog((l) => [
            `免死圣水触发！抵挡了【${dest.enemyName}】致命一击并反杀对手！`,
            ...l.slice(0, 7),
          ]);
        } else {
          setHp(nextHp);
        }

        setZones((prev) => {
          const z = prev[curZoneId];
          if (!z) return prev;
          const nextTiles = z.tiles.map((t) =>
            t.x === nx && t.y === ny ? { ...t, defeated: true } : t,
          );
          const next = [...prev];
          next[curZoneId] = { ...z, tiles: nextTiles };
          return next;
        });

        if (dest.kind === "enemy_boss") {
          setBossesKilledCount((c) => c + 1);
          const bossDrops = rollContainerLoot(rngRef.current, "chest_abyss");
          setActiveContainerTitle(`${dest.enemyName} · 首领战利品箱`);
          setActiveChestDrops(bossDrops);
          setShowLootModal(true);
          setRaidLog((l) => [
            `讨伐首领【${dest.enemyName}】（受创 -${totalTaken} HP），掉落战利品箱已展开！`,
            ...l.slice(0, 7),
          ]);
        } else {
          setRaidLog((l) => [
            `击溃【${dest.enemyName}】（受创 -${totalTaken} HP）。`,
            ...l.slice(0, 7),
          ]);
        }
      } else if (dest.kind === "oasis" && !dest.searched) {
        setHp((h) => Math.min(maxHp, h + 40));
        setTimeLeftMs((t) => t + 25000);
        setZones((prev) => {
          const z = prev[curZoneId];
          if (!z) return prev;
          const nextTiles = z.tiles.map((t) =>
            t.x === nx && t.y === ny ? { ...t, searched: true } : t,
          );
          const next = [...prev];
          next[curZoneId] = { ...z, tiles: nextTiles };
          return next;
        });
        setRaidLog((l) => [
          "饮用绿洲甘泉：生命 +40，沙暴倒计时延长 +25 秒！",
          ...l.slice(0, 7),
        ]);
      } else if (dest.kind === "merchant") {
        setActiveContainerTitle("荒原游商营帐 · 局内易物驿站");
        setShowLootModal(true);
        setRaidLog((l) => [
          "抵达【荒原游商营帐】！已展开游商货架与随身背囊。",
          ...l.slice(0, 7),
        ]);
      } else if (
        (dest.kind === "chest_wood" ||
          dest.kind === "chest_iron" ||
          dest.kind === "chest_coffin" ||
          dest.kind === "chest_abyss") &&
        !dest.searched
      ) {
        const dur = getChestChannelMs(dest.kind, scavRemMs > 0);
        const labelMap: Record<string, string> = {
          chest_wood: "正在搜索破旧木箱",
          chest_iron: "正在撬开铁皮军需箱",
          chest_coffin: "正在破译远古机关石棺",
          chest_abyss: "正在开启深渊黑曜秘宝库",
        };
        setChanneling({
          label: labelMap[dest.kind] ?? "正在搜索容器",
          kind: dest.kind,
          x: nx,
          y: ny,
          startedAt: Date.now(),
          durationMs: dur,
          progressPct: 0,
        });
      }
    },
    [
      inRaid,
      currentZone,
      lastMoveAtMs,
      effectiveMoveCooldownMs,
      pos,
      revealAround,
      curZoneId,
      atk,
      def,
      hp,
      cheatDeath,
      triggerFinishRaid,
      maxHp,
      scavRemMs,
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
    if (
      !currentTile ||
      currentTile.kind !== "portal" ||
      currentTile.portalTargetZone === undefined
    ) {
      return;
    }
    const tz = currentTile.portalTargetZone;
    const tx = currentTile.portalTargetX ?? 1;
    const ty = currentTile.portalTargetY ?? 1;
    setChanneling(null);
    setShowLootModal(false);
    setCurZoneId(tz);
    setPos({ x: tx, y: ty });
    setZonesVisitedSet((prev) => new Set([...prev, tz]));
    setZones((prev) => revealAround(prev, tz, tx, ty));
    setRaidLog((l) => [
      `穿越星盘传送门，抵达【${zones[tz]?.name ?? "未知区块"}】！`,
      ...l.slice(0, 7),
    ]);
  };

  const handleDrinkPotion = (potKey: string) => {
    if (usedPotions.includes(potKey)) return;
    setUsedPotions((prev) => [...prev, potKey]);
    if (potKey === "pot_heal_spring") {
      setHp((h) => Math.min(maxHp, h + 55));
      setTimeLeftMs((t) => t + 15000);
      setRaidLog((l) => [
        "饮用【清泉止血露】：生命 +55，时间 +15s！",
        ...l.slice(0, 7),
      ]);
    } else if (potKey === "pot_gale_stride") {
      setGaleRemMs(25000);
      setRaidLog((l) => [
        "饮用【轻身疾行散】：25秒内移动冷却缩短 35%！",
        ...l.slice(0, 7),
      ]);
    } else if (potKey === "pot_scavenge_elixir") {
      setScavRemMs(35000);
      setRaidLog((l) => [
        "饮用【巧手速搜合剂】：35秒内搜索宝箱读条缩短 50%！",
        ...l.slice(0, 7),
      ]);
    } else if (potKey === "pot_berserk_elixir") {
      setAtk((a) => a + 25);
      setDef((d) => d + 12);
      setCheatDeath(true);
      setRaidLog((l) => [
        "饮用【泰坦狂暴圣水】：攻击+25、护甲+12，并激活 1 次致命免死护盾！",
        ...l.slice(0, 7),
      ]);
    }
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

    if (from === "chest") {
      setActiveChestDrops((prev) => prev.filter((x) => x.id !== item.id));
    } else if (from === "backpack") {
      setBackpack((prev) => prev.filter((x) => x.id !== item.id));
    } else if (from === "safebox") {
      setSafeBox((prev) => prev.filter((x) => x.id !== item.id));
    }

    if (to === "safebox") {
      setSafeBox((prev) => [...prev, item]);
    } else {
      setBackpack((prev) => [...prev, item]);
    }
  };

  const lootAllFromChest = () => {
    if (activeChestDrops.length === 0) return;
    const remaining: LootDrop[] = [];
    const nextSafe = [...safeBox];
    const nextBag = [...backpack];

    for (const d of activeChestDrops) {
      if (
        (d.rarity === "LEGENDARY" || d.rarity === "EPIC") &&
        nextSafe.length < raidLoadout.safeSlotCount
      ) {
        nextSafe.push(d);
      } else if (nextBag.length < raidLoadout.backpackCapacity) {
        nextBag.push(d);
      } else if (nextSafe.length < raidLoadout.safeSlotCount) {
        nextSafe.push(d);
      } else {
        remaining.push(d);
      }
    }
    setSafeBox(nextSafe);
    setBackpack(nextBag);
    setActiveChestDrops(remaining);
  };

  const handleMerchantBuy = (offer: "heal" | "mystery_bp") => {
    if (offer === "heal") {
      const flintIdx = backpack.findIndex((i) => i.key === "flint");
      if (flintIdx < 0) return;
      setBackpack((b) => b.filter((_, idx) => idx !== flintIdx));
      setHp((h) => Math.min(maxHp, h + 65));
      setTimeLeftMs((t) => t + 30000);
      setRaidLog((l) => [
        "向荒原游商交付 1 枚燧石：恢复 +65 生命、延长 +30 秒时间！",
        ...l.slice(0, 7),
      ]);
    } else {
      const shardIdx = backpack.findIndex((i) => i.key === "ancient_shard");
      if (shardIdx < 0) return;
      setBackpack((b) => b.filter((_, idx) => idx !== shardIdx));
      const pool = [
        "bp_crossbow",
        "bp_carapace_armor",
        "bp_spring_boots",
        "bp_cipher_safe",
        "bp_titan_hammer",
        "cos_goggles",
        "cos_steam_crown",
      ];
      const pick = pool[Math.floor(rngRef.current() * pool.length)];
      const drop: LootDrop = {
        id: `${pick}_${Date.now()}`,
        key: pick,
        name: LOOT_META[pick]?.name ?? pick,
        rarity: LOOT_META[pick]?.rarity ?? "RARE",
      };
      setBackpack((b) => [...b.filter((_, idx) => idx !== shardIdx), drop]);
      setRaidLog((l) => [
        `游商盲盒开启：获得【${drop.name}】！`,
        ...l.slice(0, 7),
      ]);
    }
  };

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
                  安全保险箱带回 ({settlementReport.savedSafeBox.length} 件 ·
                  绝不掉落)
                </h4>
                <div className="loot-slot-grid">
                  {settlementReport.savedSafeBox.length === 0 ? (
                    <span className="muted-note">安全保险箱未存放物品</span>
                  ) : (
                    settlementReport.savedSafeBox.map((item) => (
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
                  随身背囊带出 ({settlementReport.extractedBag.length} 件)
                </h4>
                <div className="loot-slot-grid">
                  {settlementReport.extractedBag.length === 0 ? (
                    <span className="muted-note">
                      {isExtracted
                        ? "随身背囊未携带额外战利品"
                        : "随身背囊物资已在荒原迷失中损毁"}
                    </span>
                  ) : (
                    settlementReport.extractedBag.map((item) => (
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
                    onClick={() => setSettlementReport(null)}
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
    const earlyExtractOpen = timeLeftMs >= 80000;
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
                  const isExplored = currentZone.explored.has(
                    `${tile.x},${tile.y}`,
                  );

                  let tileTitle = "荒原空地";
                  let tileBadge = "";
                  if (!isExplored) tileTitle = "未探明战争迷雾";
                  else if (tile.kind === "wall")
                    tileTitle = "断崖岩壁（不可通行）";
                  else if (tile.kind === "spawn") {
                    tileTitle = "裂隙起点";
                    tileBadge = "起点";
                  } else if (tile.kind === "portal") {
                    tileTitle = tile.portalLabel ?? "区块星盘传送门";
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
                    tileBadge = tile.searched ? "" : "绿洲";
                  } else if (tile.kind === "chest_wood") {
                    tileTitle = "破旧木箱 (1.1s)";
                    tileBadge = tile.searched ? "" : "木箱";
                  } else if (tile.kind === "chest_iron") {
                    tileTitle = "铁皮军需箱 (2.2s)";
                    tileBadge = tile.searched ? "" : "军需";
                  } else if (tile.kind === "chest_coffin") {
                    tileTitle = "远古机关石棺 (3.6s)";
                    tileBadge = tile.searched ? "" : "石棺";
                  } else if (tile.kind === "chest_abyss") {
                    tileTitle = "深渊黑曜秘宝库 (5.4s)";
                    tileBadge = tile.searched ? "" : "秘宝";
                  } else if (
                    tile.kind === "enemy_raider" ||
                    tile.kind === "enemy_worm" ||
                    tile.kind === "enemy_boss"
                  ) {
                    tileTitle = `${tile.enemyName ?? "荒原敌军"} (HP ${tile.enemyHp} / 攻 ${tile.enemyAtk})`;
                    tileBadge = tile.defeated ? "" : `HP${tile.enemyHp}`;
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
                            kind={tile.kind}
                            searched={tile.searched}
                            defeated={tile.defeated}
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
                      <span>{currentTile.portalLabel ?? "踏入星盘传送门"}</span>
                    </button>
                  )}

                  {canExtractHere && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() =>
                        setChanneling({
                          label: "正在呼叫信标撤离 (2.8s)",
                          kind: currentTile.kind,
                          x: pos.x,
                          y: pos.y,
                          startedAt: Date.now(),
                          durationMs: getChestChannelMs(
                            currentTile.kind,
                            scavRemMs > 0,
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
                      onClick={() => {
                        setActiveContainerTitle("荒原游商营帐 · 局内易物驿站");
                        setShowLootModal(true);
                      }}
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
                  const isVis = zonesVisitedSet.has(z.id);
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
                    const isExp = currentZone.explored.has(`${t.x},${t.y}`);
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
                      !t.searched
                    )
                      cellCls = "minimap-chest";
                    else if (
                      (t.kind === "enemy_raider" ||
                        t.kind === "enemy_worm" ||
                        t.kind === "enemy_boss") &&
                      !t.defeated
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
                      (currentZone.explored.size / currentZone.tiles.length) *
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
