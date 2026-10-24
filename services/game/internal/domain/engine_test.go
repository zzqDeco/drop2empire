package domain

import (
	"testing"
	"time"
)

func assertMacroLedgerIdentity(t *testing.T, w *WorldState) {
	t.Helper()
	var playerHeld, escrowHeld int64
	for _, p := range w.Players {
		playerHeld += p.GoldBasis
		escrowHeld += p.GoldFrozenBasis
	}
	sum := playerHeld + escrowHeld + w.NPCHeldBasis + w.TreasuryHeldBasis
	if sum != w.TotalIssuedBasis {
		t.Fatalf("monetary supply identity violated: sum(%d) != totalIssued(%d) [player=%d, escrow=%d, npc=%d, treasury=%d, burned=%d]",
			sum, w.TotalIssuedBasis, playerHeld, escrowHeld, w.NPCHeldBasis, w.TreasuryHeldBasis, w.PermanentlyBurnedBasis)
	}
}

func TestPhase1BenchmarksMatchGDD30MinModel(t *testing.T) {
	runs := RunPhase1Benchmarks()
	if len(runs) != 3 {
		t.Fatalf("expected 3 benchmark runs, got %d", len(runs))
	}
	base := runs[0]
	if base.TotalSeconds < 1750 || base.TotalSeconds > 1850 {
		t.Fatalf("expected GDD 4.4 baseline to complete around 30m (1750-1850s), got %s (%.1fs)", base.FormattedTotal, base.TotalSeconds)
	}
	parts := runs[1]
	if len(parts.Milestones) < 9 {
		t.Fatalf("expected intermediate treasure part milestones in balanced_parts run, got %d", len(parts.Milestones))
	}
}

func TestFullLoopProgressionMarketWarAndCollectibles(t *testing.T) {
	now := time.Date(2026, 10, 23, 12, 0, 0, 0, time.UTC)
	w := NewDefaultWorld(now)
	assertMacroLedgerIdentity(t, w)

	p := w.Players["pioneer"]
	if p.ResourcesMilli[ResWater] != 0 || p.PopulationTotal != 0 {
		t.Fatalf("expected pioneer to start at 0 water and 0 pop")
	}

	// 1. Click water 10 times -> recruit first resident
	for i := 0; i < 10; i++ {
		if err := GatherWater(p, 1, now); err != nil {
			t.Fatal(err)
		}
	}
	if err := RecruitResident(p, 1, now); err != nil {
		t.Fatal(err)
	}
	if p.PopulationTotal != 1 || p.Workers[JobWater] != 1 {
		t.Fatalf("expected 1 resident auto-assigned to water, got pop=%d waterWorkers=%d", p.PopulationTotal, p.Workers[JobWater])
	}

	// 2. Fast-forward and unlock Mystery Treasure on veteran or pioneer
	vet := w.Players["archon_demo"]
	initialTrades := len(w.Trades)

	// Place a BUY order that crosses an NPC ASK order on AutoPump (ASK @ 192000)
	if err := PlaceMarketOrder(w, vet, ResAutoPump, "BID", 195000, 1*ResourceScale, now); err != nil {
		t.Fatal(err)
	}
	if len(w.Trades) <= initialTrades {
		t.Fatal("expected market order to match resting NPC ask")
	}
	assertMacroLedgerIdentity(t, w)

	// Place a non-crossing BID order and cancel it
	if err := PlaceMarketOrder(w, vet, ResWood, "BID", 2000, 5*ResourceScale, now); err != nil {
		t.Fatal(err)
	}
	assertMacroLedgerIdentity(t, w)
	openID := w.Orders[0].ID
	if err := CancelMarketOrder(w, vet, openID, now); err != nil {
		t.Fatal(err)
	}
	assertMacroLedgerIdentity(t, w)

	// 3. Test Graph War connectivity & deployment
	// Obsidian owns node_west_base & node_west_outpost initially; cannot jump directly to node_east_base
	if err := DeployWarTroops(w, vet, "node_east_base", 2, 0, 0, now); err == nil {
		t.Fatal("expected deployment to disconnected enemy base to fail")
	}
	// Can deploy to node_north_fort (1 hop from node_west_outpost)
	if err := DeployWarTroops(w, vet, "node_north_fort", 4, 2, 2, now); err != nil {
		t.Fatalf("expected valid deployment to adjacent node_north_fort, got %v", err)
	}

	// 4. Trigger 20:00 War Settlement
	SettleWarDay(w, vet, now)
	assertMacroLedgerIdentity(t, w)
	if len(w.WarHistory) != 1 {
		t.Fatalf("expected 1 war history record, got %d", len(w.WarHistory))
	}

	// 5. Redeem and open Season Chest
	if err := RedeemSeasonChest(vet, 1, now); err != nil {
		t.Fatal(err)
	}
	if err := OpenSeasonChest(w, vet, 42, now); err != nil {
		t.Fatal(err)
	}
	if len(w.Collectibles) != 1 {
		t.Fatalf("expected 1 minted collectible, got %d", len(w.Collectibles))
	}
	c := w.Collectibles[0]
	if c.ItemID == "" || c.PatternSeed == 0 {
		t.Fatalf("invalid collectible minted: %+v", c)
	}
}

