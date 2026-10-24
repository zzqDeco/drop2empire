package httpadapter

import (
	"context"
	"net/http"
	"sort"
	"strings"
	"time"

	"drop2empire/contracts/gen/game/hertz_gen/game/empire"
	"drop2empire/pkg/httpx"
	"drop2empire/services/game/internal/app"
	"drop2empire/services/game/internal/domain"
)

type Server struct {
	svc *app.Service
}

func NewServer(svc *app.Service) *Server {
	return &Server{svc: svc}
}

func NewHTTPHandler(svc *app.Service, ready func(context.Context) error) http.Handler {
	mux := http.NewServeMux()
	httpx.OperationsContext(mux, ready)
	srv := NewServer(svc)
	limiter := &raidLimiter{}
	empire.RegisterEmpireServer(mux, srv, httpx.Responder{})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimSpace(r.Header.Get("X-Session-Token"))
		if token == "" {
			if auth := strings.TrimSpace(r.Header.Get("Authorization")); strings.HasPrefix(strings.ToLower(auth), "bearer ") {
				token = strings.TrimSpace(auth[7:])
			}
		}
		if token == "" {
			if c, err := r.Cookie("d2e_session"); err == nil {
				token = strings.TrimSpace(c.Value)
			}
		}
		if token != "" {
			r = r.WithContext(app.WithSessionToken(r.Context(), token))
		}
		if tunnel := strings.TrimSpace(r.Header.Get("X-Admin-Tunnel")); tunnel != "" {
			r = r.WithContext(app.WithAdminTunnel(r.Context(), tunnel))
		}
		if strings.HasPrefix(r.URL.Path, "/api/v1/empire/colony/raid/") {
			r.Body = http.MaxBytesReader(w, r.Body, 4096)
			if token != "" && !limiter.allow(token, time.Now()) {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", "1")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = w.Write([]byte(`{"error":{"code":"raid_rate_limit","message":"远征指令过于频繁，请稍后重试"}}`))
				return
			}
		}
		mux.ServeHTTP(w, r)
	})
}

func computeETASeconds(requiredMilli, currentMilli, netRatePerSecMilli int64) int64 {
	if currentMilli >= requiredMilli {
		return 0
	}
	if netRatePerSecMilli <= 0 {
		return -1
	}
	deficit := requiredMilli - currentMilli
	eta := (deficit + netRatePerSecMilli - 1) / netRatePerSecMilli
	if eta < 1 {
		eta = 1
	}
	return eta
}

