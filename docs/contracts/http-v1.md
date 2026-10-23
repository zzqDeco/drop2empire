# Empire HTTP API Contract (`http-v1`)

Canonical IDL: [`contracts/game/http_empire.thrift`](../../contracts/game/http_empire.thrift)  
Generated Go Binders: `contracts/gen/game/hertz_gen/game/empire`  
Generated TypeScript SDK: `packages/api-client/src/generated.ts`

---

## 1. Authentication & Session Boundary

All player endpoints authenticate via the `Authorization: Bearer <session_token>` header (or `X-Player-Handle` fallback in local automated tests).

| Method & Path | IDL Operation | Description |
| :--- | :--- | :--- |
| `POST /api/v1/empire/auth/register` | `RegisterAccount` | Registers a new account using a mandatory single-use `inviteCode` (`D2E-XXXX-XXXX` or bootstrap code when 0 users exist) and returns a session token + `DashboardStateResp`. |
| `POST /api/v1/empire/auth/login` | `LoginAccount` | Authenticates an existing handle + password and returns a session token + `DashboardStateResp`. |
| `POST /api/v1/empire/auth/logout` | `LogoutAccount` | Revokes the active session token. |
| `GET /api/v1/empire/state` | `GetDashboardState` | Advances the player's settlement clock to `now` and returns the complete authoritative `DashboardStateResp`. |

---

## 2. Settlement Production, Edicts & Caravan Endpoints

| Method & Path | IDL Operation | Description |
| :--- | :--- | :--- |
| `POST /api/v1/empire/water/gather` | `GatherWater` | Records manual water clicks (`+1` or `+2` water per click, plus deterministic flint proc every 4 clicks after unlocking `first_resident`). |
| `POST /api/v1/empire/residents/recruit` | `RecruitResident` | Spends water (`10 * 1.13^N`) to recruit residents; auto-assigns new residents to water gathering. |
| `POST /api/v1/empire/workers/allocate` | `AllocateWorkers` | Reallocates workers across unlocked jobs (`delta`, `auto_balanced`, `water_focus`, `wood_focus`, `stone_focus`, or saved `preset`). |
| `POST /api/v1/empire/workers/preset` | `SaveAllocationPreset` | Saves the current worker allocation distribution under a named preset. |
| `POST /api/v1/empire/blueprints/unlock` | `UnlockBlueprint` | Unlocks a settlement building/technology blueprint once population and resource requirements are met. |
| `POST /api/v1/empire/edicts/toggle` | `ToggleEdict` | Toggles a colony edict or hydro mechanism (`night_shift`, `water_ration`, `hydro_saw`, `siphon_sluice`). |
| `POST /api/v1/empire/caravan/trade` | `TradeCaravan` | Executes a barter contract at the Caravan Post (`offer_flint_lumber`, `offer_wood_stone`, `offer_charcoal_shard`, `offer_refugee_escort`, `offer_shard_supply`, `offer_mystery_cosmetic`). |
| `POST /api/v1/empire/profession/choose` | `ChooseProfession` | Permanently selects one of the 4 professions (`scientist`, `alchemist`, `mage`, `artisan`) after unlocking `mystery_treasure`. |

---

## 3. Wasteland 2D Extraction Roguelite & Wardrobe Endpoints

| Method & Path | IDL Operation | Description |
| :--- | :--- | :--- |
| `POST /api/v1/empire/cosmetics/equip` | `EquipCosmetic` | Equips or unequips an owned S1 animated cosmetic item (`headgear`, `mantle`, `held_relic`, `companion`) on the player's Lord Avatar. |
| `POST /api/v1/empire/raid/blueprint/learn` | `LearnRaidBlueprint` | **Consumes and destroys (`-1`)** a single-use raid blueprint item (`bp_*`) from inventory to permanently unlock crafting that T2/T3 gear or safebox for the current season. |
| `POST /api/v1/empire/raid/gear/manage` | `ManageRaidGear` | Crafts (`action="craft"`) or equips (`action="equip"`) out-of-raid weapons, armor, boots, seasonal safeboxes (`1 -> 3 -> 5` slots), and tactical potions using settlement resources. |
| `POST /api/v1/empire/raid/draft` | `DraftRaidBuff` | Selects (`action="pick"`) one of the 3 offered pre-departure buff cards (from the 54-card pool, max 4 carried) or spends settlement resources to reroll (`action="reroll"`). |
| `POST /api/v1/empire/raid/start` | `StartRaid` | Pays the departure water/resource cost and generates an authoritative `activeRaidSeed` for the 4-zone portal-connected 2D extraction map. |
| `POST /api/v1/empire/raid/finish` | `FinishRaid` | Authoritatively settles raid extraction (`EXTRACTED`) or death/timeout (`MIA`): on `MIA`, equipped weapon/armor/boots and regular backpack loot are lost, while items inside the seasonal safebox (`SafeSlotCount`) are preserved. |

