package domain

import (
	"strings"
	"testing"
	"time"
)

func TestZeroGoldArmamentCraftAndEquipmentRebalance(t *testing.T) {
	now := time.Date(2026, 11, 14, 2, 0, 0, 0, time.UTC)
	w := NewEmptyWorld(now)
	p := NewBlankPlayer("zero_gold_lord", now)
	p.Profession = ProfScientist
	p.UnlockedBlueprints[BPBasicWorkshop] = true
	p.GoldBasis = 0
	p.ResourcesMilli[ResWater] = 2_000 * ResourceScale
	p.ResourcesMilli[ResWood] = 2_000 * ResourceScale
	p.ResourcesMilli[ResStone] = 1_000 * ResourceScale
	p.ResourcesMilli[ResIronIngot] = 20 * ResourceScale
	p.ResourcesMilli[ResRation] = 30 * ResourceScale
	w.Players[p.Handle] = p

	for _, code := range []string{"craft_infantry_kit", "craft_archer_kit", "craft_cavalry_kit"} {
		if err := CraftItem(w, p, code, 1, now); err != nil {
			t.Fatalf("expected 0-Gold clean-start player to craft %s, got %v", code, err)
		}
	}
	if p.ResourcesMilli[ResInfantryKit] != 2*ResourceScale ||
		p.ResourcesMilli[ResArcherKit] != 2*ResourceScale ||
		p.ResourcesMilli[ResCavalryKit] != 2*ResourceScale {
		t.Fatalf("unexpected armament output: %+v", p.ResourcesMilli)
	}

	for _, rc := range CraftRecipeCatalog {
		if rc.Category == "profession" {
			if rc.CostsMilli[ResIronIngot] < 8*ResourceScale {
				t.Fatalf("expected %s to require >= 8 iron ingots, got %d milli", rc.RecipeCode, rc.CostsMilli[ResIronIngot])
			}
		}
	}
	for _, eq := range EquipmentCatalog {
		if eq.MaxStack != 3 {
			t.Fatalf("expected %s MaxStack=3, got %d", eq.ItemKey, eq.MaxStack)
		}
	}

	p.ResourcesMilli[ResAutoPump] = 4 * ResourceScale
	if err := InstallEquipment(p, ResAutoPump, 3, now); err != nil {
		t.Fatalf("expected installing 3 stacks to succeed, got %v", err)
	}
	if err := InstallEquipment(p, ResAutoPump, 1, now); err == nil {
		t.Fatal("expected 4th stack of permanent equipment to be rejected")
	}
}

func TestCleanStarterGuildsAndFirstPioneerLeadership(t *testing.T) {
	now := time.Date(2026, 11, 14, 2, 0, 0, 0, time.UTC)
	w := NewEmptyWorld(now)
	if len(w.Guilds) != 4 {
		t.Fatalf("expected 4 starter guilds, got %d", len(w.Guilds))
	}
	for _, g := range w.Guilds {
		if g.Level != 1 || g.XP != 0 || len(g.Members) != 0 {
			t.Fatalf("starter guild %s has non-clean state: level=%d xp=%d members=%v", g.GuildID, g.Level, g.XP, g.Members)
		}
	}

	p1 := NewBlankPlayer("first_lord", now)
	p2 := NewBlankPlayer("second_lord", now)
	w.Players[p1.Handle] = p1
	w.Players[p2.Handle] = p2

	if err := PerformGuildAction(w, p1, "join", "guild_obsidian_vanguard", "", "", "", "", now); err != nil {
		t.Fatal(err)
	}
	if err := PerformGuildAction(w, p2, "join", "guild_obsidian_vanguard", "", "", "", "", now); err != nil {
		t.Fatal(err)
	}
	g := FindGuild(w, "guild_obsidian_vanguard")
	if g.LeaderHandle != "first_lord" || len(g.Members) != 2 || g.Members[0].Role != "会长" || g.Members[1].Role != "成员" {
		t.Fatalf("unexpected guild leadership assignment: leader=%s members=%+v", g.LeaderHandle, g.Members)
	}
}

