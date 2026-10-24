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
| `GET /api/v1/empire/state` | `GetDashboard` | Advances the player's settlement clock to `now` and returns the complete authoritative `DashboardStateResp`. |

---

## 2. Settlement Production, Edicts & Caravan Endpoints

| Method & Path | IDL Operation | Description |
| :--- | :--- | :--- |
| `POST /api/v1/empire/production/gather-water` | `GatherWater` | Records manual water clicks (`+1` or `+2` water per click, plus deterministic flint proc every 4 clicks after unlocking `first_resident`). |
| `POST /api/v1/empire/production/recruit` | `RecruitResident` | Spends water (`ceil(10 * 1.12^N)` below 40 residents, then the bounded-growth formula in the settlement spec), within housing capacity; auto-assigns new residents to water. Partial batches stop at resource/housing limits. |
| `POST /api/v1/empire/production/allocate` | `AllocateWorkers` | Reallocates workers across unlocked jobs (`delta`, `auto_balanced`, `water_focus`, `wood_focus`, `stone_focus`, or saved `preset`). |
| `POST /api/v1/empire/production/presets` | `SaveAllocationPreset` | Saves the current worker allocation distribution under a named preset. |
| `POST /api/v1/empire/settlement/research` | `ResearchTechnology` | `{code, commandSeq}`; consumes research materials once and grants construction knowledge only. |
| `POST /api/v1/empire/settlement/build` | `ConstructBuilding` | `{code, quantity, commandSeq}`; quantity 1–20, atomically pays the exact sum of per-building escalated prices, adds buildings/slots without assigning workers. |
| `POST /api/v1/empire/progression/unlock-blueprint` | `UnlockBlueprint` | Completes a one-time improvement or engineering project. Rejects building-effect codes; buildings must use ConstructBuilding. Assembly requires all three parts and awards 500 Gold once. |
| `POST /api/v1/empire/colony/toggle-edict` | `ToggleEdict` | Toggles a colony edict or hydro mechanism (`night_shift`, `water_ration`, `hydro_saw`, `siphon_sluice`). |
| `POST /api/v1/empire/colony/caravan/trade` | `TradeCaravan` | Executes a barter contract at the Caravan Post (`offer_flint_lumber`, `offer_wood_stone`, `offer_charcoal_shard`, `offer_refugee_escort`, `offer_shard_supply`); requires a built caravan post, discovered input/output resources and enough housing for population rewards. |
| `POST /api/v1/empire/progression/choose-profession` | `ChooseProfession` | Permanently selects one of the 4 professions (`scientist`, `alchemist`, `mage`, `artisan`) after unlocking `mystery_treasure`. |

---

## 3. Wasteland 2D Extraction Roguelite & Wardrobe Endpoints

| Method & Path | IDL Operation | Description |
| :--- | :--- | :--- |
| `POST /api/v1/empire/colony/cosmetic/equip` | `EquipCosmetic` | Equips or unequips an owned S1 animated cosmetic item (`headgear`, `mantle`, `held_relic`, `companion`) on the player's Lord Avatar. |
| `POST /api/v1/empire/colony/raid/learn-blueprint` | `LearnRaidBlueprint` | **Consumes and destroys (`-1`)** a single-use raid blueprint item (`bp_*`) from inventory to permanently unlock crafting that T2/T3 gear or safebox for the current season. |
| `POST /api/v1/empire/colony/raid/gear` | `ManageRaidGear` | Crafts (`action="craft"`) or equips (`action="equip"`) out-of-raid weapons, armor, boots, seasonal safeboxes (`1 -> 3 -> 5` slots), and tactical potions using settlement resources. |
| `POST /api/v1/empire/colony/raid/buff` | `DraftRaidBuff` | Selects (`action="pick"`) one of the 3 offered pre-departure buff cards (from the 54-card pool, max 4 carried) or spends settlement resources to reroll (`action="reroll"`). |
| `POST /api/v1/empire/colony/raid/start` | `StartRaid` | Generates an authoritative 4-zone 2D extraction session (`ActiveRaidSession`) on the server with fog-of-war clipping and real-time sandstorm expiration. |
| `POST /api/v1/empire/colony/raid/action` | `RaidAction` | Requires `raidId` and `commandSeq`; returns `RaidUpdateResp` with the current zone and authoritative loadout. Executes an in-raid intent (`move`, `open_chest`, `use_portal`, `transfer_loot`, `loot_all`, `drink_potion`, `merchant_buy`), resolving combat, fog reveal, and CSPRNG chest drops on the server. |
| `POST /api/v1/empire/colony/raid/finish` | `FinishRaid` | Requires `raidId` and `commandSeq`; returns `RaidUpdateResp`. Authoritatively settles raid extraction (`EXTRACTED`, verified against the exact beacon tile, full channel deadline and expiration) or death/timeout (`MIA`), awarding only server-recorded `SafeBox` / `Backpack` loot and destroying equipped weapon/armor/boots on `MIA`. |

