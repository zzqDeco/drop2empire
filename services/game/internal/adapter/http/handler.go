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
		unlocked := meta.Key == domain.ResWater || amt > 0 || frz > 0
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
		if meta.Key == domain.ResAncientShard && p.UnlockedBlueprints[domain.BPScoutCamp] {
			unlocked = true
		}
		if (meta.Key == domain.ResIronIngot || meta.Key == domain.ResRation) && p.UnlockedBlueprints[domain.BPBasicWorkshop] && p.Profession != domain.ProfNone {
			unlocked = true
		}
		if p.Profession != domain.ProfNone {
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
		jobsDTO = append(jobsDTO, &empire.WorkerJobDTO{
			JobKey:                 cj.JobKey,
			Name:                   cj.Name,
			Assigned:               cj.Assigned,
			BaseRateMilli:          cj.BaseRateMilli,
			EffectiveRateMilli:     cj.EffectiveRateMilli,
			TotalOutputPerSecMilli: cj.TotalOutputPerSecMilli,
			EfficiencyPct:          cj.EfficiencyPct,
			Unlocked:               cj.Unlocked,
			UnlockHint:             cj.UnlockHint,
			InputSummary:           cj.InputSummary,
		})
	}

	presetsDTO := make([]*empire.AllocationPresetDTO, 0, len(p.Presets))
	for _, pr := range p.Presets {
		entries := make([]*empire.AllocationEntryDTO, 0, len(pr.Allocations))
		for _, k := range []string{domain.JobWater, domain.JobWood, domain.JobCharcoal, domain.JobStone, domain.JobSmeltIron, domain.JobPrepRation} {
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
		prereqOK := bp.PrerequisiteCode == "" || p.UnlockedBlueprints[bp.PrerequisiteCode]
		visible := false
		if unlocked {
			visible = true
		} else if p.PopulationTotal > 0 {
			switch bp.Code {
			case domain.BPFirstResident:
				visible = true
			case domain.BPAxeBlueprint:
				visible = p.UnlockedBlueprints[domain.BPFirstResident] || p.PopulationTotal >= 3
			default:
				visible = prereqOK
			}
		}

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
			if eta < 0 {
				maxETA = -1
			} else if maxETA >= 0 && eta > maxETA {
				maxETA = eta
			}
			costsDTO = append(costsDTO, &empire.CostItemDTO{
				ResourceKey:  rKey,
				ResourceName: domain.ResourceName(rKey),
				RequiredMilli: reqMilli,
				CurrentMilli:  curMilli,
				EtaSeconds:    eta,
			})
		}

		canUnlock := !unlocked && prereqOK && p.PopulationTotal >= bp.RequiredPopulation && allResourcesOK
		blueprintsDTO = append(blueprintsDTO, &empire.BlueprintNodeDTO{
			Code:               bp.Code,
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

	guildName := "黑曜商会 (OBSIDIAN)"
	if p.GuildCode == domain.GuildArgent {
		guildName = "白银同盟 (ARGENT)"
	}

	warDTO := &empire.WarStateDTO{
		SeasonCode:          w.SeasonCode,
		SeasonName:          w.SeasonName,
		CurrentDay:          w.WarDay,
		NextSettlementLabel: "每日 20:00 (UTC+8) 锁定快照结算",
		PlayerGuild:         p.GuildCode,
		PlayerGuildName:     guildName,
		PlayerRole:          "战略执政官 & 军需官",
		DailyBudgetUsed:     p.DailyWarBudgetUsed,
		DailyBudgetCap:      domain.DailyWarBudgetCap,
		ObsidianTotalScore:  w.ObsidianScore,
		ArgentTotalScore:    w.ArgentScore,
		Nodes:               warNodesDTO,
		Edges:               warEdgesDTO,
		SettlementHistory:   warHistDTO,
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

	noticesDTO := []*empire.SeasonNoticeDTO{
		{
			SeasonId:    "S1-CURRENT",
			Title:       "第一赛季 · 墨械纪元",
			EffectiveIn: "进行中",
			Summary:     "要塞驻防战力 +25%，铁锭、抽水机与步兵军备需求旺盛。",
			DemandShifts: []string{
				"自动抽水机（科学家）",
				"泰坦精锻工具组 & 重步兵军备（工匠）",
			},
		},
		{
			SeasonId:    "S2-PREVIEW-T7D",
			Title:       "第二赛季预告 · 秘法狂潮",
			EffectiveIn: "7 天后",
			Summary:     "新增酸雾沼泽与以太裂隙，催化剂与附魔卷轴需求上升。",
			DemandShifts: []string{
				"赫尔墨斯催化剂（炼金术士）",
				"星界附魔卷轴（魔法师）",
			},
		},
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

	costOrderAll := []string{domain.ResWater, domain.ResWood, domain.ResCharcoal, domain.ResStone, domain.ResFlint, domain.ResAncientShard, domain.ResIronIngot, domain.ResRation}

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
	if p.UnlockedBlueprints[domain.BPScoutCamp] {
		for _, cf := range domain.CaravanOfferCatalog {
			costsDTO := make([]*empire.CostItemDTO, 0, len(cf.CostsMilli))
			canTrade := true
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

	return &empire.DashboardStateResp{
		ServerTime:          time.Now().UTC().Format(time.RFC3339),
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
	}
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
			StrategyName:   r.StrategyName,
			Description:    r.Description,
			TotalSeconds:   r.TotalSeconds,
			FormattedTotal: r.FormattedTotal,
			Milestones:     msDTO,
		})
	}
	return &empire.Benchmark30mResp{
		Runs: runsDTO,
		Note: "模拟步长 0.5 秒，整数工人分配，仅开局手点 10 次水。V1 推荐策略通过引入引水轮、石刃锯台与宝藏三部件，彻底消除了第 9–30 分钟的纯挂机空窗期。",
	}, nil
}