func TestSymmetricWarGraphNeutralTieAndDailyScoreTie(t *testing.T) {
	now := time.Date(2026, 11, 14, 11, 0, 0, 0, time.UTC)
	w := NewEmptyWorld(now)
	if len(w.WarEdges) != 11 {
		t.Fatalf("expected 11 mirror-symmetric war edges, got %d", len(w.WarEdges))
	}

	obsDep := DeployableNodes(w, GuildObsidian)
	argDep := DeployableNodes(w, GuildArgent)
	if !obsDep["node_north_fort"] || !obsDep["node_south_ferry"] || obsDep["node_center_vault"] || obsDep["node_east_fort"] {
		t.Fatalf("unexpected Obsidian Day-1 deployable set: %+v", obsDep)
	}
	if !argDep["node_east_fort"] || !argDep["node_south_ferry"] || argDep["node_center_vault"] || argDep["node_north_fort"] {
		t.Fatalf("unexpected Argent Day-1 deployable set: %+v", argDep)
	}

	// Set up two mirror players on south_ferry with identical breakthrough force
	obsLord := NewBlankPlayer("obs_lord", now)
	obsLord.Profession = ProfArtisan
	obsLord.ResourcesMilli[ResInfantryKit] = 30 * ResourceScale
	w.Players[obsLord.Handle] = obsLord
	if err := PerformGuildAction(w, obsLord, "join", "guild_obsidian_iron", "", "", "", "", now); err != nil {
		t.Fatal(err)
	}

	argLord := NewBlankPlayer("arg_lord", now)
	argLord.Profession = ProfArtisan
	argLord.ResourcesMilli[ResInfantryKit] = 30 * ResourceScale
	w.Players[argLord.Handle] = argLord
	if err := PerformGuildAction(w, argLord, "join", "guild_argent_hermes", "", "", "", "", now); err != nil {
		t.Fatal(err)
	}

	if err := DeployWarTroops(w, obsLord, "node_south_ferry", 30, 0, 0, now); err != nil {
		t.Fatal(err)
	}
	if err := DeployWarTroops(w, argLord, "node_south_ferry", 30, 0, 0, now); err != nil {
		t.Fatal(err)
	}
	ptsBeforeObs := obsLord.ActivityPoints
	ptsBeforeArg := argLord.ActivityPoints

	SettleWarDay(w, obsLord, now.Add(2*time.Hour))
	if len(w.WarHistory) != 1 {
		t.Fatal("expected war settlement to run")
	}
	hist := w.WarHistory[0]
	if hist.ObsidianScoreDelta != 35 || hist.ArgentScoreDelta != 35 {
		t.Fatalf("expected symmetric 35:35 score delta on tied clash, got %d:%d", hist.ObsidianScoreDelta, hist.ArgentScoreDelta)
	}
	for _, n := range w.WarNodes {
		if n.NodeID == "node_south_ferry" && n.OwnerGuild != GuildNeutral {
			t.Fatalf("expected tied neutral node clash to remain NEUTRAL, got %s", n.OwnerGuild)
		}
	}
	// Both sides must receive identical WarTieBasePts (60) + 30*3 (90) + Lv.1*5 (5) = 155
	expectedDelta := MacroBalance.WarTieBasePts + 30*MacroBalance.WarPtsPerUnitDeployed + 1*MacroBalance.GuildWarPtsPerLvl
	if obsLord.ActivityPoints-ptsBeforeObs != expectedDelta || argLord.ActivityPoints-ptsBeforeArg != expectedDelta {
		t.Fatalf("expected symmetric +%d pts on tied war day, got obs=+%d arg=+%d",
			expectedDelta, obsLord.ActivityPoints-ptsBeforeObs, argLord.ActivityPoints-ptsBeforeArg)
	}
}