func mapDashboardResp(w *domain.WorldState) *empire.DashboardStateResp {
	p := w.Players[w.ActiveHandle]
	if p == nil {
		p = domain.NewBlankPlayer("pioneer", time.Now().UTC())
	}
	isAdmin := p.IsAdmin || w.AdminMode

	handles := make([]string, 0, len(w.Players))
	if isAdmin {
		for h := range w.Players {
			handles = append(handles, h)
		}
		sort.Strings(handles)
	} else {
		handles = append(handles, p.Handle)
	}

	grossRates, drainRates, rates := domain.ComputeResourceFlows(p)
	assignedPop := domain.AssignedPopulation(p)
	idlePop := p.PopulationTotal - assignedPop
	if idlePop < 0 {
		idlePop = 0
	}

	nextResCost := domain.NextResidentCostMilli(p.PopulationTotal)
	nextResETA := computeETASeconds(nextResCost, p.ResourcesMilli[domain.ResWater], rates[domain.ResWater])

	profName := "未选定（完成神秘宝藏后解锁）"
	for _, pr := range domain.ProfessionCatalog {
		if pr.Code == p.Profession {
			profName = pr.Name
			break
		}
	}

	playerDTO := &empire.PlayerProfileDTO{
		ID:                         p.ID,
		Handle:                     p.Handle,
		Phase:                      p.Phase,
		Profession:                 p.Profession,
		ProfessionName:             profName,
		ArtifactName:               p.ArtifactName,
		PopulationTotal:            p.PopulationTotal,
		PopulationAssigned:         assignedPop,
		PopulationIdle:             idlePop,
		NextResidentCostWaterMilli: nextResCost,
		NextResidentEtaSeconds:     nextResETA,
		GoldBasis:                  p.GoldBasis,
		GoldFrozenBasis:            p.GoldFrozenBasis,
		ActivityPoints:             p.ActivityPoints,
		SpeedMultiplier:            p.SpeedMultiplier,
		TotalManualClicks:          p.TotalManualClicks,
		SimulatedElapsedSeconds:    p.SimulatedElapsedSeconds,
		OfflineAwardSummary:        p.LastOfflineSummary,
		IsAdmin:                    isAdmin,
	}

	resourcesDTO := make([]*empire.ResourceLineDTO, 0, len(domain.ResourceCatalog))
	for _, meta := range domain.ResourceCatalog {
		amt := p.ResourcesMilli[meta.Key]
		frz := p.FrozenResourcesMilli[meta.Key]
		unlocked := p.DiscoveredResources[meta.Key] || meta.Key == domain.ResWater || amt > 0 || frz > 0
		if meta.Key == domain.ResWood && p.UnlockedBlueprints[domain.BPAxeBlueprint] {
			unlocked = true
		}
		if meta.Key == domain.ResCharcoal && p.UnlockedBlueprints[domain.BPCharcoalKiln] {
			unlocked = true
		}
		if meta.Key == domain.ResStone && p.UnlockedBlueprints[domain.BPQuarryTech] {
			unlocked = true
		}
		if meta.Key == domain.ResFlint && (p.UnlockedBlueprints[domain.BPWaterCistern] || p.UnlockedBlueprints[domain.BPScoutCamp]) {
			unlocked = true
		}
		if (meta.Key == domain.ResAncientShard || meta.Key == domain.ResMeteorOre) && p.UnlockedBlueprints[domain.BPScoutCamp] {
			unlocked = true
		}
		if (meta.Key == domain.ResIronIngot || meta.Key == domain.ResRation) && p.UnlockedBlueprints[domain.BPBasicWorkshop] && p.Profession != domain.ProfNone {
			unlocked = true
		}
		if p.Profession != domain.ProfNone && meta.Tier != "blueprint" && meta.Tier != "cosmetic" {
			unlocked = true
		}
		capMilli := domain.ResourceCapacityMilli(p, meta.Key)
		grossVal := grossRates[meta.Key]
		drainVal := drainRates[meta.Key]
		resourcesDTO = append(resourcesDTO, &empire.ResourceLineDTO{
			Key:                  meta.Key,
			Name:                 meta.Name,
			Tier:                 meta.Tier,
			AmountMilli:          amt,
			FrozenMilli:          frz,
			NetRatePerSecMilli:   rates[meta.Key],
			Unlocked:             unlocked,
			Description:          meta.Description,
			CapacityMilli:        capMilli,
			GrossRatePerSecMilli: grossVal,
			DrainRatePerSecMilli: drainVal,
		})
	}

	computedJobs := domain.ComputeJobs(p)
	jobsDTO := make([]*empire.WorkerJobDTO, 0, len(computedJobs))
	for _, cj := range computedJobs {
		reportedOutput := cj.TotalOutputPerSecMilli
		if cj.JobKey == domain.JobCharcoal || cj.JobKey == domain.JobSmeltIron || cj.JobKey == domain.JobPrepRation {
			reportedOutput = grossRates[cj.OutputResourceKey]
		}
		jobsDTO = append(jobsDTO, &empire.WorkerJobDTO{
			JobKey:                 cj.JobKey,
			Name:                   cj.Name,
			Assigned:               cj.Assigned,
			Capacity:               cj.Capacity,
			BaseRateMilli:          cj.BaseRateMilli,
			EffectiveRateMilli:     cj.EffectiveRateMilli,
			TotalOutputPerSecMilli: reportedOutput,
			EfficiencyPct:          cj.EfficiencyPct,
			Unlocked:               cj.Unlocked,
			UnlockHint:             cj.UnlockHint,
			InputSummary:           cj.InputSummary,
		})
	}

	presetsDTO := make([]*empire.AllocationPresetDTO, 0, len(p.Presets))
	for _, pr := range p.Presets {
		entries := make([]*empire.AllocationEntryDTO, 0, len(pr.Allocations))
		for _, k := range []string{domain.JobWater, domain.JobForage, domain.JobWood, domain.JobCharcoal, domain.JobStone, domain.JobSmeltIron, domain.JobPrepRation} {
			if c, ok := pr.Allocations[k]; ok && c > 0 {
				entries = append(entries, &empire.AllocationEntryDTO{
					JobKey: k,
					Count:  c,
				})
			}
		}
		presetsDTO = append(presetsDTO, &empire.AllocationPresetDTO{
			Name:    pr.Name,
			Entries: entries,
		})
	}

	// Blueprints with progressive disclosure (GDD 3.2)
	blueprintsDTO := make([]*empire.BlueprintNodeDTO, 0, len(domain.BlueprintCatalog))
	for _, bp := range domain.BlueprintCatalog {
		unlocked := p.UnlockedBlueprints[bp.Code]
		prereqOK := domain.BlueprintPrerequisitesMet(p, bp)
		visible := bp.Kind != "building" && (unlocked || (p.PopulationTotal > 0 && (bp.PrerequisiteCode == "" || p.UnlockedBlueprints[bp.PrerequisiteCode])))

		var maxETA int64
		allResourcesOK := true
		costOrder := []string{domain.ResWater, domain.ResWood, domain.ResCharcoal, domain.ResStone, domain.ResFlint, domain.ResAncientShard}
		costsDTO := make([]*empire.CostItemDTO, 0, len(bp.CostsMilli))
		for _, rKey := range costOrder {
			reqMilli, exists := bp.CostsMilli[rKey]
			if !exists {
				continue
			}
			curMilli := p.ResourcesMilli[rKey]
			if curMilli < reqMilli {
				allResourcesOK = false
			}
			eta := computeETASeconds(reqMilli, curMilli, rates[rKey])
			if capacity := domain.ResourceCapacityMilli(p, rKey); capacity > 0 && reqMilli > capacity && curMilli < reqMilli {
				eta = -1
			}
			if eta < 0 {
				maxETA = -1
			} else if maxETA >= 0 && eta > maxETA {
				maxETA = eta
			}
			costsDTO = append(costsDTO, &empire.CostItemDTO{
				ResourceKey:   rKey,
				ResourceName:  domain.ResourceName(rKey),
				RequiredMilli: reqMilli,
				CapacityMilli: domain.ResourceCapacityMilli(p, rKey),
				CurrentMilli:  curMilli,
				EtaSeconds:    eta,
			})
		}

		canUnlock := bp.Kind != "building" && !unlocked && prereqOK && allResourcesOK
		reason := domain.CostsBlockReason(p, bp.CostsMilli)
		if !prereqOK {
			reason = "请完成前置设施或全部工程部件"
		}
		blueprintsDTO = append(blueprintsDTO, &empire.BlueprintNodeDTO{
			Code:               bp.Code,
			Kind:               bp.Kind,
			BlockedReason:      reason,
			Name:               bp.Name,
			Stage:              bp.Stage,
			RequiredPopulation: bp.RequiredPopulation,
			PrerequisiteCode:   bp.PrerequisiteCode,
			Costs:              costsDTO,
			EffectSummary:      bp.EffectSummary,
			Unlocked:           unlocked,
			CanUnlock:          canUnlock,
			Visible:            visible,
			EtaSeconds:         maxETA,
		})
	}

	professionsDTO := make([]*empire.ProfessionSpecDTO, 0, len(domain.ProfessionCatalog))
	for _, pr := range domain.ProfessionCatalog {
		professionsDTO = append(professionsDTO, &empire.ProfessionSpecDTO{
			Code:             pr.Code,
			Name:             pr.Name,
			Title:            pr.Title,
			ArtifactName:     pr.ArtifactName,
			ExclusiveOutputs: append([]string{}, pr.ExclusiveOutputs...),
			StrengthText:     pr.StrengthText,
			WeaknessText:     pr.WeaknessText,
			MarketRoleText:   pr.MarketRoleText,
			PassiveBonusText: pr.PassiveBonusText,
		})
	}

	recipesDTO := make([]*empire.CraftRecipeDTO, 0, len(domain.CraftRecipeCatalog))
	for _, rc := range domain.CraftRecipeCatalog {
		profOK := rc.ProfessionReq == "all" || p.Profession == rc.ProfessionReq
		resOK := p.UnlockedBlueprints[domain.BPBasicWorkshop] && p.GoldBasis >= rc.GoldCostBasis
		costsDTO := make([]*empire.CostItemDTO, 0, len(rc.CostsMilli))
		for _, rKey := range []string{domain.ResWater, domain.ResWood, domain.ResStone, domain.ResIronIngot, domain.ResRation} {
			reqMilli, exists := rc.CostsMilli[rKey]
			if !exists {
				continue
			}
			curMilli := p.ResourcesMilli[rKey]
			if curMilli < reqMilli {
				resOK = false
			}
			costsDTO = append(costsDTO, &empire.CostItemDTO{
				ResourceKey:   rKey,
				ResourceName:  domain.ResourceName(rKey),
				RequiredMilli: reqMilli,
				CapacityMilli: domain.ResourceCapacityMilli(p, rKey),
				CurrentMilli:  curMilli,
				EtaSeconds:    computeETASeconds(reqMilli, curMilli, rates[rKey]),
			})
		}
		recipesDTO = append(recipesDTO, &empire.CraftRecipeDTO{
			RecipeCode:        rc.RecipeCode,
			Name:              rc.Name,
			Category:          rc.Category,
			ProfessionReq:     rc.ProfessionReq,
			ProfessionReqName: rc.ProfessionReqName,
			OutputKey:         rc.OutputKey,
			OutputName:        rc.OutputName,
			OutputAmountMilli: rc.OutputAmountMilli,
			Costs:             costsDTO,
			GoldCostBasis:     rc.GoldCostBasis,
			EffectSummary:     rc.EffectSummary,
			CanCraft:          profOK && resOK,
			ProfessionMatched: profOK,
		})
	}

	equipDTO := make([]*empire.InstalledEquipmentDTO, 0, len(domain.EquipmentCatalog))
	for _, eq := range domain.EquipmentCatalog {
		invUnits := int32(p.ResourcesMilli[eq.ItemKey] / domain.ResourceScale)
		equipDTO = append(equipDTO, &empire.InstalledEquipmentDTO{
			ItemKey:        eq.ItemKey,
			Name:           eq.Name,
			InventoryUnits: invUnits,
			InstalledCount: p.InstalledEquipments[eq.ItemKey],
			MaxStack:       eq.MaxStack,
			BonusSummary:   eq.BonusSummary,
		})
	}

	// Market summaries, open orders, recent trades & macro ledger
	marketSummaries := make([]*empire.MarketSummaryDTO, 0, len(domain.ResourceCatalog))
	for _, meta := range domain.ResourceCatalog {
		if !meta.Tradable {
			continue
		}
		var bestBid, bestAsk, volMilli int64
		for _, o := range w.Orders {
			if o.Status != "OPEN" || o.ItemKey != meta.Key || o.RemainingMilli <= 0 {
				continue
			}
			if o.Side == "BID" && o.PriceBasis > bestBid {
				bestBid = o.PriceBasis
			}
			if o.Side == "ASK" && (bestAsk == 0 || o.PriceBasis < bestAsk) {
				bestAsk = o.PriceBasis
			}
		}
		for _, tr := range w.Trades {
			if tr.ItemKey == meta.Key {
				volMilli += tr.QuantityMilli
			}
		}
		lastPrice := w.LastPricesBasis[meta.Key]
		openPrice := w.OpenPriceBasis[meta.Key]
		var changeBps int32
		if openPrice > 0 {
			changeBps = int32(((lastPrice - openPrice) * 10000) / openPrice)
		}
		marketSummaries = append(marketSummaries, &empire.MarketSummaryDTO{
			ItemKey:         meta.Key,
			ItemName:        meta.Name,
			Tier:            meta.Tier,
			LastPriceBasis:  lastPrice,
			BestBidBasis:    bestBid,
			BestAskBasis:    bestAsk,
			Volume24hMilli:  volMilli,
			Change24hPctBps: changeBps,
		})
	}

	openOrdersDTO := make([]*empire.MarketOrderDTO, 0, len(w.Orders))
	for _, o := range w.Orders {
		if o.Status != "OPEN" {
			continue
		}
		openOrdersDTO = append(openOrdersDTO, &empire.MarketOrderDTO{
			ID:             o.ID,
			ItemKey:        o.ItemKey,
			ItemName:       domain.ResourceName(o.ItemKey),
			Side:           o.Side,
			PriceBasis:     o.PriceBasis,
			QuantityMilli:  o.QuantityMilli,
			FilledMilli:    o.FilledMilli,
			RemainingMilli: o.RemainingMilli,
			MakerName:      o.MakerHandle,
			IsOwn:          !o.IsNPC && o.MakerHandle == p.Handle,
			IsNpc:          o.IsNPC,
			Status:         o.Status,
			CreatedAt:      o.CreatedAt,
		})
	}

	tradesDTO := make([]*empire.MarketTradeDTO, 0, len(w.Trades))
	for _, tr := range w.Trades {
		tradesDTO = append(tradesDTO, &empire.MarketTradeDTO{
			ID:               tr.ID,
			ItemKey:          tr.ItemKey,
			ItemName:         domain.ResourceName(tr.ItemKey),
			PriceBasis:       tr.PriceBasis,
			QuantityMilli:    tr.QuantityMilli,
			TotalGoldBasis:   tr.TotalGoldBasis,
			TaxBurnedBasis:   tr.TaxBurnedBasis,
			TaxTreasuryBasis: tr.TaxTreasuryBasis,
			BuyerName:        tr.BuyerHandle,
			SellerName:       tr.SellerHandle,
			ExecutedAt:       tr.ExecutedAt,
		})
	}

	var totalPlayerHeld, totalEscrow int64
	for _, pl := range w.Players {
		totalPlayerHeld += pl.GoldBasis
		totalEscrow += pl.GoldFrozenBasis
	}
	macroDTO := &empire.MacroLedgerDTO{
		TotalIssuedBasis:       w.TotalIssuedBasis,
		PlayerHeldBasis:        totalPlayerHeld,
		EscrowFrozenBasis:      totalEscrow,
		NpcHeldBasis:           w.NPCHeldBasis,
		TreasuryHeldBasis:      w.TreasuryHeldBasis,
		PermanentlyBurnedBasis: w.PermanentlyBurnedBasis,
		TaxRateBps:             int32(domain.MarketTaxBps),
		BurnShareBps:           int32(domain.MarketBurnShareBps),
	}

	// War state
	connected := domain.SupplyConnectedNodes(w, p.GuildCode)
	deployable := domain.DeployableNodes(w, p.GuildCode)
	warNodesDTO := make([]*empire.WarNodeDTO, 0, len(w.WarNodes))
	for _, n := range w.WarNodes {
		var garrison domain.Troops
		switch n.OwnerGuild {
		case domain.GuildObsidian:
			garrison = n.ObsidianTroops
		case domain.GuildArgent:
			garrison = n.ArgentTroops
		default:
			garrison = n.NeutralGarrison
		}
		gPower := domain.ComputeWeightedPower(garrison, domain.Troops{}, n.DefenseBonusPct)
		myDep := n.PlayerDeployed[p.Handle]
		warNodesDTO = append(warNodesDTO, &empire.WarNodeDTO{
			NodeId:          n.NodeID,
			Name:            n.Name,
			Region:          n.Region,
			X:               n.X,
			Y:               n.Y,
			OwnerGuild:      n.OwnerGuild,
			DefenseBonusPct: n.DefenseBonusPct,
			DailyScore:      n.DailyScore,
			IsTreasureVault: n.IsTreasureVault,
			GarrisonPower:   gPower,
			InfantryCount:   garrison.Infantry,
			ArcherCount:     garrison.Archer,
			CavalryCount:    garrison.Cavalry,
			MyInfantry:      myDep.Infantry,
			MyArcher:        myDep.Archer,
			MyCavalry:       myDep.Cavalry,
			CanDeploy:       deployable[n.NodeID],
			SupplyConnected: connected[n.NodeID],
			IntelNote:       n.IntelNote,
		})
	}

	warEdgesDTO := make([]*empire.WarEdgeDTO, 0, len(w.WarEdges))
	for _, e := range w.WarEdges {
		warEdgesDTO = append(warEdgesDTO, &empire.WarEdgeDTO{
			FromNode: e.FromNode,
			ToNode:   e.ToNode,
		})
	}

	warHistDTO := make([]*empire.WarDaySettlementDTO, 0, len(w.WarHistory))
	for _, h := range w.WarHistory {
		repDTO := make([]*empire.WarBattleNodeReportDTO, 0, len(h.NodeReports))
		for _, nr := range h.NodeReports {
			repDTO = append(repDTO, &empire.WarBattleNodeReportDTO{
				NodeId:                nr.NodeID,
				NodeName:              nr.NodeName,
				PrevOwner:             nr.PrevOwner,
				NewOwner:              nr.NewOwner,
				ObsidianInfantry:      nr.ObsidianInfantry,
				ObsidianArcher:        nr.ObsidianArcher,
				ObsidianCavalry:       nr.ObsidianCavalry,
				ArgentInfantry:        nr.ArgentInfantry,
				ArgentArcher:          nr.ArgentArcher,
				ArgentCavalry:         nr.ArgentCavalry,
				EffectiveAttackMilli:  nr.EffectiveAttackMilli,
				EffectiveDefenseMilli: nr.EffectiveDefenseMilli,
				Winner:                nr.Winner,
				CasualtySummary:       nr.CasualtySummary,
			})
		}
		warHistDTO = append(warHistDTO, &empire.WarDaySettlementDTO{
			DayIndex:              h.DayIndex,
			SettledAt:             h.SettledAt,
			ObsidianScoreDelta:    h.ObsidianScoreDelta,
			ArgentScoreDelta:      h.ArgentScoreDelta,
			PlayerPointsEarned:    h.PlayerPointsEarned,
			PlayerBudgetSubmitted: h.PlayerBudgetSubmitted,
			NodeReports:           repDTO,
		})
	}

	domain.EnsureGuildState(w)
	nodeNameMap := make(map[string]string, len(w.WarNodes))
	for _, wn := range w.WarNodes {
		nodeNameMap[wn.NodeID] = wn.Name
	}

	guildsDTO := make([]*empire.GuildDTO, 0, len(w.Guilds))
	for _, g := range w.Guilds {
		fName := "黑曜商会 (OBSIDIAN)"
		if g.Faction == domain.GuildArgent {
			fName = "白银同盟 (ARGENT)"
		}
		membersDTO := make([]*empire.GuildMemberDTO, 0, len(g.Members))
		for _, m := range g.Members {
			membersDTO = append(membersDTO, &empire.GuildMemberDTO{
				Handle:       m.Handle,
				Role:         m.Role,
				Contribution: m.Contribution,
				WarDeployed:  m.WarDeployed,
			})
		}
		rallyName := nodeNameMap[g.RallyNodeID]
		if rallyName == "" {
			rallyName = "中央宝藏城 ★"
		}
		guildsDTO = append(guildsDTO, &empire.GuildDTO{
			GuildId:           g.GuildID,
			Name:              g.Name,
			Tag:               g.Tag,
			Faction:           g.Faction,
			FactionName:       fName,
			LeaderHandle:      g.LeaderHandle,
			Level:             g.Level,
			Xp:                g.XP,
			NextLevelXp:       domain.GuildNextLevelXP(g.Level),
			MemberCount:       int32(len(g.Members)),
			TreasuryGoldBasis: g.TreasuryGoldBasis,
			RallyNodeId:       g.RallyNodeID,
			RallyNodeName:     rallyName,
			Announcement:      g.Announcement,
			BonusSummary:      domain.GuildBonusSummary(g.Level, g.Faction),
			Members:           membersDTO,
		})
	}

	guildName := "黑曜商会 (OBSIDIAN)"
	if p.GuildCode == domain.GuildArgent {
		guildName = "白银同盟 (ARGENT)"
	}
	if p.JoinedGuildID != "" {
		if jg := domain.FindGuild(w, p.JoinedGuildID); jg != nil {
			guildName = "[" + jg.Tag + "] " + jg.Name + " · " + jg.Faction
		}
	}

	warDTO := &empire.WarStateDTO{
		SeasonCode:              w.SeasonCode,
		SeasonName:              w.SeasonName,
		CurrentDay:              w.WarDay,
		NextSettlementLabel:     "每日 20:00 (UTC+8) 锁定快照结算",
		PlayerGuild:             p.GuildCode,
		PlayerGuildName:         guildName,
		PlayerRole:              "公会执政官 & 军需官",
		DailyBudgetUsed:         p.DailyWarBudgetUsed,
		DailyBudgetCap:          domain.DailyWarBudgetCap,
		ObsidianTotalScore:      w.ObsidianScore,
		ArgentTotalScore:        w.ArgentScore,
		Nodes:                   warNodesDTO,
		Edges:                   warEdgesDTO,
		SettlementHistory:       warHistDTO,
		JoinedGuildId:           p.JoinedGuildID,
		PlayerGuildContribution: p.GuildContribution,
		Guilds:                  guildsDTO,
	}

	collectiblesDTO := make([]*empire.CollectibleItemDTO, 0, len(w.Collectibles))
	for _, c := range w.Collectibles {
		collectiblesDTO = append(collectiblesDTO, &empire.CollectibleItemDTO{
			ItemId:        c.ItemID,
			SerialNumber:  c.SerialNumber,
			SeasonId:      c.SeasonID,
			CollectionId:  c.CollectionID,
			Name:          c.Name,
			BaseModelId:   c.BaseModelID,
			BaseModelName: c.BaseModelName,
			TextureId:     c.TextureID,
			TextureName:   c.TextureName,
			PatternSeed:   c.PatternSeed,
			UvOffsetX:     c.UVOffsetX,
			UvOffsetY:     c.UVOffsetY,
			UvScale:       c.UVScale,
			UvRotation:    c.UVRotation,
			PaletteId:     c.PaletteID,
			PaletteName:   c.PaletteName,
			RarityTier:    c.RarityTier,
			SpecialTag:    c.SpecialTag,
			MintedAt:      c.MintedAt,
			OwnerName:     c.OwnerHandle,
		})
	}

	domain.EnsureSeasonState(w, time.Now().UTC())
	noticesDTO := make([]*empire.SeasonNoticeDTO, 0, len(w.Announcements))
	for _, an := range w.Announcements {
		noticesDTO = append(noticesDTO, &empire.SeasonNoticeDTO{
			SeasonId:     an.SeasonID,
			Title:        an.Title,
			EffectiveIn:  an.EffectiveIn,
			Summary:      an.Summary,
			DemandShifts: append([]string{}, an.DemandShifts...),
		})
	}

	logsDTO := make([]*empire.EventLogDTO, 0, len(p.EventLogs))
	for _, ev := range p.EventLogs {
		logsDTO = append(logsDTO, &empire.EventLogDTO{
			ID:        ev.ID,
			Timestamp: ev.Timestamp,
			Category:  ev.Category,
			Message:   ev.Message,
		})
	}

	invitesDTO := make([]*empire.RegistrationInviteDTO, 0)
	if isAdmin {
		for _, inv := range w.Invites {
			dto := &empire.RegistrationInviteDTO{
				ID:          inv.ID,
				CodePreview: inv.CodePreview,
				CreatedAt:   inv.CreatedAt,
				ExpiresAt:   inv.ExpiresAt,
			}
			if inv.UsedAt != "" {
				v := inv.UsedAt
				dto.UsedAt = &v
			}
			if inv.UsedBy != "" {
				v := inv.UsedBy
				dto.UsedBy = &v
			}
			if inv.RevokedAt != "" {
				v := inv.RevokedAt
				dto.RevokedAt = &v
			}
			invitesDTO = append(invitesDTO, dto)
		}
	}

	costOrderAll := []string{domain.ResWater, domain.ResWood, domain.ResCharcoal, domain.ResStone, domain.ResFlint, domain.ResAncientShard, domain.ResMeteorOre, domain.ResIronIngot, domain.ResRation}

	edictsDTO := make([]*empire.ColonyEdictDTO, 0, len(domain.EdictCatalog))
	for _, ed := range domain.EdictCatalog {
		unlocked := p.UnlockedBlueprints[ed.PrerequisiteCode]
		active := unlocked && p.ActiveEdicts != nil && p.ActiveEdicts[ed.Code]
		edictsDTO = append(edictsDTO, &empire.ColonyEdictDTO{
			Code:            ed.Code,
			Name:            ed.Name,
			Category:        ed.Category,
			EffectSummary:   ed.EffectSummary,
			DrawbackSummary: ed.DrawbackSummary,
			Unlocked:        unlocked,
			Active:          active,
		})
	}

	expeditionRoutesDTO := make([]*empire.ExpeditionRouteDTO, 0, len(domain.ExpeditionCatalog))
	if p.UnlockedBlueprints[domain.BPScoutCamp] {
		for _, rt := range domain.ExpeditionCatalog {
			costsDTO := make([]*empire.CostItemDTO, 0, len(rt.CostsMilli))
			allOK := p.ActiveExpedition == nil
			for _, rKey := range costOrderAll {
				reqMilli, exists := rt.CostsMilli[rKey]
				if !exists {
					continue
				}
				curMilli := p.ResourcesMilli[rKey]
				if curMilli < reqMilli {
					allOK = false
				}
				costsDTO = append(costsDTO, &empire.CostItemDTO{
					ResourceKey:   rKey,
					ResourceName:  domain.ResourceName(rKey),
					RequiredMilli: reqMilli,
					CapacityMilli: domain.ResourceCapacityMilli(p, rKey),
					CurrentMilli:  curMilli,
					EtaSeconds:    computeETASeconds(reqMilli, curMilli, rates[rKey]),
				})
			}
			expeditionRoutesDTO = append(expeditionRoutesDTO, &empire.ExpeditionRouteDTO{
				RouteCode:       rt.RouteCode,
				Name:            rt.Name,
				DurationSeconds: rt.DurationSeconds,
				Costs:           costsDTO,
				RewardSummary:   rt.RewardSummary,
				CanDispatch:     allOK,
			})
		}
	}

	var activeExpeditionDTO *empire.ActiveExpeditionDTO
	if p.ActiveExpedition != nil {
		ae := p.ActiveExpedition
		elapsed := p.SimulatedElapsedSeconds - ae.StartedAtSimSec
		if elapsed < 0 {
			elapsed = 0
		}
		rem := ae.DurationSeconds - elapsed
		if rem < 0 {
			rem = 0
		}
		activeExpeditionDTO = &empire.ActiveExpeditionDTO{
			RouteCode:        ae.RouteCode,
			RouteName:        ae.RouteName,
			RemainingSeconds: rem,
			TotalSeconds:     ae.DurationSeconds,
			Completed:        rem == 0,
		}
	}

	caravanOffersDTO := make([]*empire.CaravanOfferDTO, 0, len(domain.CaravanOfferCatalog))
	if p.BuildingCounts[domain.BuildingCaravan] > 0 {
		for _, cf := range domain.CaravanOfferCatalog {
			if !domain.CaravanOfferVisible(p, cf) {
				continue
			}
			costsDTO := make([]*empire.CostItemDTO, 0, len(cf.CostsMilli))
			canTrade := p.PopulationTotal+cf.RewardPopulation <= domain.HousingCapacity(p)
			for _, rKey := range costOrderAll {
				reqMilli, exists := cf.CostsMilli[rKey]
				if !exists {
					continue
				}
				curMilli := p.ResourcesMilli[rKey]
				if curMilli < reqMilli {
					canTrade = false
				}
				costsDTO = append(costsDTO, &empire.CostItemDTO{
					ResourceKey:   rKey,
					ResourceName:  domain.ResourceName(rKey),
					RequiredMilli: reqMilli,
					CapacityMilli: domain.ResourceCapacityMilli(p, rKey),
					CurrentMilli:  curMilli,
					EtaSeconds:    computeETASeconds(reqMilli, curMilli, rates[rKey]),
				})
			}
			caravanOffersDTO = append(caravanOffersDTO, &empire.CaravanOfferDTO{
				OfferCode:     cf.OfferCode,
				Title:         cf.Title,
				Costs:         costsDTO,
				RewardSummary: cf.RewardSummary,
				CanTrade:      canTrade,
			})
		}
	}

	hydrationWarn := p.HydrationWarning

	equippedCosDTO, cosmeticsDTO, raidGearsDTO, raidLoadoutDTO := mapRaidPresentation(p)

	return &empire.DashboardStateResp{
		ServerTime:          time.Now().UTC().Format(time.RFC3339Nano),
		Revision:            p.Revision,
		Settlement:          mapSettlement(p, rates),
		Player:              playerDTO,
		AvailableHandles:    handles,
		Resources:           resourcesDTO,
		Jobs:                jobsDTO,
		Presets:             presetsDTO,
		Blueprints:          blueprintsDTO,
		Professions:         professionsDTO,
		Recipes:             recipesDTO,
		InstalledEquipments: equipDTO,
		MarketSummaries:     marketSummaries,
		OpenOrders:          openOrdersDTO,
		RecentTrades:        tradesDTO,
		MacroLedger:         macroDTO,
		War:                 warDTO,
		Collectibles:        collectiblesDTO,
		SeasonNotices:       noticesDTO,
		EventLogs:           logsDTO,
		Invites:             invitesDTO,
		Edicts:              edictsDTO,
		ExpeditionRoutes:    expeditionRoutesDTO,
		ActiveExpedition:    activeExpeditionDTO,
		CaravanOffers:       caravanOffersDTO,
		HydrationWarning:    hydrationWarn,
		EquippedCosmetics:   equippedCosDTO,
		Cosmetics:           cosmeticsDTO,
		RaidGears:           raidGearsDTO,
		RaidLoadout:         raidLoadoutDTO,
		CurrentSeason: &empire.SeasonStateDTO{
			SeasonId:       w.SeasonCode,
			SeasonNumber:   w.SeasonNumber,
			Title:          w.SeasonName,
			Subtitle:       "跨赛季重置聚落与宏观经济 · 永久保留赛季限定动态外观与唯一纹理藏品",
			StartedAt:      w.SeasonStartedAt,
			ResetRules:     append([]string{}, domain.SeasonResetRules...),
			RetentionRules: append([]string{}, domain.SeasonRetentionRules...),
		},
	}
}

