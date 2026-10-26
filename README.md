# Drop to Empire (滴水成城 · D2E)

**Drop to Empire (滴水成城)** is an authoritative web strategy and economic simulation game that evolves from a minimalist single-button water-gathering prologue into a coupled multi-resource settlement builder, a 2D multi-zone portal extraction roguelite, a global central limit order book (CLOB) spot market, and a daily 20:00 chamber territory war.

Built with the same engineering discipline as `teamie`, `drop2empire` enforces **Contract-First Thrift IDL code generation**, a **4-Layer Hexagonal Clean DDD** Go backend (`services/game`), **fixed-point monetary accounting**, **SSH-tunneled admin plane isolation**, and the **Blueprint & Ink** frontend design system (`apps/web`).

---

## Architecture Overview

```mermaid
flowchart LR
  Player["Player Browser (/)"] -->|HTTPS :8443| CaddyPub["Caddy Public Edge (:8443)"]
  Admin["Operator SSH Tunnel (/admin)"] -->|Loopback 127.0.0.1:18480| CaddyAdm["Caddy Admin Edge (:18480)"]

  CaddyPub -->|Static SPA| Web["React 19 Web Dist"]
  CaddyPub -->|/api/v1/empire/* (Blocks /admin/* -> 403)| Game["Game Service · Hertz (:8080)"]
  CaddyAdm -->|X-D2E-Admin-Tunnel: 1| Game

  Game -->|Transactional JSONB + Advisory Locks| PG[("PostgreSQL 17")]
```

### Core Engineering Principles

1. **Physical Admin Plane Isolation & Invitation-Only Onboarding**:
   - Public registration is strictly invitation-only (`D2E-XXXX-XXXX` single-use codes or `D2E_BOOTSTRAP_INVITE_CODE` for the first account).
   - The public HTTPS edge (`:8443`) rejects all `/admin*` and `/api/v1/empire/admin/*` traffic with `HTTP 403`. The operator console (`/admin`) is bound exclusively to host loopback (`127.0.0.1:18480`) and accessed via SSH local port forwarding (`ssh -L 18480:127.0.0.1:18480`).
2. **4-Layer Hexagonal Clean DDD**:
   - `services/game/internal` is partitioned into `domain` (Go standard library only), `app` (use-case & transaction orchestration), `adapter/http` (generated Hertz route bindings), and `infra/pg` (PostgreSQL persistence), guarded by AST-level architecture tests (`internal/arch_test.go`).
3. **Unified Thrift IDL Pipeline**:
   - [`contracts/game/http_empire.thrift`](contracts/game/http_empire.thrift) is the single source of truth for all HTTP DTOs and routes. Running `make gen` (`./ops/codegen.sh`) deterministically generates Go Hertz route binders (`contracts/gen/game`) and the TypeScript client SDK (`packages/api-client/src/generated.ts`).
4. **Authoritative Fixed-Point Accounting & Economic Isolation**:
   - Resources use integer `Milli` units (`1.000 = 1,000`) and currency uses integer `Basis` units (`1.0000 Gold = 10,000`), preserving the global Monetary Supply Identity including players, escrow, treasury, union reserves, public procurement, corporate wallets and IPO escrow.
   - The 2D Wasteland Extraction Roguelite is strictly isolated from settlement production: it consumes settlement resources and yields only non-producible tactical consumables, single-use tradable blueprints (`bp_*`), and ultra-low-drop-rate tradable seasonal cosmetics (`cos_*`).
5. **Blueprint & Ink Design System & Zero-Spoiler Progressive Disclosure**:
   - Design tokens (`apps/web/src/tokens.css`) and tabular monospace numerals (`.mono-num`) are enforced by automated tests (`design-tokens.test.ts`).
   - The opening stage (`Population == 0`) anchors the `[打水]` button in a fixed 3-slot grid so it never shifts or teleports, progressively unfolding settlement, wasteland raid, market, and war panels as milestones are unlocked.

---

## Product & Gameplay Capabilities

### 1. Coupled Settlement Production, Storage Siphon & Colony Edicts (Micro)
- **8-Resource Supply Chain & Procs**: Water (`💧`), Wood (`🪵`), Charcoal (`🔥` converted from Wood), Stone (`🪨`), Flint (`✨` deterministic proc from manual water clicks, logging, and quarrying), Ancient Shards (`🏺`), Iron Ingots (`⚙️` smelted from Stone + Charcoal), and Rations (`🍞`).
- **Upkeep, Storage Caps & 10:1 Overflow Siphon**: Residents consume `0.18 Water/s` (`-50%` non-water job efficiency if dehydrated). Unlocking **Siphon Sluice (`虹吸冲矿槽`)** automatically converts overflowing water at full storage into Stone (`10:1`) and Flint (`80:1`).
- **Real-Time Edicts & Caravan Barter**: Toggle **Night Shift (`篝火夜班令`)**, **Water Rationing (`节水配给制`)**, **Hydro Hammer (`水压联动水锤`)**, and trade surplus resources for refugees or relic caches at the **Caravan Post (`游商驿站`)**.