func TestColonyDepthSystemsConversionEdictsExpeditionsAndCaravan(t *testing.T) {
	now := time.Date(2026, 10, 24, 1, 0, 0, 0, time.UTC)
	w := NewDefaultWorld(now)
	p := w.Players["pioneer"]

	// Initial water cap is 250.000
	if cap := ResourceCapacityMilli(p, ResWater); cap != 250*ResourceScale {
		t.Fatalf("expected initial water cap 250000, got %d", cap)
	}

	// Unlock prerequisites up to Scout Camp, Charcoal Kiln, Siphon Sluice, and Colony Edicts
	p.PopulationTotal = 18
	p.Workers[JobWater] = 10
	p.Workers[JobWood] = 5
	p.Workers[JobCharcoal] = 3
	for _, code := range []string{
		BPFirstResident, BPAxeBlueprint, BPWaterCistern, BPScoutCamp,
		BPCharcoalKiln, BPColonyEdicts, BPQuarryTech, BPSiphonSluice, BPWaterWheel1,
	} {
		p.UnlockedBlueprints[code] = true
	}
	p.ActiveEdicts[EdictSiphonSluice] = true

	// Water cap should now be 2400 (from WaterWheel1)
	if cap := ResourceCapacityMilli(p, ResWater); cap != 2400*ResourceScale {
		t.Fatalf("expected water wheel cap 2400000, got %d", cap)
	}

	// Fill water to cap and advance 10 seconds: Siphon Sluice should convert overflow water into Stone + Flint,
	// while Charcoal Kiln converts Wood into Charcoal.
	p.ResourcesMilli[ResWater] = 2400 * ResourceScale
	p.ResourcesMilli[ResWood] = 200 * ResourceScale
	AdvancePlayerSeconds(p, 10)

	if p.ResourcesMilli[ResCharcoal] <= 0 {
		t.Fatalf("expected charcoal kiln to produce charcoal from wood, got %d", p.ResourcesMilli[ResCharcoal])
	}
	if p.ResourcesMilli[ResStone] <= 0 {
		t.Fatalf("expected siphon sluice to convert overflowing water into stone, got %d", p.ResourcesMilli[ResStone])
	}

	// Toggle Night Shift edict on and verify efficiency boost
	if err := ToggleEdict(p, EdictNightShift, now); err != nil {
		t.Fatal(err)
	}
	if !p.ActiveEdicts[EdictNightShift] {
		t.Fatal("expected night_shift edict to be active")
	}

	// Dispatch Wasteland Expedition (Woods route: 20s)
	if err := DispatchExpedition(p, ExpRouteWoods, now); err != nil {
		t.Fatal(err)
	}
	if p.ActiveExpedition == nil {
		t.Fatal("expected active expedition to be set")
	}
	AdvancePlayerSeconds(p, 25)
	if err := ClaimExpedition(p, now); err != nil {
		t.Fatal(err)
	}
	if p.ActiveExpedition != nil {
		t.Fatal("expected active expedition to be cleared after claim")
	}

	// Trade with Caravan using flint
	p.ResourcesMilli[ResFlint] = 10 * ResourceScale
	prevWood := p.ResourcesMilli[ResWood]
	if err := TradeCaravan(p, "offer_flint_lumber", now); err != nil {
		t.Fatal(err)
	}
	if p.ResourcesMilli[ResWood] <= prevWood {
		t.Fatalf("expected caravan barter to increase wood, prev=%d cur=%d", prevWood, p.ResourcesMilli[ResWood])
	}

	// Verify 54 buff card catalog and 3-card draft + 4-slot cap
	if len(RaidBuffCardCatalog) < 54 {
		t.Fatalf("expected at least 54 raid buff cards, got %d", len(RaidBuffCardCatalog))
	}
	EnsureRaidState(p)
	if len(p.RaidLoadout.DraftPoolCards) != 3 {
		t.Fatalf("expected 3 draft pool cards, got %d", len(p.RaidLoadout.DraftPoolCards))
	}
	p.ResourcesMilli[ResWater] = 15000 * ResourceScale
	p.ResourcesMilli[ResWood] = 15000 * ResourceScale
	p.ResourcesMilli[ResCharcoal] = 5000 * ResourceScale
	p.ResourcesMilli[ResStone] = 15000 * ResourceScale
	p.ResourcesMilli[ResFlint] = 500 * ResourceScale

	for i := 0; i < 5; i++ {
		pick := p.RaidLoadout.DraftPoolCards[0]
		if err := DraftRaidBuff(p, "buy", pick, 0, now); err != nil {
			t.Fatal(err)
		}
	}
	if len(p.RaidLoadout.EquippedBuffCards) != 4 {
		t.Fatalf("expected equipped buff cards capped at 4 slots, got %d", len(p.RaidLoadout.EquippedBuffCards))
	}

	// Test Tier 1 direct crafting & Tier 2 single-use blueprint learning
	if err := ManageRaidGear(p, "craft", "gear_wood_spear", now); err != nil {
		t.Fatal(err)
	}
	if err := ManageRaidGear(p, "craft", "gear_repeat_crossbow", now); err == nil {
		t.Fatal("expected crafting Tier 2 crossbow without learning blueprint to fail")
	}
	p.ResourcesMilli[ResBPCrossbow] = 1 * ResourceScale
	if err := LearnRaidBlueprint(p, ResBPCrossbow, now); err != nil {
		t.Fatal(err)
	}
	if p.ResourcesMilli[ResBPCrossbow] != 0 {
		t.Fatalf("expected single-use blueprint to be destroyed upon learning, remaining=%d", p.ResourcesMilli[ResBPCrossbow])
	}
	if err := ManageRaidGear(p, "craft", "gear_repeat_crossbow", now); err != nil {
		t.Fatalf("expected crafting crossbow after learning blueprint to succeed, got %v", err)
	}

	// Test StartRaid & FinishRaid (EXTRACTED vs MIA hardcore penalty)
	if err := StartRaid(p, now); err != nil {
		t.Fatal(err)
	}
	if err := FinishRaid(p, "EXTRACTED", []string{ResCosObsidianCrown, ResMeteorOre}, []string{ResAncientShard}, nil, 3, 5, 1, now); err != nil {
		t.Fatal(err)
	}
	if p.ResourcesMilli[ResCosObsidianCrown] < ResourceScale {
		t.Fatal("expected extracted S1 legendary cosmetic to be awarded")
	}
	if err := EquipCosmetic(p, "headgear", ResCosObsidianCrown, now); err != nil {
		t.Fatal(err)
	}

	// Start another raid and suffer MIA: equipped weapon is lost, backpack is lost, only Safe Box (1 slot) survives!
	if err := StartRaid(p, now); err != nil {
		t.Fatal(err)
	}
	prevMeteor := p.ResourcesMilli[ResMeteorOre]
	if err := FinishRaid(p, "MIA", []string{ResCosAstralWings}, []string{ResMeteorOre}, nil, 2, 3, 0, now); err != nil {
		t.Fatal(err)
	}
	if p.ResourcesMilli[ResCosAstralWings] != 0 {
		t.Fatal("expected backpack loot to be lost on MIA")
	}
	if p.ResourcesMilli[ResMeteorOre] != prevMeteor+ResourceScale {
		t.Fatal("expected safe box item to be preserved on MIA")
	}
	if p.RaidLoadout.WeaponKey != "" {
		t.Fatalf("expected equipped weapon to be destroyed on MIA, got %s", p.RaidLoadout.WeaponKey)
	}
}

