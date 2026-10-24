import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type DashboardStateResp,
  type RaidGearSpecDTO,
} from "@drop2empire/api-client";
import { Compass, Plus, RefreshCw, Shield, Sparkles, Swords } from "lucide-react";
import { ICON } from "./icons";
import { formatResource } from "./format";
import { LordAvatarSVG } from "./LordAvatarSVG";

interface WastelandRaidPanelProps {
  state: DashboardStateResp;
  busy?: boolean;
  runAction: (
    fn: () => Promise<DashboardStateResp>,
    msg?: string,
  ) => Promise<void>;
}

type TileKind =
  | "empty"
  | "wall"
  | "spawn"
  | "chest_wood"
  | "chest_iron"
  | "chest_coffin"
  | "chest_abyss"
  | "enemy_raider"
  | "enemy_worm"
  | "enemy_boss"
  | "merchant"
  | "oasis"
  | "portal"
  | "extract_early"
  | "extract_deep";

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

interface LootDrop {
  id: string;
  key: string;
  name: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
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

// Strict low drop rates so tradable blueprints & S1 cosmetics retain true market scarcity!
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
    // 1.2s search: mostly flint (45%), tiny chance of shard (6%)
    if (r1 < 0.45) drops.push(makeDrop("flint"));
    else if (r1 < 0.51) drops.push(makeDrop("ancient_shard"));
  } else if (chestKind === "chest_iron") {
    // 2.4s search: flint + shard (22%) + T2 blueprint (3.5%) + Rare cosmetic (0.8%)
    drops.push(makeDrop("flint"));
    if (r1 < 0.22) drops.push(makeDrop("ancient_shard"));
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
    } else if (r2 < 0.043) {
      drops.push(makeDrop(t2Bps[Math.floor(rng() * t2Bps.length)]));
    }
  } else if (chestKind === "chest_coffin") {
    // 4.0s search: Ancient Shard + Meteor Ore (14%) + Blueprint (6%) + Epic Cosmetic (0.4%)
    drops.push(makeDrop("ancient_shard"));
    if (r1 < 0.14) drops.push(makeDrop("meteor_ore"));
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
    } else if (r2 < 0.064) {
      drops.push(makeDrop(midBps[Math.floor(rng() * midBps.length)]));
    }
  } else if (chestKind === "chest_abyss") {
    // 6.2s Abyssal Vault: Shard + Meteor Ore (35%) + T3 Blueprint (8%) + S1 Legendary Cosmetic (0.15% ultra-rare!)
    drops.push(makeDrop("ancient_shard"));
    if (r1 < 0.35) drops.push(makeDrop("meteor_ore"));
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
    } else if (r2 < 0.089) {
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

  // 4 distinct portal-connected zones with different dimensions!
  const z0 = buildZone(0, "外围 · 沙暴荒原", "11×7 起始裂隙区", 11, 7);
  const z1 = buildZone(1, "北境 · 断崖古矿坑", "9×9 矿脉与黑市", 9, 9);
  const z2 = buildZone(2, "南境 · 枯木迷林", "10×8 密林撤离区", 10, 8);
  const z3 = buildZone(3, "核心 · 沉没黑曜圣殿", "8×8 高危深渊禁区", 8, 8);

  const tileAt = (z: RaidZone, x: number, y: number) =>
    z.tiles[y * z.width + x];

  // Zone 0 setup (11x7)
  tileAt(z0, 1, 3).kind = "spawn";
  tileAt(z0, 10, 1).kind = "extract_early"; // Closes when < 80s remaining
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

  // Populate Zone 0 obstacles, chests & raiders
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

  // Zone 1 setup (9x9) - Ancient Quarry + Mystery Merchant + Portal to Abyss (Zone 3)
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

  // Zone 2 setup (10x8) - Deadwood Labyrinth + Oasis + Permanent Extraction + Portal to Abyss
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

  // Zone 3 setup (8x8) - Sunken Obsidian Sanctum (Boss + Abyssal Vaults + Deep Extraction)
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
  let base = 1200;
  if (kind === "chest_iron") base = 2400;
  else if (kind === "chest_coffin") base = 4000;
  else if (kind === "chest_abyss") base = 6200;
  else if (kind === "extract_early" || kind === "extract_deep") base = 3000;
  return speedBuffActive ? Math.floor(base * 0.5) : base;
}