func (s *Server) RolloverSeason(ctx context.Context, req *empire.RolloverSeasonReq) (*empire.DashboardStateResp, error) {
	var nextTitle string
	if req.NextTitle != nil {
		nextTitle = *req.NextTitle
	}
	w, err := s.svc.RolloverSeason(ctx, nextTitle)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) PublishNotice(ctx context.Context, req *empire.PublishNoticeReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.PublishNotice(ctx, req.Title, req.EffectiveIn, req.Summary, req.DemandShifts)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) GetDashboard(ctx context.Context, _ *empire.GetDashboardReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.GetDashboard(ctx)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) RegisterAccount(ctx context.Context, req *empire.RegisterAccountReq) (*empire.DashboardStateResp, error) {
	w, token, err := s.svc.RegisterAccount(ctx, req.Handle, req.Password, req.InviteCode)
	if err != nil {
		return nil, err
	}
	resp := mapDashboardResp(w)
	resp.SessionToken = &token
	return resp, nil
}

func (s *Server) CreateInvite(ctx context.Context, _ *empire.CreateInviteReq) (*empire.DashboardStateResp, error) {
	w, code, err := s.svc.CreateInvite(ctx)
	if err != nil {
		return nil, err
	}
	resp := mapDashboardResp(w)
	resp.CreatedInviteCode = &code
	return resp, nil
}