---

## 4. Workshop, CLOB Spot Market & Chamber War Endpoints

| Method & Path | IDL Operation | Description |
| :--- | :--- | :--- |
| `POST /api/v1/empire/crafting/craft` | `CraftItem` | Crafts profession-exclusive devices or war armaments (`infantry_gear`, `archer_gear`, `cavalry_gear`) and pays the `2.0 Gold` crafting fee (`50%` burned, `50%` to treasury). |
| `POST /api/v1/empire/crafting/install` | `InstallEquipment` | Installs or removes a cross-profession device (`auto_pump`, `hermes_catalyst`, `astral_scroll`, `titan_tools`) in the player's 4-slot workshop rack. |
| `POST /api/v1/empire/market/orders` | `PlaceMarketOrder` | Places a `BID` or `ASK` limit order on the CLOB spot market (supports resources, crafted devices, war gear, **unlearned raid blueprints `bp_*`**, and **S1 animated cosmetics `cos_*`**). |
| `POST /api/v1/empire/market/orders/:id/cancel` | `CancelMarketOrder` | Cancels an open limit order and unfreezes escrowed gold or items. |
| `POST /api/v1/empire/war/guild` | `SwitchGuild` | Switches allegiance between Obsidian (`OBSIDIAN`) and Argent (`ARGENT`) chambers. |
| `POST /api/v1/empire/war/guild-action` | `GuildAction` | Executes a guild operation (`join`, `create`, `donate_supplies`, `donate_gold`, `set_rally`). |
| `POST /api/v1/empire/war/deploy` | `DeployWarTroops` | Deploys infantry, archer, and cavalry regiments under the player's joined Guild to a connected war node (up to 100 daily budget points; grants `+5` bonus activity points when deploying to the Guild's `rallyNodeId`). |
| `POST /api/v1/empire/season/redeem-chest` | `RedeemSeasonChest` | Spends `80` war activity points to mint a procedural UV-etched collectible relic (`S1·墨械典藏宝箱`). |

---

## 5. Loopback-Only Operator Admin Endpoints (`127.0.0.1:18480`)

Protected by Caddy loopback port isolation and `X-D2E-Admin-Tunnel: 1`:

| Method & Path | IDL Operation | Description |
| :--- | :--- | :--- |
| `POST /api/v1/empire/admin/invites` | `CreateInvite` | Generates a single-use registration invitation code (`D2E-XXXX-XXXX`). |
| `POST /api/v1/empire/admin/invites/:id/revoke` | `RevokeInvite` | Revokes an unused invitation code. |
| `POST /api/v1/empire/admin/sim` | `ControlSimulation` | Loopback-only simulation control; see the IDL request for supported actions. |
| `POST /api/v1/empire/war/settle` | `TriggerWarSettlement` | Manually triggers the daily 20:00 chamber war resolution and stipend distribution. |
| `POST /api/v1/empire/admin/season/rollover` | `RolloverSeason` | Executes cross-season settlement (`S1 -> S2`): resets settlement population/resources/blueprints, profession, gold, and learned raid blueprints (`bp_*`), while permanently retaining `cos_*` seasonal animated cosmetics and minted `Collectibles`. |
| `POST /api/v1/empire/admin/notices` | `PublishNotice` | Publishes an official Imperial Announcement (`title`, `effectiveIn`, `summary`, `demandShifts`) to all players' `seasonNotices` feed. |
| `POST /api/v1/empire/admin/benchmark-30m` | `RunBenchmark30m` | Runs three strategies against real domain commands, with a 60-minute safety limit. Reports completed/failureReason and actual duration; the legacy operation name is retained. |