export function WastelandRaidPanel({
  state,
  runAction,
}: WastelandRaidPanelProps) {
  const { raidLoadout, raidGears, equippedCosmetics } = state;
  const inRaid = raidLoadout.activeRaidSeed > 0;

  // Out-of-raid UI filter state
  const [gearTab, setGearTab] = useState<
    "all" | "weapon" | "armor" | "boots" | "safe_box" | "potion"
  >("all");
  const [replaceSlotIdx, setReplaceSlotIdx] = useState<number>(0);

  // In-raid live 2D state
  const [zones, setZones] = useState<RaidZone[]>([]);
  const [curZoneId, setCurZoneId] = useState(0);
  const [pos, setPos] = useState({ x: 1, y: 3 });
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

  // Channeling progress bar for opening chests or extracting
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
      settlingRef.current = false;
      return;
    }
    rngRef.current = mulberry32(raidLoadout.activeRaidSeed);
    const built = generateMultiZoneWorld(raidLoadout.activeRaidSeed);
    const revealed = revealAround(built, 0, 1, 3);
    setZones(revealed);
    setCurZoneId(0);
    setPos({ x: 1, y: 3 });
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
    setZonesVisitedSet(new Set([0]));
    setChestsOpenedCount(0);
    setBossesKilledCount(0);
    setRaidLog([
      "已进入【外围 · 沙暴荒原】！使用 WASD/方向键或点击相邻格移动，踩上宝箱读条摸金，通过 🌀 传送门深入矿坑与圣殿。",
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
          ? "🚁 成功撤离荒原！背囊与安全箱全部战利品已存入主城仓库。"
          : "💀 荒原迷失 (MIA)！穿戴装备与背囊遗失，仅安全保险箱物品成功带回。",
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

  // Complete channeling when progressPct reaches 100
  useEffect(() => {
    if (!channeling || channeling.progressPct < 100) return;
    const done = channeling;
    setChanneling(null);

    if (done.kind === "extract_early" || done.kind === "extract_deep") {
      triggerFinishRaid("EXTRACTED");
      return;
    }

    // Complete chest scavenging
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

    if (rolled.length === 0) {
      setRaidLog((prev) => [
        "翻找了容器，里面只有风化的碎屑。",
        ...prev.slice(0, 7),
      ]);
      return;
    }

    setBackpack((prevBag) => {
      const combined = [...prevBag];
      const names: string[] = [];
      for (const item of rolled) {
        names.push(item.name);
        if (combined.length < raidLoadout.backpackCapacity) {
          combined.push(item);
        }
      }
      setRaidLog((l) => [
        `✨ 搜索完成！摸出：${names.join("、")}（可将贵重图纸/外观移入安全箱）`,
        ...l.slice(0, 7),
      ]);
      return combined;
    });
  }, [channeling, curZoneId, raidLoadout.backpackCapacity, triggerFinishRaid]);

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
      const now = Date.now();
      if (now - lastMoveAtMs < effectiveMoveCooldownMs) {
        return; // Rate limited by boot speed!
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
      setPos({ x: nx, y: ny });
      setZones((prev) => revealAround(prev, curZoneId, nx, ny));

      // Check automatic interactions on destination tile
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
            `🛡️ 免死圣水触发！抵挡了【${dest.enemyName}】的致命一击并反杀对手！`,
            ...l.slice(0, 7),
          ]);
        } else {
          setHp(nextHp);
        }

        // Mark enemy defeated & roll boss/elite drop
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
          if (bossDrops.length > 0) {
            setBackpack((b) =>
              [...b, ...bossDrops].slice(0, raidLoadout.backpackCapacity),
            );
            setRaidLog((l) => [
              `⚔️ 击败首领【${dest.enemyName}】（受创 -${totalTaken} HP），战利品：${bossDrops.map((d) => d.name).join("、")}！`,
              ...l.slice(0, 7),
            ]);
          }
        } else {
          setRaidLog((l) => [
            `⚔️ 击退【${dest.enemyName}】（受创 -${totalTaken} HP）。`,
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
          "💧 饮用绿洲甘泉：恢复 +40 生命值，沙暴倒计时延长 +25 秒！",
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
          chest_wood: "搜索破旧木箱",
          chest_iron: "撬开铁皮军需箱",
          chest_coffin: "破译远古机关石棺",
          chest_abyss: "开启深渊黑曜秘宝库",
        };
        setChanneling({
          label: labelMap[dest.kind] ?? "搜索容器",
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
      raidLoadout.backpackCapacity,
      maxHp,
      scavRemMs,
    ],
  );

  // Keyboard WASD / Arrow navigation for 2D map
  useEffect(() => {
    if (!inRaid) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
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
  }, [inRaid, handleStep]);

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
    setCurZoneId(tz);
    setPos({ x: tx, y: ty });
    setZonesVisitedSet((prev) => new Set([...prev, tz]));
    setZones((prev) => revealAround(prev, tz, tx, ty));
    setRaidLog((l) => [
      `🌀 穿越裂隙传送门，进入【${zones[tz]?.name ?? "未知区块"}】！`,
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
        "🧪 饮用【清泉止血露】：生命 +55，时间 +15s！",
        ...l.slice(0, 7),
      ]);
    } else if (potKey === "pot_gale_stride") {
      setGaleRemMs(25000);
      setRaidLog((l) => [
        "🧪 饮用【轻身疾行散】：25秒内移动冷却缩短 35%！",
        ...l.slice(0, 7),
      ]);
    } else if (potKey === "pot_scavenge_elixir") {
      setScavRemMs(35000);
      setRaidLog((l) => [
        "🧪 饮用【巧手速搜合剂】：35秒内搜索宝箱读条缩短 50%！",
        ...l.slice(0, 7),
      ]);
    } else if (potKey === "pot_berserk_elixir") {
      setAtk((a) => a + 25);
      setDef((d) => d + 12);
      setCheatDeath(true);
      setRaidLog((l) => [
        "🧪 饮用【泰坦狂暴圣水】：攻击+25、护甲+12，并激活 1 次致命免死护盾！",
        ...l.slice(0, 7),
      ]);
    }
  };

  const moveItemToSafeBox = (item: LootDrop) => {
    if (safeBox.length >= raidLoadout.safeSlotCount) return;
    setBackpack((b) => b.filter((x) => x.id !== item.id));
    setSafeBox((s) => [...s, item]);
  };

  const moveItemToBackpack = (item: LootDrop) => {
    if (backpack.length >= raidLoadout.backpackCapacity) return;
    setSafeBox((s) => s.filter((x) => x.id !== item.id));
    setBackpack((b) => [...b, item]);
  };

  const handleMerchantBuy = (offer: "heal" | "mystery_bp") => {
    if (offer === "heal") {
      const flintIdx = backpack.findIndex((i) => i.key === "flint");
      if (flintIdx < 0) return;
      setBackpack((b) => b.filter((_, idx) => idx !== flintIdx));
      setHp((h) => Math.min(maxHp, h + 65));
      setTimeLeftMs((t) => t + 30000);
      setRaidLog((l) => [
        "⛺ 向神秘商人交付 1 枚燧石：恢复 +65 生命、延长 +30 秒时间！",
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
        `⛺ 神秘商人盲盒开启：获得【${drop.name}】！`,
        ...l.slice(0, 7),
      ]);
    }
  };

  // ============================================================================
  // RENDER MODE A: IN-RAID 2D MULTI-ZONE PORTAL EXTRACTION MAP
  // ============================================================================
  if (inRaid && currentZone) {
    const earlyExtractOpen = timeLeftMs >= 80000;
    const canExtractHere =
      currentTile?.kind === "extract_deep" ||
      (currentTile?.kind === "extract_early" && earlyExtractOpen);

    return (
      <section className="panel" aria-label="荒原2D搜打撤战场">
        <div className="panel-header">
          <div className="panel-title">
            <Compass size={ICON.sm} />
            <h2>
              {currentZone.name} · {currentZone.subtitle}
            </h2>
          </div>
          <div className="quick-alloc-bar">
            <span className="tag-badge tag-warning mono-num">
              ⏱️ 沙暴倒计时 {(timeLeftMs / 1000).toFixed(1)}s
            </span>
            <span className="tag-badge mono-num">
              ❤️ {hp}/{maxHp}
            </span>
            <span className="tag-badge mono-num">⚔️ 攻 {atk}</span>
            <span className="tag-badge mono-num">🛡️ 甲 {def}</span>
            <span className="tag-badge mono-num">
              👢 移速 {effectiveMoveCooldownMs}ms/格
            </span>
          </div>
        </div>

        {channeling && (
          <div className="status-banner status-info" role="status">
            <span>
              ⏳ 正在{channeling.label}... ({channeling.progressPct}%)
            </span>
            <div className="opening-progress-bar">
              <div
                className="opening-progress-fill"
                style={{ width: `${channeling.progressPct}%` }}
              />
            </div>
          </div>
        )}

        <div className="split-2col">
          {/* Left: 2D Interactive Grid with Live Custom Avatar Token */}
          <div className="subpanel">
            <div className="subpanel-head">
              <h3>
                <span>
                  2D 迷雾战场（点击相邻格或按 WASD 移动 · 区块 {curZoneId + 1}/4）
                </span>
              </h3>
              <div className="quick-alloc-bar">
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => handleStep(0, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => handleStep(-1, 0)}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => handleStep(0, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => handleStep(1, 0)}
                >
                  →
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${currentZone.width}, minmax(38px, 1fr))`,
                gap: "4px",
                padding: "8px",
                background: "var(--surface-sunken)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--r-sm)",
              }}
            >
              {currentZone.tiles.map((tile) => {
                const isPlayer = tile.x === pos.x && tile.y === pos.y;
                const isAdjacent =
                  Math.abs(tile.x - pos.x) + Math.abs(tile.y - pos.y) === 1;
                const isExplored = currentZone.explored.has(
                  `${tile.x},${tile.y}`,
                );

                let glyph = "·";
                let tileTitle = "荒原空地";
                if (!isExplored) {
                  glyph = "░░";
                  tileTitle = "战争迷雾";
                } else if (tile.kind === "wall") {
                  glyph = "⛰️";
                  tileTitle = "断崖岩壁（不可通行）";
                } else if (tile.kind === "spawn") {
                  glyph = "🚪";
                  tileTitle = "裂隙起点";
                } else if (tile.kind === "portal") {
                  glyph = "🌀";
                  tileTitle = tile.portalLabel ?? "区块传送门";
                } else if (tile.kind === "extract_early") {
                  glyph = earlyExtractOpen ? "🚁" : "🚫";
                  tileTitle = earlyExtractOpen
                    ? "外围限时撤离点（开放中）"
                    : "外围限时撤离点（已关闭）";
                } else if (tile.kind === "extract_deep") {
                  glyph = "🚁";
                  tileTitle = "深处常驻撤离信标";
                } else if (tile.kind === "merchant") {
                  glyph = "⛺";
                  tileTitle = "荒原神秘商人";
                } else if (tile.kind === "oasis") {
                  glyph = tile.searched ? "·" : "💧";
                  tileTitle = "甘泉绿洲";
                } else if (tile.kind === "chest_wood") {
                  glyph = tile.searched ? "📭" : "📦";
                  tileTitle = "破旧木箱 (1.2s)";
                } else if (tile.kind === "chest_iron") {
                  glyph = tile.searched ? "📭" : "🧰";
                  tileTitle = "铁皮军需箱 (2.4s)";
                } else if (tile.kind === "chest_coffin") {
                  glyph = tile.searched ? "📭" : "⚰️";
                  tileTitle = "远古机关石棺 (4.0s)";
                } else if (tile.kind === "chest_abyss") {
                  glyph = tile.searched ? "📭" : "💎";
                  tileTitle = "深渊黑曜秘宝库 (6.2s)";
                } else if (
                  tile.kind === "enemy_raider" ||
                  tile.kind === "enemy_worm" ||
                  tile.kind === "enemy_boss"
                ) {
                  glyph = tile.defeated
                    ? "🦴"
                    : tile.kind === "enemy_boss"
                      ? "👹"
                      : "👾";
                  tileTitle = tile.enemyName ?? "荒原敌军";
                }

                return (
                  <button
                    key={`${tile.x}_${tile.y}`}
                    type="button"
                    title={tileTitle}
                    disabled={!isAdjacent || tile.kind === "wall"}
                    onClick={() =>
                      handleStep(tile.x - pos.x, tile.y - pos.y)
                    }
                    style={{
                      height: "48px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                      border: isPlayer
                        ? "2px solid var(--primary)"
                        : isAdjacent && tile.kind !== "wall"
                          ? "1px dashed var(--border-strong)"
                          : "1px solid var(--border)",
                      borderRadius: "var(--r-xs)",
                      background: isPlayer
                        ? "var(--warning-bg)"
                        : !isExplored
                          ? "var(--surface-sunken)"
                          : tile.kind === "wall"
                            ? "rgba(15,23,42,0.18)"
                            : "var(--surface)",
                      opacity: !isExplored ? 0.45 : 1,
                      cursor:
                        isAdjacent && tile.kind !== "wall"
                          ? "pointer"
                          : "default",
                    }}
                  >
                    {isPlayer ? (
                      <LordAvatarSVG
                        cosmetics={equippedCosmetics}
                        weaponKey={raidLoadout.weaponKey}
                        armorKey={raidLoadout.armorKey}
                        bootsKey={raidLoadout.bootsKey}
                        size="token"
                        isMoving
                      />
                    ) : (
                      <span className="mono-num">{glyph}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Tile Actions: Portal / Extraction / Mystery Merchant / Potions */}
            <div className="quick-alloc-bar">
              {currentTile?.kind === "portal" && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleUsePortal}
                >
                  🌀 {currentTile.portalLabel ?? "进入传送门"}
                </button>
              )}

              {canExtractHere && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() =>
                    setChanneling({
                      label: "呼叫信标撤离 (3.0s)",
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
                  🚁 读条呼叫撤离 (3.0s · 带走全部战利品)
                </button>
              )}

              {currentTile?.kind === "merchant" && (
                <>
                  <button
                    type="button"
                    className="btn-outline btn-sm"
                    disabled={!backpack.some((i) => i.key === "flint")}
                    onClick={() => handleMerchantBuy("heal")}
                  >
                    ⛺ 1燧石换急行补给 (+65HP/+30s)
                  </button>
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    disabled={!backpack.some((i) => i.key === "ancient_shard")}
                    onClick={() => handleMerchantBuy("mystery_bp")}
                  >
                    ⛺ 1残片抽神秘图纸/外观盲盒
                  </button>
                </>
              )}

              {raidLoadout.equippedPotions.map((potKey) => {
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
                    🧪 {spec?.name ?? potKey} {used ? "(已饮用)" : ""}
                  </button>
                );
              })}

              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => triggerFinishRaid("MIA")}
              >
                放弃撤离 (仅保安全箱)
              </button>
            </div>
          </div>

          {/* Right: Safe Container vs Raid Backpack & Live Combat/Scavenge Feed */}
          <div className="subpanel">
            <div className="subpanel-head">
              <h3>
                <Shield size={ICON.sm} />
                <span className="mono-num">
                  🔒 本赛季安全保险箱 ({safeBox.length}/{raidLoadout.safeSlotCount}
                  格 · 阵亡绝不掉落)
                </span>
              </h3>
            </div>
            <div className="preset-chips">
              {safeBox.length === 0 ? (
                <span className="muted-note">
                  点击下方背囊中的高价值图纸或赛季外观可移入安全保险箱
                </span>
              ) : (
                safeBox.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="btn-chip active"
                    onClick={() => moveItemToBackpack(item)}
                  >
                    🔒 {item.name} (移出)
                  </button>
                ))
              )}
            </div>

            <hr className="ink-divider" />

            <div className="subpanel-head">
              <h3>
                <Sparkles size={ICON.sm} />
                <span className="mono-num">
                  🎒 局内摸金背囊 ({backpack.length}/
                  {raidLoadout.backpackCapacity}格 · 需活着抵达 🚁 撤离点带出)
                </span>
              </h3>
            </div>
            <div className="preset-chips">
              {backpack.length === 0 ? (
                <span className="muted-note">
                  踩上地图中的 📦木箱 / 🧰军需箱 / ⚰️石棺 / 💎深渊秘宝库自动读条搜索
                </span>
              ) : (
                backpack.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="btn-chip"
                    onClick={() => moveItemToSafeBox(item)}
                  >
                    {item.name}{" "}
                    {safeBox.length < raidLoadout.safeSlotCount
                      ? "→ 存入安全箱"
                      : ""}
                  </button>
                ))
              )}
            </div>

            <hr className="ink-divider" />

            <div className="subpanel-head">
              <h3>
                <span>荒原行动日志</span>
              </h3>
            </div>
            <div className="blueprint-list">
              {raidLog.map((line, i) => (
                <div key={i} className="bp-card">
                  <p className="bp-desc">{line}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ============================================================================
  // RENDER MODE B: PRE-DEPARTURE LOADOUT, SINGLE-USE BLUEPRINTS & 54 BUFF CARDS
  // ============================================================================
  const filteredGears = raidGears.filter(
    (g) => gearTab === "all" || g.category === gearTab,
  );

  return (
    <section
      className="dashboard-grid dashboard-grid-2col"
      aria-label="荒原搜打撤整备与增益轮抽"
    >
      {/* Left Panel: Out-of-Raid Gear Loadout & Single-Use Tradable Blueprints */}
      <section className="panel" aria-label="斥候军械整备与蓝图">
        <div className="panel-header">
          <div className="panel-title">
            <Swords size={ICON.sm} />
            <h2>斥候局外整备（装备 · 保险箱 · 药水）</h2>
          </div>
          <span className="tag-badge mono-num">
            ❤️{raidLoadout.totalMaxHp} · ⚔️{raidLoadout.totalAtk} · 🛡️
            {raidLoadout.totalDef} · 👢{raidLoadout.moveCooldownMs}ms · 🔒
            {raidLoadout.safeSlotCount}格
          </span>
        </div>

        <div className="quick-alloc-bar">
          {(
            [
              ["all", "全部"],
              ["weapon", "⚔️ 武器"],
              ["armor", "🛡️ 护甲"],
              ["boots", "👢 战靴(移速)"],
              ["safe_box", "🔒 赛季安全箱"],
              ["potion", "🧪 战术药水"],
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
                {!g.recipeUnlocked && (
                  <span className="tag-badge tag-warning">
                    需研读：{g.blueprintName} (持有 {g.blueprintOwnedCount})
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
      </section>

      {/* Right Panel: 54-Card Pre-Departure Draft Pool + 4 Equip Slots + Launch 2D Raid */}
      <section className="panel" aria-label="行前增益卡轮抽与出发">
        <div className="panel-header">
          <div className="panel-title">
            <Compass size={ICON.sm} />
            <h2>行前增益卡轮抽（54 卡池 · 限带 4 槽）</h2>
          </div>
          <button
            type="button"
            className="btn-primary"
            data-pop="🚀 荒原启程"
            onClick={() => void runAction(() => api.startRaid())}
          >
            <Plus size={ICON.xs} />
            <span>🚀 启动 2D 荒原搜打撤</span>
          </button>
        </div>

        {/* Equipped 4 Buff Card Slots */}
        <div className="recruit-card">
          <div className="recruit-meta">
            <div className="recruit-head">
              <strong>
                已装配局内增益槽 ({raidLoadout.equippedBuffCards.length}/4)
              </strong>
              <span className="tag-badge mono-num">
                时限 {raidLoadout.raidDurationSeconds}s · 背囊{" "}
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
                    data-pop="移除增益"
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
                    [{slotIdx + 1}] {card.name} ×
                  </button>
                ) : (
                  <span key={slotIdx} className="cost-chip mono-num">
                    槽位 {slotIdx + 1}：空
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3-Card Random Draft Pool */}
        <div className="blueprint-list">
          {raidLoadout.draftPoolCards.map((card) => (
            <article
              key={card.cardCode}
              className={`bp-card ${card.canBuy ? "bp-ready" : ""}`}
            >
              <div className="bp-top">
                <div>
                  <strong>{card.name}</strong>
                  <span
                    className={`rarity-badge rarity-${card.rarity.toLowerCase()}`}
                  >
                    {card.rarity}
                  </span>
                </div>
                <span className="tag-badge">{card.category}</span>
              </div>
              <p className="bp-desc">{card.effectSummary}</p>
              <div className="bp-footer">
                <div className="bp-costs">
                  {card.costs.map((c) => {
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
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  data-pop={`+${card.name}`}
                  disabled={!card.canBuy}
                  onClick={() =>
                    void runAction(() =>
                      api.draftRaidBuff({
                        action: "buy",
                        cardCode: card.cardCode,
                        replaceSlot: replaceSlotIdx,
                      }),
                    )
                  }
                >
                  {raidLoadout.equippedBuffCards.length >= 4
                    ? `替换槽位 ${replaceSlotIdx + 1}`
                    : "购买装配"}
                </button>
              </div>
            </article>
          ))}

          <div className="recruit-card">
            <div className="bp-costs">
              {raidLoadout.rerollCosts.map((c) => {
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
            <button
              type="button"
              className="btn-outline btn-sm"
              data-pop="↻ 刷新增益池"
              disabled={!raidLoadout.canReroll}
              onClick={() =>
                void runAction(() => api.draftRaidBuff({ action: "reroll" }))
              }
            >
              <RefreshCw size={ICON.xs} />
              <span>刷新候选卡池</span>
            </button>
          </div>
        </div>
      </section>
    </section>
  );
}

export function LordProfileWardrobeBar({
  state,
  runAction,
}: {
  state: DashboardStateResp;
  busy?: boolean;
  runAction: (
    fn: () => Promise<DashboardStateResp>,
    msg?: string,
  ) => Promise<void>;
}) {
  const [showWardrobe, setShowWardrobe] = useState(true);
  const { player, equippedCosmetics, cosmetics, raidLoadout } = state;
  const ownedCosCount = cosmetics.filter((c) => c.ownedCount > 0).length;

  return (
    <section className="panel" aria-label="领主动态形象与赛季衣橱">
      <div className="water-hero-box">
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <LordAvatarSVG
            cosmetics={equippedCosmetics}
            weaponKey={raidLoadout.weaponKey}
            armorKey={raidLoadout.armorKey}
            bootsKey={raidLoadout.bootsKey}
            size="profile"
          />
          <div className="water-readout">
            <span className="water-label">
              👑 领主工程蚀刻立绘 · {player.handle}（{player.professionName}）
            </span>
            <span className="water-rate mono-num">
              S1 赛季外观典藏：{ownedCosCount} / {cosmetics.length} 件（荒原地图实时显形 · 可在市场交易 · 跨赛季永久保留）
            </span>
          </div>
        </div>
        <button
          type="button"
          className="btn-outline"
          onClick={() => setShowWardrobe((v) => !v)}
        >
          <Sparkles size={ICON.xs} />
          <span>{showWardrobe ? "收起衣橱" : "展开衣橱"}</span>
        </button>
      </div>

      {showWardrobe && (
        <div className="profession-grid">
          {cosmetics.map((cos) => (
            <article
              key={cos.itemKey}
              className={`bp-card ${cos.equipped ? "bp-ready" : ""}`}
            >
              <div className="bp-top">
                <div>
                  <strong>{cos.name}</strong>
                  <span
                    className={`rarity-badge rarity-${cos.rarity.toLowerCase()}`}
                  >
                    {cos.rarity}
                  </span>
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
                    cos.equipped ? "btn-outline btn-sm" : "btn-primary btn-sm"
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
      )}
    </section>
  );
}