func (s *Server) RevokeInvite(ctx context.Context, req *empire.RevokeInviteReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.RevokeInvite(ctx, req.ID)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) LoginAccount(ctx context.Context, req *empire.LoginAccountReq) (*empire.DashboardStateResp, error) {
	w, token, err := s.svc.LoginAccount(ctx, req.Handle, req.Password)
	if err != nil {
		return nil, err
	}
	resp := mapDashboardResp(w)
	resp.SessionToken = &token
	return resp, nil
}

func (s *Server) LogoutAccount(ctx context.Context, _ *empire.LogoutAccountReq) (*empire.LogoutAccountResp, error) {
	if err := s.svc.LogoutAccount(ctx); err != nil {
		return nil, err
	}
	return &empire.LogoutAccountResp{Ok: true}, nil
}

func (s *Server) SwitchAccount(ctx context.Context, req *empire.SwitchAccountReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.SwitchAccount(ctx, req.Handle)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) GatherWater(ctx context.Context, req *empire.GatherWaterReq) (*empire.DashboardStateResp, error) {
	clicks := int32(1)
	if req.Clicks != nil {
		clicks = *req.Clicks
	}
	w, err := s.svc.GatherWater(ctx, clicks)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) RecruitResident(ctx context.Context, req *empire.RecruitResidentReq) (*empire.DashboardStateResp, error) {
	count := int32(1)
	if req.Count != nil {
		count = *req.Count
	}
	w, err := s.svc.RecruitResident(ctx, count)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) AllocateWorkers(ctx context.Context, req *empire.AllocateWorkersReq) (*empire.DashboardStateResp, error) {
	entries := make(map[string]int32)
	for _, e := range req.Entries {
		if e != nil {
			entries[e.JobKey] = e.Count
		}
	}
	var presetName string
	if req.PresetName != nil {
		presetName = *req.PresetName
	}
	w, err := s.svc.AllocateWorkers(ctx, req.Mode, entries, presetName)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) SaveAllocationPreset(ctx context.Context, req *empire.SaveAllocationPresetReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.SaveAllocationPreset(ctx, req.Name)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) UnlockBlueprint(ctx context.Context, req *empire.UnlockBlueprintReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.UnlockBlueprint(ctx, req.Code)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) ToggleEdict(ctx context.Context, req *empire.ToggleEdictReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.ToggleEdict(ctx, req.Code)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) DispatchExpedition(ctx context.Context, req *empire.DispatchExpeditionReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.DispatchExpedition(ctx, req.RouteCode)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) ClaimExpedition(ctx context.Context, _ *empire.ClaimExpeditionReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.ClaimExpedition(ctx)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) TradeCaravan(ctx context.Context, req *empire.TradeCaravanReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.TradeCaravan(ctx, req.OfferCode)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) EquipCosmetic(ctx context.Context, req *empire.EquipCosmeticReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.EquipCosmetic(ctx, req.Slot, req.ItemKey)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) LearnRaidBlueprint(ctx context.Context, req *empire.LearnRaidBlueprintReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.LearnRaidBlueprint(ctx, req.BlueprintKey)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) ManageRaidGear(ctx context.Context, req *empire.ManageRaidGearReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.ManageRaidGear(ctx, req.Action, req.ItemKey)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) DraftRaidBuff(ctx context.Context, req *empire.DraftRaidBuffReq) (*empire.DashboardStateResp, error) {
	var cardCode string
	if req.CardCode != nil {
		cardCode = *req.CardCode
	}
	var replaceSlot int32 = -1
	if req.ReplaceSlot != nil {
		replaceSlot = *req.ReplaceSlot
	}
	w, err := s.svc.DraftRaidBuff(ctx, req.Action, cardCode, replaceSlot)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) StartRaid(ctx context.Context, _ *empire.StartRaidReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.StartRaid(ctx)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) RaidAction(ctx context.Context, req *empire.RaidActionReq) (*empire.RaidUpdateResp, error) {
	var dx, dy int32
	if req.Dx != nil {
		dx = *req.Dx
	}
	if req.Dy != nil {
		dy = *req.Dy
	}
	var itemID, fromContainer, toContainer, itemKey string
	if req.ItemId != nil {
		itemID = *req.ItemId
	}
	if req.FromContainer != nil {
		fromContainer = *req.FromContainer
	}
	if req.ToContainer != nil {
		toContainer = *req.ToContainer
	}
	if req.ItemKey != nil {
		itemKey = *req.ItemKey
	}
	p, err := s.svc.RaidCommand(ctx, req.RaidId, req.CommandSeq, domain.RaidCommand{Action: req.Action, DX: dx, DY: dy, ItemID: itemID, FromContainer: fromContainer, ToContainer: toContainer, ItemKey: itemKey})
	if err != nil {
		return nil, err
	}
	return mapRaidUpdate(p), nil
}