func TestSeasonRolloverResetAndPermanentRetention(t *testing.T) {
	now := time.Date(2026, 10, 24, 2, 0, 0, 0, time.UTC)
	w := NewDefaultWorld(now)
	vet := w.Players["archon_demo"]

	// Mint a collectible in S1 and learn a raid blueprint + craft 3-slot safebox
	vet.ActivityPoints = 500
	if err := RedeemSeasonChest(vet, 1, now); err != nil {
		t.Fatal(err)
	}
	if err := OpenSeasonChest(w, vet, 777, now); err != nil {
		t.Fatal(err)
	}
	if len(w.Collectibles) != 1 {
		t.Fatalf("expected 1 collectible minted in S1, got %d", len(w.Collectibles))
	}
	vet.ResourcesMilli[ResBPCipherSafe] = 1 * ResourceScale
	if err := LearnRaidBlueprint(vet, ResBPCipherSafe, now); err != nil {
		t.Fatal(err)
	}

	// Execute Cross-Season Rollover -> S2
	RolloverSeason(w, "S2 · 星陨深渊与以太觉醒", now.Add(24*time.Hour))
	assertMacroLedgerIdentity(t, w)

	if w.SeasonNumber != 2 || w.SeasonName != "S2 · 星陨深渊与以太觉醒" {
		t.Fatalf("unexpected season metadata after rollover: num=%d name=%s", w.SeasonNumber, w.SeasonName)
	}
	// Reset checks
	if vet.PopulationTotal != 0 || vet.Profession != ProfNone || vet.GoldBasis != 0 {
		t.Fatalf("expected settlement pop, profession, and gold to reset on rollover: pop=%d prof=%s gold=%d",
			vet.PopulationTotal, vet.Profession, vet.GoldBasis)
	}
	if vet.LearnedRaidBlueprints[ResBPCipherSafe] {
		t.Fatal("expected learned seasonal raid blueprints to reset on rollover")
	}
	if vet.ResourcesMilli[ResWater] != 0 || vet.ResourcesMilli[ResIronIngot] != 0 {
		t.Fatal("expected physical settlement resources to reset on rollover")
	}
	// Permanent retention checks
	if vet.ResourcesMilli[ResCosSteamCrown] < ResourceScale || vet.EquippedCosmetics["headgear"] != ResCosSteamCrown {
		t.Fatalf("expected S1 animated cosmetics and equipped wardrobe to be permanently retained across seasons")
	}
	if len(w.Collectibles) != 1 || w.Collectibles[0].OwnerHandle != "archon_demo" {
		t.Fatalf("expected minted procedural collectibles to be permanently retained across seasons")
	}
}