func TestGuildRallyCombatBonusAndLevelWarPoints(t *testing.T) {
	now := time.Date(2026, 11, 14, 11, 0, 0, 0, time.UTC)
	w := NewEmptyWorld(now)

	obsLord := NewBlankPlayer("obs_commander", now)
	obsLord.Profession = ProfScientist
	obsLord.ResourcesMilli[ResInfantryKit] = 30 * ResourceScale
	w.Players[obsLord.Handle] = obsLord
	if err := PerformGuildAction(w, obsLord, "join", "guild_obsidian_iron", "", "", "", "", now); err != nil {
		t.Fatal(err)
	}
	// Upgrade Obsidian guild to Lv.4 (+22% rally bonus vs Lv.1 Argent's +13%)
	obsGuild := FindGuild(w, "guild_obsidian_iron")
	obsGuild.Level = 4

	argLord := NewBlankPlayer("arg_commander", now)
	argLord.Profession = ProfScientist
	argLord.ResourcesMilli[ResInfantryKit] = 30 * ResourceScale
	w.Players[argLord.Handle] = argLord
	if err := PerformGuildAction(w, argLord, "join", "guild_argent_hermes", "", "", "", "", now); err != nil {
		t.Fatal(err)
	}

	// Both guilds rally node_south_ferry and deploy identical 25 infantry
	if err := DeployWarTroops(w, obsLord, "node_south_ferry", 25, 0, 0, now); err != nil {
		t.Fatal(err)
	}
	if err := DeployWarTroops(w, argLord, "node_south_ferry", 25, 0, 0, now); err != nil {
		t.Fatal(err)
	}

	var ferry WarNodeState
	for _, n := range w.WarNodes {
		if n.NodeID == "node_south_ferry" {
			ferry = n
			break
		}
	}
	if got := ActiveFactionRallyBonusPct(w, ferry, GuildObsidian); got != 22 {
		t.Fatalf("expected Lv.4 guild rally bonus 22%%, got %d%%", got)
	}
	if got := ActiveFactionRallyBonusPct(w, ferry, GuildArgent); got != 13 {
		t.Fatalf("expected Lv.1 guild rally bonus 13%%, got %d%%", got)
	}

	SettleWarDay(w, obsLord, now.Add(2*time.Hour))
	for _, n := range w.WarNodes {
		if n.NodeID == "node_south_ferry" && n.OwnerGuild != GuildObsidian {
			t.Fatalf("expected higher-level guild rally banner (+22%% vs +13%%) to win node_south_ferry, got %s", n.OwnerGuild)
		}
	}
}

func TestProRataTreasuryStipendConservesMoneyWithoutAlphabeticalStarvation(t *testing.T) {
	now := time.Date(2026, 11, 14, 11, 0, 0, 0, time.UTC)
	w := NewEmptyWorld(now)
	// Issue 130 Gold directly into Public, then tax/transfer or set Treasury via policy + trade;
	// easiest exact path: issue 130 Gold -> fund_public -> procure water -> donate_gold to Treasury!
	alice := NewBlankPlayer("alice", now)
	alice.Profession = ProfScientist
	alice.ResourcesMilli[ResWater] = 200 * ResourceScale
	alice.ResourcesMilli[ResInfantryKit] = 10 * ResourceScale
	w.Players[alice.Handle] = alice

	zoe := NewBlankPlayer("zoe", now)
	zoe.Profession = ProfArtisan
	zoe.ResourcesMilli[ResInfantryKit] = 10 * ResourceScale
	w.Players[zoe.Handle] = zoe

	mustEconomy(t, ApplyMonetaryPolicy(w, MonetaryPolicy{ID: "iss", Action: "issue", Amount: 100 * GoldScale}, now))
	mustEconomy(t, ApplyMonetaryPolicy(w, MonetaryPolicy{ID: "pub", Action: "fund_public", Amount: 100 * GoldScale}, now))
	mustEconomy(t, PlaceMarketOrder(w, alice, ResWater, "ASK", GoldScale, 100*ResourceScale, now))
	mustEconomy(t, ApplyMonetaryPolicy(w, MonetaryPolicy{ID: "buy", Action: "procure", Item: ResWater, Price: GoldScale, Quantity: 100 * ResourceScale}, now))

	mustEconomy(t, PerformGuildAction(w, alice, "join", "guild_obsidian_vanguard", "", "", "", "", now))
	mustEconomy(t, PerformGuildAction(w, zoe, "join", "guild_argent_astral", "", "", "", "", now))
	// Alice donates 50G twice? Alice received 99G after 1% tax (Treasury has 1G), so 1x donate_gold puts 51G in Treasury!
	mustEconomy(t, PerformGuildAction(w, alice, "donate_gold", "", "", "", "", "", now))
	aliceBefore := alice.GoldBasis
	treasuryBefore := w.TreasuryHeldBasis // 51.0000 G (< 120G want per player, < 240G totalWant!)
	if treasuryBefore != 51*GoldScale {
		t.Fatalf("expected 51G in treasury, got %d basis", treasuryBefore)
	}

	mustEconomy(t, DeployWarTroops(w, alice, "node_north_fort", 10, 0, 0, now))
	mustEconomy(t, DeployWarTroops(w, zoe, "node_east_fort", 10, 0, 0, now))

	SettleWarDay(w, zoe, now.Add(2*time.Hour))
	aliceGain := alice.GoldBasis - aliceBefore
	zoeGain := zoe.GoldBasis
	if aliceGain <= 0 || zoeGain <= 0 || aliceGain != zoeGain {
		t.Fatalf("expected equal positive pro-rata stipend for alice and zoe, got alice=%d zoe=%d", aliceGain, zoeGain)
	}
	if aliceGain+zoeGain+w.TreasuryHeldBasis != treasuryBefore {
		t.Fatalf("treasury conservation violated: %d + %d + %d != %d", aliceGain, zoeGain, w.TreasuryHeldBasis, treasuryBefore)
	}
	if err := CheckEconomy(w); err != nil {
		t.Fatalf("monetary supply identity broken: %v", err)
	}
}