func (s *Server) FinishRaid(ctx context.Context, req *empire.FinishRaidReq) (*empire.RaidUpdateResp, error) {
	p, err := s.svc.RaidCommand(ctx, req.RaidId, req.CommandSeq, domain.RaidCommand{Action: "finish", Status: req.Status})
	if err != nil {
		return nil, err
	}
	return mapRaidUpdate(p), nil
}

func (s *Server) ChooseProfession(ctx context.Context, req *empire.ChooseProfessionReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.ChooseProfession(ctx, req.Profession)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) CraftItem(ctx context.Context, req *empire.CraftItemReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.CraftItem(ctx, req.RecipeCode, req.Batches)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) InstallEquipment(ctx context.Context, req *empire.InstallEquipmentReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.InstallEquipment(ctx, req.ItemKey, req.Delta)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) PlaceMarketOrder(ctx context.Context, req *empire.PlaceMarketOrderReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.PlaceMarketOrder(ctx, req.ItemKey, req.Side, req.PriceBasis, req.QuantityMilli)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) CancelMarketOrder(ctx context.Context, req *empire.CancelMarketOrderReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.CancelMarketOrder(ctx, req.ID)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) SwitchGuild(ctx context.Context, req *empire.SwitchGuildReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.SwitchGuild(ctx, req.GuildCode)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) GuildAction(ctx context.Context, req *empire.GuildActionReq) (*empire.DashboardStateResp, error) {
	var guildID, name, tag, faction, rallyNodeID string
	if req.GuildId != nil {
		guildID = *req.GuildId
	}
	if req.Name != nil {
		name = *req.Name
	}
	if req.Tag != nil {
		tag = *req.Tag
	}
	if req.Faction != nil {
		faction = *req.Faction
	}
	if req.RallyNodeId != nil {
		rallyNodeID = *req.RallyNodeId
	}
	w, err := s.svc.GuildAction(ctx, req.Action, guildID, name, tag, faction, rallyNodeID)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) DeployWarTroops(ctx context.Context, req *empire.DeployWarTroopsReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.DeployWarTroops(ctx, req.NodeId, req.InfantryDelta, req.ArcherDelta, req.CavalryDelta)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) TriggerWarSettlement(ctx context.Context, _ *empire.TriggerWarSettlementReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.TriggerWarSettlement(ctx)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) RedeemSeasonChest(ctx context.Context, req *empire.RedeemSeasonChestReq) (*empire.DashboardStateResp, error) {
	w, err := s.svc.RedeemSeasonChest(ctx, req.Count)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) OpenSeasonChest(ctx context.Context, req *empire.OpenSeasonChestReq) (*empire.DashboardStateResp, error) {
	var hint int64
	if req.ClientSeedHint != nil {
		hint = *req.ClientSeedHint
	}
	w, err := s.svc.OpenSeasonChest(ctx, hint)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) ControlSimulation(ctx context.Context, req *empire.ControlSimulationReq) (*empire.DashboardStateResp, error) {
	var mult int32 = 1
	if req.SpeedMultiplier != nil {
		mult = *req.SpeedMultiplier
	}
	var adv int64 = 60
	if req.AdvanceSeconds != nil {
		adv = *req.AdvanceSeconds
	}
	var targetHandle string
	if req.TargetHandle != nil {
		targetHandle = *req.TargetHandle
	}
	w, err := s.svc.ControlSimulation(ctx, req.Action, mult, adv, targetHandle)
	if err != nil {
		return nil, err
	}
	return mapDashboardResp(w), nil
}