### 2. Wasteland 2D Multi-Zone Portal Extraction Roguelite (Micro & Seasonal)
- **4 Portal-Connected Biome Zones**: Each raid generates 4 distinct 2D grids (`外围·沙暴荒原 11×7`, `北境·断崖古矿坑 9×9`, `南境·枯木迷林 10×8`, `核心·沉没黑曜圣殿 8×8`) linked by interactive **Rift Portals (`🌀`)** with Fog of War.
- **Real-Time Sandstorm Countdown, Movement Rate Limits & Tiered Chest Channeling**:
  - Real-time countdown (`180s+`), movement cooldown rate limit (`360ms/格` base, accelerated down to `95~155ms/格` by equipping Boots, Potions, and Buff Cards), and 5-tier channeling progress bars (`破旧木箱 1.2s`, `铁皮军需箱 2.4s`, `远古机关石棺 4.0s`, `深渊黑曜秘宝库 6.2s`, `呼叫撤离信标 3.0s`).
- **Out-of-Raid Armory, Seasonal Safebox (`1→5 Slots`) & Single-Use Tradable Blueprints (`bp_*`)**:
  - T1 gear is crafted directly from settlement resources; T2/T3 Weapons, Armor, Boots, Potions, and Safeboxes require **single-use blueprints (`bp_*`)** looted in raids or bought on the Spot Market.
  - Learning a blueprint **destroys the blueprint item (`-1`)** and permanently unlocks crafting that gear for the current season. On raid death or timeout (`MIA`), worn gear and regular backpack loot are lost, while items placed inside the **Seasonal Safebox (`1→5 slots`)** are 100% preserved.
- **54 Pre-Departure Buff Cards**: 3-pick-1 draft with resource rerolls (max 4 carried) across 6 tactical categories (`time`, `vision`, `scavenge`, `offense`, `defense`, `tactical`), with zero guaranteed-cosmetic-drop cards.

### 3. Always-On Animated Lord Avatar (`LordAvatarSVG`) & S1 Cosmetics
- **12 Tradable S1 Animated Cosmetics (`cos_*`)**: Headgear, Mantle, Held Relic, and Floating Companion slots with strict low natural drop rates (`0.22%~0.85%` for Legendary items in Abyssal Vaults).
- **Dual Real-Time Projection**: Your equipped animated cartoon character renders both in the **always-visible Lord Profile & Wardrobe Bar** under the story banner AND **directly as your moving player token on the 2D Wasteland Raid grid**.

### 4. Professions, Companies, CLOB & Chamber War (Macro)
- **4 Professions, 12 Consumables**: Paid profession facilities and batch queues; exclusive manufacturing with universal purchase/use across production, building, exploration and guild support.
- **Price-Time Priority CLOB Market**: Trade resources, cross-profession devices, war gear, unlearned raid blueprints (`bp_*`), and S1 animated cosmetics (`cos_*`) with `1.00%` transaction tax (entirely transferred to treasury; currency cancellation requires explicit planner policy).
- **8-Node Chamber Territory War**: Obsidian vs. Argent 7-day war across an 8-node supply-line graph with Infantry/Archer/Cavalry counter-matrix (`1.15x / 0.90x`), daily 20:00 authoritative resolution, treasury gold stipends, and unique UV-etched procedural collectibles (`ProceduralRelicSVG`).

---

## Repository Structure

| Path | Description |
| :--- | :--- |
| [`contracts/`](contracts) | Canonical Thrift IDL (`game/http_empire.thrift`) and generated Go Hertz route module (`gen/game`) |
| [`pkg/`](pkg) | Shared Go technical packages (`postgres`, `httpx`, `observability`) |
| [`services/game/`](services/game) | 4-layer Clean DDD authoritative game service (`cmd/`, `internal/{domain,app,adapter,infra}`, `arch_test.go`) |
| [`packages/api-client/`](packages/api-client) | Typed browser HTTP client and Thrift-generated DTOs/routes (`src/generated.ts`) |
| [`apps/web/`](apps/web) | React 19 / TypeScript / Vite application (`App.tsx`, `WastelandRaidPanel.tsx`, `LordAvatarSVG.tsx`, `tokens.css`) |
| [`tools/`](tools) | Deterministic Thrift-to-Go HTTP router generator and Thrift-to-TypeScript SDK generator |
| [`deploy/`](deploy) | Production Docker Compose (`docker-compose.prod.yml`), dual-listener `Caddyfile`, and multi-stage Dockerfiles |
| [`ops/`](ops) | Code generation (`codegen.sh`), Clean DDD architecture check (`check-architecture.sh`), and Aliyun deployment (`deploy-aliyun.sh`) |
| [`docs/`](docs) | Modular architecture, HTTP contract, and 4D game design documentation (`01-overall`, `02-macro`, `03-micro`, `04-seasons`) |