---

## 4. Workshop, CLOB Spot Market & Chamber War Endpoints

| Method & Path | IDL Operation | Description |
| :--- | :--- | :--- |
| `POST /api/v1/empire/workshop/craft` | `CraftWorkshopItem` | Crafts profession-exclusive devices or war armaments (`infantry_gear`, `archer_gear`, `cavalry_gear`) and pays the `2.0 Gold` crafting fee (`50%` burned, `50%` to treasury). |
| `POST /api/v1/empire/equipment/toggle` | `ToggleEquipItem` | Installs or removes a cross-profession device (`auto_pump`, `hermes_catalyst`, `astral_scroll`, `titan_tools`) in the player's 4-slot workshop rack. |
| `POST /api/v1/empire/market/orders` | `PlaceMarketOrder` | Places a `BID` or `ASK` limit order on the CLOB spot market (supports resources, crafted devices, war gear, **unlearned raid blueprints `bp_*`**, and **S1 animated cosmetics `cos_*`**). |
| `POST /api/v1/empire/market/orders/cancel` | `CancelMarketOrder` | Cancels an open limit order and unfreezes escrowed gold or items. |
| `POST /api/v1/empire/war/chamber` | `SwitchChamber` | Switches allegiance between Obsidian (`obsidian`) and Argent (`argent`) chambers. |
| `POST /api/v1/empire/war/deploy` | `DeployTroops` | Deploys infantry, archer, and cavalry regiments to a connected war node (up to 100 daily budget points). |
| `POST /api/v1/empire/collectibles/mint` | `MintCollectibleBox` | Spends `80` war activity points to mint a procedural UV-etched collectible relic (`S1·墨械典藏宝箱`). |

---

## 5. Loopback-Only Operator Admin Endpoints (`127.0.0.1:18480`)

Protected by Caddy loopback port isolation and `X-D2E-Admin-Tunnel: 1`:

| Method & Path | IDL Operation | Description |
| :--- | :--- | :--- |
| `POST /api/v1/empire/admin/invites` | `CreateInvite` | Generates a single-use registration invitation code (`D2E-XXXX-XXXX`). |
| `POST /api/v1/empire/admin/invites/revoke` | `RevokeInvite` | Revokes an unused invitation code. |
| `POST /api/v1/empire/admin/fast-forward` | `FastForward` | Advances simulated world time for testing/benchmarking. |
| `POST /api/v1/empire/admin/speed` | `SetSpeedMultiplier` | Sets the server simulation speed multiplier (`1x`, `5x`, `20x`, `60x`). |
| `POST /api/v1/empire/admin/scenario` | `LoadScenario` | Loads a deterministic test fixture (`fresh_start`, `mid_phase1`, `workshop_ready`, `treasure_ready`, `empire_war`). |
| `POST /api/v1/empire/admin/reset` | `ResetWorld` | Resets the active test player state. |
| `POST /api/v1/empire/admin/war/settle` | `TriggerWarSettlement` | Manually triggers the daily 20:00 chamber war resolution and stipend distribution. |
| `POST /api/v1/empire/admin/season/rollover` | `RolloverSeason` | Executes cross-season settlement (`S1 -> S2`): resets settlement population/resources/blueprints, profession, gold, and learned raid blueprints (`bp_*`), while permanently retaining `cos_*` seasonal animated cosmetics and minted `Collectibles`. |
| `GET /api/v1/empire/admin/benchmark-30m` | `RunBenchmark30m` | Runs the deterministic 30-minute Phase 1 progression simulator across 3 reference strategies. |