func TestCorporateWorkpackGuildDonationAndWarNodeSupport(t *testing.T) {
	now := time.Date(2026, 11, 14, 11, 0, 0, 0, time.UTC)
	w := NewEmptyWorld(now)
	p := NewBlankPlayer("corp_quartermaster", now)
	p.Profession = ProfArtisan
	p.ResourcesMilli[ResHeavyPack] = 2 * ResourceScale
	p.ResourcesMilli[ResPrecisionPack] = 2 * ResourceScale
	p.ResourcesMilli[ResInfantryKit] = 20 * ResourceScale
	w.Players[p.Handle] = p

	mustEconomy(t, PerformGuildAction(w, p, "join", "guild_obsidian_vanguard", "", "", "", "", now))
	mustEconomy(t, PerformGuildAction(w, p, "donate_heavy_pack", "", "", "", "", "", now))
	mustEconomy(t, PerformGuildAction(w, p, "donate_precision_pack", "", "", "", "", "", now))

	g := FindGuild(w, "guild_obsidian_vanguard")
	if g.Level != 2 || g.XP != 20 {
		t.Fatalf("expected 2 workpack donations (520 XP) to advance guild to Lv.2 with 20 XP, got Lv.%d XP=%d", g.Level, g.XP)
	}
	if p.GuildContribution != 2*MacroBalance.GuildDonateWorkpackContrib || p.ActivityPoints != 2*MacroBalance.GuildDonateWorkpackPts {
		t.Fatalf("unexpected workpack donation rewards: contrib=%d pts=%d", p.GuildContribution, p.ActivityPoints)
	}

	// Cannot support node before deploying own troops
	if err := UseConsumable(w, p, ResHeavyPack, "node_north_fort", now); err == nil {
		t.Fatal("expected war workpack support without deployment to fail")
	}

	mustEconomy(t, DeployWarTroops(w, p, "node_north_fort", 20, 0, 0, now))
	mustEconomy(t, UseConsumable(w, p, ResHeavyPack, "node_north_fort", now))
	mustEconomy(t, UseConsumable(w, p, ResPrecisionPack, "node_north_fort", now))

	// Duplicate deployment on same node in same round must fail
	p.ResourcesMilli[ResHeavyPack] = ResourceScale
	if err := UseConsumable(w, p, ResHeavyPack, "node_north_fort", now); err == nil {
		t.Fatal("expected duplicate heavy_workpack on same node to fail")
	}

	var north WarNodeState
	for _, n := range w.WarNodes {
		if n.NodeID == "node_north_fort" {
			north = n
			break
		}
	}
	summary := WarConsumableSummary(north)
	if !strings.Contains(summary, "重载作业包") || !strings.Contains(summary, "精密作业包") {
		t.Fatalf("expected WarConsumableSummary to list corporate workpacks, got %q", summary)
	}

	SettleWarDay(w, p, now.Add(2*time.Hour))
	for _, n := range w.WarNodes {
		if n.NodeID == "node_north_fort" {
			if n.OwnerGuild != GuildObsidian {
				t.Fatalf("expected supported 20 infantry + rally + workpacks to capture node_north_fort, got %s", n.OwnerGuild)
			}
			if n.Consumables != nil {
				t.Fatal("expected node consumables to clear after daily settlement")
			}
		}
	}
}