---

## Verification & Production Delivery

```sh
# 1. Regenerate Go & TypeScript bindings from Thrift IDL
make gen

# 2. Verify 4-layer Clean DDD boundaries and zero uncommitted codegen drift
make check-arch

# 3. Run full Go (-race + go vet) and Web (tsc + eslint + vitest + vite build) verification suite
make test

# 4. Deploy to production (Caddy :8443 public HTTPS + 127.0.0.1:18480 SSH loopback admin)
make deploy
```

---

## Documentation Index

- **Engineering & Governance**
  - [Engineering Instructions & Invariants (`AGENTS.md`)](AGENTS.md)
  - [Contributing & Architecture Guide (`CONTRIBUTING.md`)](CONTRIBUTING.md)
  - [Documentation Master Index & 4D Taxonomy (`docs/README.md`)](docs/README.md)
- **Architecture & Contracts**
  - [System Overview & Plane Isolation (`docs/architecture/overview.md`)](docs/architecture/overview.md)
  - [Unified Thrift IDL & 4-Layer Clean DDD (`docs/architecture/ddd-idl.md`)](docs/architecture/ddd-idl.md)
  - [Empire HTTP API Contract (`docs/contracts/http-v1.md`)](docs/contracts/http-v1.md)
- **01 · Overall Design (整体设计 — 跨赛季恒定愿景与生命周期)**
  - [Core Vision, Pillars & Progressive Disclosure (`docs/design/01-overall/vision-and-pillars.md`)](docs/design/01-overall/vision-and-pillars.md)
  - [Three-Phase Lifecycle & Core Loops (`docs/design/01-overall/lifecycle-and-loops.md`)](docs/design/01-overall/lifecycle-and-loops.md)
- **02 · Macro Design (宏观设计 — 全服货币、市场、分工与领土战争)**
  - [Macro Monetary Ledger & CLOB Market (`docs/design/02-macro/monetary-and-clob-market.md`)](docs/design/02-macro/monetary-and-clob-market.md)
  - [Four-Profession Division & Economy Boundaries (`docs/design/02-macro/profession-and-economy-boundary.md`)](docs/design/02-macro/profession-and-economy-boundary.md)
  - [Chamber Territory War & 20:00 Settlement (`docs/design/02-macro/chamber-war-macro.md`)](docs/design/02-macro/chamber-war-macro.md)
- **03 · Micro Design (微观设计 — 单人聚落产线、2D 搜打撤肉鸽机制与动态形象)**
  - [Settlement Production, Storage Siphon, Edicts & Caravan (`docs/design/03-micro/settlement-production-and-edicts.md`)](docs/design/03-micro/settlement-production-and-edicts.md)
  - [Wasteland 2D Multi-Zone Portal Extraction Roguelite (`docs/design/03-micro/wasteland-2d-extraction-roguelite.md`)](docs/design/03-micro/wasteland-2d-extraction-roguelite.md)
  - [Animated Lord Avatar & Procedural Relics (`docs/design/03-micro/avatar-and-procedural-relics.md`)](docs/design/03-micro/avatar-and-procedural-relics.md)
- **04 · Seasonal Design (赛季设计 — 赛季重置法则与当季专属内容表)**
  - [Seasonal Lifecycle & Reset/Retention Boundary (`docs/design/04-seasons/season-framework.md`)](docs/design/04-seasons/season-framework.md)
  - [Season 1: Obsidian Awakening Catalog (`docs/design/04-seasons/s1-obsidian-awakening.md`)](docs/design/04-seasons/s1-obsidian-awakening.md)


## Persistent Economy Release

Six planner-introduced companies procure through real CLOB depth and form two interdependent industrial branches with alternative recipes. IPOs use existing cash, share trading pays sellers, weekly shareholder proposals govern prices, production, capital budgets and realized-profit dividends. A planner-controlled monetary union owns issuance, funded public procurement, recall and cancellation. No tutorial Gold grant, fabricated NPC liquidity or automatic minting remains.

Run `make simulate-economy` for the deterministic 14-day scenarios. See [calibration](docs/design/04-seasons/economy-calibration.md), [industry catalog](docs/design/04-seasons/s1-industry-catalog.md), and [clean-start rollout](docs/operations/economy-clean-start.md). This is a breaking **full clean-start** release; normal content-season rollover preserves financial rights.