func TestGuildSystemAndRallyBonus(t *testing.T) {
	now := time.Date(2026, 10, 24, 3, 0, 0, 0, time.UTC)
	w := NewDefaultWorld(now)
	p := w.Players["pioneer"]
	p.Profession = ProfArtisan
	p.ResourcesMilli[ResWater] = 500 * ResourceScale
	p.ResourcesMilli[ResWood] = 500 * ResourceScale
	p.ResourcesMilli[ResStone] = 500 * ResourceScale
	p.ResourcesMilli[ResInfantryKit] = 10 * ResourceScale

	// Cannot deploy troops before joining/creating a guild
	if err := DeployWarTroops(w, p, "node_north_fort", 2, 0, 0, now); err == nil {
		t.Fatal("expected DeployWarTroops without guild to fail")
	}

	// Create a new guild under ARGENT
	if err := PerformGuildAction(w, p, "create", "", "星穹铁匠盟", "STAR", GuildArgent, "", now); err != nil {
		t.Fatal(err)
	}
	if p.JoinedGuildID == "" || p.GuildCode != GuildArgent {
		t.Fatalf("expected pioneer to join newly created ARGENT guild, got id=%s code=%s", p.JoinedGuildID, p.GuildCode)
	}

	// Donate supplies and set rally node
	if err := PerformGuildAction(w, p, "donate_supplies", "", "", "", "", "", now); err != nil {
		t.Fatal(err)
	}
	if err := PerformGuildAction(w, p, "set_rally", "", "", "", "", "node_east_fort", now); err != nil {
		t.Fatal(err)
	}

	prevPts := p.ActivityPoints
	if err := DeployWarTroops(w, p, "node_east_fort", 2, 0, 0, now); err != nil {
		t.Fatal(err)
	}
	if p.ActivityPoints != prevPts+5 {
		t.Fatalf("expected +5 rally bonus activity points, got %d -> %d", prevPts, p.ActivityPoints)
	}
	assertMacroLedgerIdentity(t, w)
}