func (s *Server) RunBenchmark30m(ctx context.Context, _ *empire.RunBenchmark30mReq) (*empire.Benchmark30mResp, error) {
	runs, err := s.svc.RunBenchmark30m(ctx)
	if err != nil {
		return nil, err
	}
	runsDTO := make([]*empire.BenchmarkRunDTO, 0, len(runs))
	for _, r := range runs {
		msDTO := make([]*empire.BenchmarkMilestoneDTO, 0, len(r.Milestones))
		for _, m := range r.Milestones {
			msDTO = append(msDTO, &empire.BenchmarkMilestoneDTO{
				Code:           m.Code,
				Name:           m.Name,
				ReachedSeconds: m.ReachedSeconds,
				FormattedTime:  m.FormattedTime,
				Population:     m.Population,
			})
		}
		runsDTO = append(runsDTO, &empire.BenchmarkRunDTO{
			StrategyCode:   r.StrategyCode,
			Completed:      r.Completed,
			FailureReason:  r.FailureReason,
			StrategyName:   r.StrategyName,
			Description:    r.Description,
			TotalSeconds:   r.TotalSeconds,
			FormattedTotal: r.FormattedTotal,
			Milestones:     msDTO,
		})
	}
	return &empire.Benchmark30mResp{
		Runs: runsDTO,
		Note: "使用真实研究、建造、招募、岗位与生产逻辑；仅开局手点 10 次，每 10 秒作一次经营决策，最多运行 60 分钟。完成时间属于自动策略基准，不代表真人试玩时长。",
	}, nil
}