## 6. Revision and raid command semantics

`DashboardStateResp.revision` and `RaidUpdateResp.revision` are monotonic per player, including resets. A raid update carries `playerHandle` and `raidLoadout`; `activeSession.zones` contains only the current zone. Merge zones by ID within the same `raidId`, reject older revisions and other-player patches. Fetch a full dashboard once after terminal settlement to refresh inventory. No map seed is sent in either response.

Every active session exposes an opaque `raidId`, `lastCommandSeq` and `channelRemainingMs`. The next command must use `lastCommandSeq + 1`. Retrying the latest command with identical content returns the current state without applying it again. A reused sequence with changed content, skipped sequence or different raid ID is rejected. The last 16 terminal command receipts are retained, so a delayed finish retry cannot settle a later raid. Older receipts outside that window fail closed. Missing IDs from obsolete clients are rejected; publish the generated SDK and server together.

The SDK retries a network-failed command once with identical content, then refreshes the dashboard if its result is still uncertain or the server reports a sequence conflict. A committed terminal receipt remains usable if the subsequent inventory refresh fails; normal settlement polling recovers that inventory. Session changes fence late responses.

`StartRaid` refuses to replace any active session, including an expired one: settle it as `MIA` first. Gear crafting/equipping/unequipping and buff drafting are locked until settlement. Movement refills at the full effective cooldown with at most one second of burst credit. Channels start on tile entry, reset on movement and use a frozen server deadline; exact sandstorm expiry is terminal. Unknown loot containers fail before removing items. Admission control precedes DB reads (20 commands/s per session with one second burst credit, 500/s per process, bounded 4096-entry cache, 4096-byte body limit).

## 7. Settlement construction state and retry semantics

`DashboardStateResp.settlement` is required and contains `commandSeq`, `housingCapacity`, filtered `technologies` and `buildings`, and the server-derived `guideCode/guideTitle/guideText`. Technology nodes distinguish researched from canResearch. Building nodes contain owned/limit, costs, assigned/totalSlots, canBuild and blockedReason. Research never creates buildings; construction never assigns workers. Worker jobs expose capacity, and every allocation mode enforces it. `CostItemDTO.capacityMilli` distinguishes a warehouse blocker from an ordinary material deficit; unreachable ETAs use -1.

Next research/build command uses `settlement.commandSeq + 1`. The latest sequence with identical code/action/quantity replays without charging or building again; a changed payload, stale/skipped sequence or reset-era request fails with `settlement_sequence_conflict`. A failed validation consumes no sequence or material. This receipt is committed with inventory/building state under the same database transaction. Resets increment the sequence and clear its signature. The SDK retries one network failure with the exact body, then synchronizes authoritative state on uncertainty/conflict; a user must issue a new action after synchronization. Session changes fence stale responses.

`BlueprintNodeDTO.kind` is building/upgrade/project. Legacy building milestones remain as completed-effect flags for old clients and game effects, but have visible=false and cannot be bought through UnlockBlueprint. The new UI lists only improvements/projects there. Buildings and technologies whose prerequisites are unknown are omitted. Resource discovery persists after stock reaches zero; caravan input and output resources must all be discovered.

Old player JSON is migrated idempotently to settlement version 2, preserving paid unlocks, population/job capacity, warehouse entitlements, balances and inventory without awarding currency. Deploy generated SDK and server together; do not run an older writer after version-2 state has been saved. Rollback requires a compatible forward fix or coordinated restore of the pre-release database snapshot, not only reverting the binary.