func TestMeteorOreUnifiedNaming(t *testing.T) {
	if ResourceName(ResMeteorOre) != "星陨秘银" {
		t.Fatalf("expected ResourceCatalog name 星陨秘银, got %s", ResourceName(ResMeteorOre))
	}
	if RaidLootCatalogMeta[ResMeteorOre].Name != "星陨秘银" {
		t.Fatalf("expected RaidLootCatalogMeta name 星陨秘银, got %s", RaidLootCatalogMeta[ResMeteorOre].Name)
	}
}

func TestLegacyV120WorldSnapshotUpgradesWarGraphAndPurgesFictionalGuildMembers(t *testing.T) {
	now := time.Date(2026, 11, 14, 2, 0, 0, 0, time.UTC)
	w := NewEmptyWorld(now)
	realLord := NewBlankPlayer("thermotics@icloud.com", now)
	realLord.InstalledEquipments[ResAutoPump] = 5
	w.Players[realLord.Handle] = realLord

	// Simulate persisted v1.2.0 world snapshot: 10 edges (missing south_ferry <-> east_fort),
	// asymmetric neutral garrisons, and fictional NPC guild rosters.
	filteredEdges := make([]WarEdge, 0, 10)
	for _, e := range DefaultWarEdges() {
		if e.FromNode == "node_south_ferry" && e.ToNode == "node_east_fort" {
			continue
		}
		filteredEdges = append(filteredEdges, e)
	}
	w.WarEdges = filteredEdges
	for i := range w.WarNodes {
		if w.WarNodes[i].NodeID == "node_east_fort" {
			w.WarNodes[i].X = 660
			w.WarNodes[i].NeutralGarrison = Troops{Infantry: 6, Archer: 6, Cavalry: 9}
		}
	}
	w.Guilds = []GuildState{
		{
			GuildID: "guild_obsidian_vanguard", Name: "墨械先驱团", Tag: "INK", Faction: GuildObsidian,
			LeaderHandle: "archon_demo", Level: 3, XP: 420, RallyNodeID: "node_north_fort",
			Members: []GuildMember{{Handle: "archon_demo", Role: "会长"}, {Handle: "墨匠·玄枢", Role: "副会长"}},
		},
		{
			GuildID: "guild_argent_hermes", Name: "赫尔墨斯炼金会", Tag: "ALCH", Faction: GuildArgent,
			LeaderHandle: "翠玉炼金师·维克", Level: 2, XP: 240, RallyNodeID: "node_center_vault",
			Members: []GuildMember{{Handle: "翠玉炼金师·维克", Role: "会长"}, {Handle: "白银之翼", Role: "成员"}},
		},
	}

	if !UpgradePersistedWorldState(w) {
		t.Fatal("expected v1.2.0 snapshot to report upgraded=true")
	}
	if UpgradePersistedWorldState(w) {
		t.Fatal("expected second UpgradePersistedWorldState call to be idempotent (false)")
	}
	if len(w.WarEdges) != 11 {
		t.Fatalf("expected 11 symmetric war edges after upgrade, got %d", len(w.WarEdges))
	}
	for _, n := range w.WarNodes {
		if n.NodeID == "node_east_fort" {
			if n.X != 600 || n.NeutralGarrison != (Troops{Infantry: 6, Archer: 6, Cavalry: 6}) {
				t.Fatalf("expected node_east_fort coordinates and garrison upgraded, got X=%d garrison=%+v", n.X, n.NeutralGarrison)
			}
		}
	}
	for _, g := range w.Guilds {
		if len(g.Members) != 0 || g.Level != 1 || g.XP != 0 || g.LeaderHandle != "商会执政厅" {
			t.Fatalf("expected starter guild %s scrubbed to clean Lv.1 state, got %+v", g.GuildID, g)
		}
		if g.GuildID == "guild_argent_hermes" && g.RallyNodeID != "node_south_ferry" {
			t.Fatalf("expected guild_argent_hermes rally upgraded to node_south_ferry, got %s", g.RallyNodeID)
		}
	}
	if realLord.InstalledEquipments[ResAutoPump] != 3 || realLord.ResourcesMilli[ResAutoPump] != 2*ResourceScale {
		t.Fatalf("expected legacy 5 installed pumps migrated to 3 installed + 2 refunded, got installed=%d inv=%d",
			realLord.InstalledEquipments[ResAutoPump], realLord.ResourcesMilli[ResAutoPump])
	}
}