func mapRaidPresentation(p *domain.PlayerState) (*empire.EquippedCosmeticsDTO, []*empire.CosmeticSpecDTO, []*empire.RaidGearSpecDTO, *empire.RaidLoadoutStateDTO) {
	costOrderAll := []string{domain.ResWater, domain.ResWood, domain.ResCharcoal, domain.ResStone, domain.ResFlint, domain.ResAncientShard, domain.ResMeteorOre, domain.ResIronIngot, domain.ResRation}
	rates := domain.NetResourceRatesPerSecMilli(p)
	domain.EnsureRaidState(p)
	equippedCosDTO := &empire.EquippedCosmeticsDTO{
		Headgear:  p.EquippedCosmetics["headgear"],
		Mantle:    p.EquippedCosmetics["mantle"],
		HeldRelic: p.EquippedCosmetics["held_relic"],
		Companion: p.EquippedCosmetics["companion"],
	}

	cosmeticsDTO := make([]*empire.CosmeticSpecDTO, 0, len(domain.CosmeticCatalog))
	for _, cs := range domain.CosmeticCatalog {
		owned := int32(p.ResourcesMilli[cs.ItemKey] / domain.ResourceScale)
		eq := p.EquippedCosmetics[cs.Slot] == cs.ItemKey
		cosmeticsDTO = append(cosmeticsDTO, &empire.CosmeticSpecDTO{
			ItemKey:      cs.ItemKey,
			Name:         cs.Name,
			Slot:         cs.Slot,
			Rarity:       cs.Rarity,
			SeasonTag:    cs.SeasonTag,
			VisualEffect: cs.VisualEffect,
			OwnedCount:   owned,
			Equipped:     eq,
		})
	}

	raidGearsDTO := make([]*empire.RaidGearSpecDTO, 0, len(domain.RaidGearCatalog))
	for _, rg := range domain.RaidGearCatalog {
		bpOwned := int32(0)
		recipeUnlocked := rg.BlueprintKey == ""
		if rg.BlueprintKey != "" {
			bpOwned = int32(p.ResourcesMilli[rg.BlueprintKey] / domain.ResourceScale)
			recipeUnlocked = p.LearnedRaidBlueprints[rg.BlueprintKey]
		}
		owned := p.RaidGearInventory[rg.ItemKey]
		eq := false
		switch rg.Category {
		case "weapon":
			eq = p.RaidLoadout.WeaponKey == rg.ItemKey && owned > 0
		case "armor":
			eq = p.RaidLoadout.ArmorKey == rg.ItemKey && owned > 0
		case "boots":
			eq = p.RaidLoadout.BootsKey == rg.ItemKey && owned > 0
		case "safe_box":
			eq = p.RaidLoadout.SafeBoxKey == rg.ItemKey && owned > 0
		case "potion":
			for _, pk := range p.RaidLoadout.EquippedPotions {
				if pk == rg.ItemKey && owned > 0 {
					eq = true
					break
				}
			}
		}

		costsDTO := make([]*empire.CostItemDTO, 0, len(rg.CostsMilli))
		canCraft := recipeUnlocked && !(rg.Category == "safe_box" && owned > 0)
		for _, rKey := range costOrderAll {
			reqMilli, exists := rg.CostsMilli[rKey]
			if !exists {
				continue
			}
			curMilli := p.ResourcesMilli[rKey]
			if curMilli < reqMilli {
				canCraft = false
			}
			costsDTO = append(costsDTO, &empire.CostItemDTO{
				ResourceKey:   rKey,
				ResourceName:  domain.ResourceName(rKey),
				RequiredMilli: reqMilli,
				CapacityMilli: domain.ResourceCapacityMilli(p, rKey),
				CurrentMilli:  curMilli,
				EtaSeconds:    computeETASeconds(reqMilli, curMilli, rates[rKey]),
			})
		}

		raidGearsDTO = append(raidGearsDTO, &empire.RaidGearSpecDTO{
			ItemKey:             rg.ItemKey,
			Name:                rg.Name,
			Category:            rg.Category,
			Tier:                rg.Tier,
			BlueprintKey:        rg.BlueprintKey,
			BlueprintName:       rg.BlueprintName,
			BlueprintOwnedCount: bpOwned,
			RecipeUnlocked:      recipeUnlocked,
			OwnedCount:          owned,
			Equipped:            eq,
			StatSummary:         rg.StatSummary,
			AtkBonus:            rg.AtkBonus,
			HpBonus:             rg.HpBonus,
			DefBonus:            rg.DefBonus,
			MoveCooldownMs:      rg.MoveCooldownMs,
			SafeSlots:           rg.SafeSlots,
			Costs:               costsDTO,
			CanCraft:            canCraft,
		})
	}

	mapBuffCardDTO := func(code string) *empire.RaidBuffCardDTO {
		spec, ok := domain.FindRaidBuffCardSpec(code)
		if !ok {
			return nil
		}
		costsDTO := make([]*empire.CostItemDTO, 0, len(spec.CostsMilli))
		canBuy := true
		for _, rKey := range costOrderAll {
			reqMilli, exists := spec.CostsMilli[rKey]
			if !exists {
				continue
			}
			curMilli := p.ResourcesMilli[rKey]
			if curMilli < reqMilli {
				canBuy = false
			}
			costsDTO = append(costsDTO, &empire.CostItemDTO{
				ResourceKey:   rKey,
				ResourceName:  domain.ResourceName(rKey),
				RequiredMilli: reqMilli,
				CapacityMilli: domain.ResourceCapacityMilli(p, rKey),
				CurrentMilli:  curMilli,
				EtaSeconds:    computeETASeconds(reqMilli, curMilli, rates[rKey]),
			})
		}
		return &empire.RaidBuffCardDTO{
			CardCode:      spec.CardCode,
			Name:          spec.Name,
			Category:      spec.Category,
			Rarity:        spec.Rarity,
			EffectSummary: spec.EffectSummary,
			Costs:         costsDTO,
			CanBuy:        canBuy,
		}
	}

	equippedBuffsDTO := make([]*empire.RaidBuffCardDTO, 0, len(p.RaidLoadout.EquippedBuffCards))
	for _, code := range p.RaidLoadout.EquippedBuffCards {
		if dto := mapBuffCardDTO(code); dto != nil {
			equippedBuffsDTO = append(equippedBuffsDTO, dto)
		}
	}
	draftPoolDTO := make([]*empire.RaidBuffCardDTO, 0, len(p.RaidLoadout.DraftPoolCards))
	for _, code := range p.RaidLoadout.DraftPoolCards {
		if dto := mapBuffCardDTO(code); dto != nil {
			draftPoolDTO = append(draftPoolDTO, dto)
		}
	}

	rerollCostsDTO := make([]*empire.CostItemDTO, 0, len(domain.RaidRerollCostsMilli))
	canReroll := true
	for _, rKey := range costOrderAll {
		reqMilli, exists := domain.RaidRerollCostsMilli[rKey]
		if !exists {
			continue
		}
		curMilli := p.ResourcesMilli[rKey]
		if curMilli < reqMilli {
			canReroll = false
		}
		rerollCostsDTO = append(rerollCostsDTO, &empire.CostItemDTO{
			ResourceKey:   rKey,
			ResourceName:  domain.ResourceName(rKey),
			RequiredMilli: reqMilli,
			CapacityMilli: domain.ResourceCapacityMilli(p, rKey),
			CurrentMilli:  curMilli,
			EtaSeconds:    computeETASeconds(reqMilli, curMilli, rates[rKey]),
		})
	}

	maxHP, atk, def, moveCD, durSec, bagCap, safeSlots := domain.ComputeRaidLoadoutStats(p)
	eqPotions := make([]string, 0, len(p.RaidLoadout.EquippedPotions))
	for _, pk := range p.RaidLoadout.EquippedPotions {
		if p.RaidGearInventory[pk] > 0 {
			eqPotions = append(eqPotions, pk)
		}
	}

	mapLootSlice := func(items []domain.RaidLootItem) []*empire.RaidLootItemDTO {
		out := make([]*empire.RaidLootItemDTO, 0, len(items))
		for _, it := range items {
			out = append(out, &empire.RaidLootItemDTO{
				ID:       it.ID,
				Key:      it.Key,
				Name:     it.Name,
				Rarity:   it.Rarity,
				Category: it.Category,
			})
		}
		return out
	}

	var activeSessionDTO *empire.RaidSessionDTO
	if sess := p.RaidLoadout.ActiveSession; sess != nil {
		nowUTC := time.Now().UTC()
		remMs := sess.ExpiresAt.Sub(nowUTC).Milliseconds()
		if remMs < 0 {
			remMs = 0
		}
		galeRemMs := sess.GaleEndsAt.Sub(nowUTC).Milliseconds()
		if galeRemMs < 0 {
			galeRemMs = 0
		}
		scavRemMs := sess.ScavEndsAt.Sub(nowUTC).Milliseconds()
		if scavRemMs < 0 {
			scavRemMs = 0
		}
		effMoveCD := domain.RaidMoveCooldownMs(sess, nowUTC)

		zonesDTO := make([]*empire.RaidZoneViewDTO, 0, len(sess.Zones))
		for _, zn := range sess.Zones {
			tilesDTO := make([]*empire.RaidTileViewDTO, 0, len(zn.Tiles))
			var exploredCount int32
			for _, t := range zn.Tiles {
				if !t.Explored {
					// Zero-Trust Fog-of-War clipping: hide unexplored tile contents from wire DTO
					tilesDTO = append(tilesDTO, &empire.RaidTileViewDTO{
						X:                t.X,
						Y:                t.Y,
						Kind:             "fog",
						Explored:         false,
						Looted:           false,
						EnemyName:        "",
						EnemyHp:          0,
						EnemyMaxHp:       0,
						EnemyAtk:         0,
						PortalTargetZone: -1,
						PortalLabel:      "",
						ChannelMs:        0,
					})
				} else {
					exploredCount++
					chMs := domain.RaidChannelDurationMs[t.Kind]

					tilesDTO = append(tilesDTO, &empire.RaidTileViewDTO{
						X:                t.X,
						Y:                t.Y,
						Kind:             t.Kind,
						Explored:         true,
						Looted:           t.Looted,
						EnemyName:        t.EnemyName,
						EnemyHp:          t.EnemyHP,
						EnemyMaxHp:       t.EnemyMaxHP,
						EnemyAtk:         t.EnemyAtk,
						PortalTargetZone: t.PortalTargetZone,
						PortalLabel:      t.PortalLabel,
						ChannelMs:        chMs,
					})
				}
			}
			zonesDTO = append(zonesDTO, &empire.RaidZoneViewDTO{
				ID:            zn.ID,
				Name:          zn.Name,
				Subtitle:      zn.Subtitle,
				Width:         zn.Width,
				Height:        zn.Height,
				Visited:       zn.Visited,
				ExploredCount: exploredCount,
				Tiles:         tilesDTO,
			})
		}
		activeSessionDTO = &empire.RaidSessionDTO{
			RaidId:                  sess.RaidID,
			LastCommandSeq:          sess.LastCommandSeq,
			ChannelRemainingMs:      max(int64(0), sess.ChannelReadyAt.Sub(nowUTC).Milliseconds()),
			CurrentZoneId:           sess.CurrentZoneID,
			PlayerX:                 sess.PlayerX,
			PlayerY:                 sess.PlayerY,
			Facing:                  sess.Facing,
			Hp:                      sess.HP,
			MaxHp:                   sess.MaxHP,
			Atk:                     sess.Atk,
			Def:                     sess.Def,
			CheatDeathActive:        sess.CheatDeathActive,
			TimeRemainingMs:         remMs,
			EffectiveMoveCooldownMs: effMoveCD,
			GaleRemainingMs:         galeRemMs,
			ScavRemainingMs:         scavRemMs,
			UsedPotionKeys:          append([]string{}, sess.UsedPotionKeys...),
			Backpack:                mapLootSlice(sess.Backpack),
			SafeBox:                 mapLootSlice(sess.SafeBox),
			ActiveChestDrops:        mapLootSlice(sess.ActiveChestDrops),
			ActiveContainerTitle:    sess.ActiveContainerTitle,
			Logs:                    append([]string{}, sess.Logs...),
			ZonesVisitedCount:       sess.ZonesVisitedCount,
			ChestsOpenedCount:       sess.ChestsOpenedCount,
			BossesKilledCount:       sess.BossesKilledCount,
			Zones:                   zonesDTO,
		}
	}

	var lastSettlementDTO *empire.RaidSettlementReportDTO
	if rep := p.RaidLoadout.LastSettlementReport; rep != nil {
		lastSettlementDTO = &empire.RaidSettlementReportDTO{
			Status:        rep.Status,
			RaidId:        rep.RaidID,
			BackpackItems: mapLootSlice(rep.BackpackItems),
			SafeBoxItems:  mapLootSlice(rep.SafeBoxItems),
			LostGearNames: append([]string{}, rep.LostGearNames...),
			ZonesVisited:  rep.ZonesVisited,
			ChestsOpened:  rep.ChestsOpened,
			BossesKilled:  rep.BossesKilled,
		}
	}

	raidLoadoutDTO := &empire.RaidLoadoutStateDTO{
		WeaponKey:           p.RaidLoadout.WeaponKey,
		ArmorKey:            p.RaidLoadout.ArmorKey,
		BootsKey:            p.RaidLoadout.BootsKey,
		SafeBoxKey:          p.RaidLoadout.SafeBoxKey,
		SafeSlotCount:       safeSlots,
		EquippedPotions:     eqPotions,
		EquippedBuffCards:   equippedBuffsDTO,
		DraftPoolCards:      draftPoolDTO,
		RerollCosts:         rerollCostsDTO,
		CanReroll:           canReroll,
		TotalMaxHp:          maxHP,
		TotalAtk:            atk,
		TotalDef:            def,
		MoveCooldownMs:      moveCD,
		RaidDurationSeconds: durSec,
		BackpackCapacity:    bagCap,

		ActiveSession:        activeSessionDTO,
		LastSettlementReport: lastSettlementDTO,
	}

	return equippedCosDTO, cosmeticsDTO, raidGearsDTO, raidLoadoutDTO
}

func mapRaidUpdate(p *domain.PlayerState) *empire.RaidUpdateResp {
	_, _, _, loadout := mapRaidPresentation(p)
	if sess := loadout.ActiveSession; sess != nil {
		// Previous zones remain in the client cache; only the current zone can change.
		for _, zone := range sess.Zones {
			if zone.ID == sess.CurrentZoneId {
				sess.Zones = []*empire.RaidZoneViewDTO{zone}
				break
			}
		}
	}
	return &empire.RaidUpdateResp{PlayerHandle: p.Handle, Revision: p.Revision, RaidLoadout: loadout}
}
