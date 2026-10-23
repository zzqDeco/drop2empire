package domain

import (
	"fmt"
	"time"
)

func DefaultWarNodes() []WarNodeState {
	return []WarNodeState{
		{
			NodeID:          "node_west_base",
			Name:            "曜石大本营",
			Region:          "west",
			X:               90,
			Y:               210,
			OwnerGuild:      GuildObsidian,
			DefenseBonusPct: 25,
			DailyScore:      15,
			IsTreasureVault: false,
			ObsidianTroops:  Troops{Infantry: 18, Archer: 14, Cavalry: 12},
			PlayerDeployed:  map[string]Troops{},
			IntelNote:       "黑曜大本营",
		},
		{
			NodeID:          "node_west_outpost",
			Name:            "西境前哨",
			Region:          "west",
			X:               260,
			Y:               210,
			OwnerGuild:      GuildObsidian,
			DefenseBonusPct: 25,
			DailyScore:      20,
			IsTreasureVault: false,
			ObsidianTroops:  Troops{Infantry: 12, Archer: 10, Cavalry: 8},
			PlayerDeployed:  map[string]Troops{},
			IntelNote:       "西线咽喉",
		},
		{
			NodeID:          "node_north_fort",
			Name:            "北侧据点",
			Region:          "north",
			X:               430,
			Y:               95,
			OwnerGuild:      GuildNeutral,
			DefenseBonusPct: 25,
			DailyScore:      30,
			IsTreasureVault: false,
			NeutralGarrison: Troops{Infantry: 8, Archer: 6, Cavalry: 4},
			PlayerDeployed:  map[string]Troops{},
			IntelNote:       "北线高地",
		},
		{
			NodeID:          "node_south_ferry",
			Name:            "南侧渡口",
			Region:          "south",
			X:               500,
			Y:               325,
			OwnerGuild:      GuildNeutral,
			DefenseBonusPct: 25,
			DailyScore:      30,
			IsTreasureVault: false,
			NeutralGarrison: Troops{Infantry: 5, Archer: 10, Cavalry: 4},
			PlayerDeployed:  map[string]Troops{},
			IntelNote:       "南线水路",
		},
		{
			NodeID:          "node_center_vault",
			Name:            "中央宝藏城 ★",
			Region:          "center",
			X:               530,
			Y:               200,
			OwnerGuild:      GuildNeutral,
			DefenseBonusPct: 25,
			DailyScore:      60,
			IsTreasureVault: true,
			NeutralGarrison: Troops{Infantry: 14, Archer: 14, Cavalry: 14},
			PlayerDeployed:  map[string]Troops{},
			IntelNote:       "核心要塞",
		},
		{
			NodeID:          "node_east_fort",
			Name:            "东侧据点",
			Region:          "east",
			X:               660,
			Y:               95,
			OwnerGuild:      GuildNeutral,
			DefenseBonusPct: 25,
			DailyScore:      30,
			IsTreasureVault: false,
			NeutralGarrison: Troops{Infantry: 6, Archer: 6, Cavalry: 9},
			PlayerDeployed:  map[string]Troops{},
			IntelNote:       "东境要塞",
		},
		{
			NodeID:          "node_east_outpost",
			Name:            "东境前哨",
			Region:          "east",
			X:               760,
			Y:               210,
			OwnerGuild:      GuildArgent,
			DefenseBonusPct: 25,
			DailyScore:      20,
			IsTreasureVault: false,
			ArgentTroops:    Troops{Infantry: 12, Archer: 10, Cavalry: 8},
			PlayerDeployed:  map[string]Troops{},
			IntelNote:       "东线枢纽",
		},
		{
			NodeID:          "node_east_base",
			Name:            "白银大本营",
			Region:          "east",
			X:               910,
			Y:               210,
			OwnerGuild:      GuildArgent,
			DefenseBonusPct: 25,
			DailyScore:      15,
			IsTreasureVault: false,
			ArgentTroops:    Troops{Infantry: 18, Archer: 14, Cavalry: 12},
			PlayerDeployed:  map[string]Troops{},
			IntelNote:       "白银大本营",
		},
	}
}

func DefaultWarEdges() []WarEdge {
	return []WarEdge{
		{FromNode: "node_west_base", ToNode: "node_west_outpost"},
		{FromNode: "node_west_outpost", ToNode: "node_north_fort"},
		{FromNode: "node_west_outpost", ToNode: "node_south_ferry"},
		{FromNode: "node_north_fort", ToNode: "node_south_ferry"},
		{FromNode: "node_north_fort", ToNode: "node_center_vault"},
		{FromNode: "node_south_ferry", ToNode: "node_center_vault"},
		{FromNode: "node_center_vault", ToNode: "node_east_fort"},
		{FromNode: "node_south_ferry", ToNode: "node_east_outpost"},
		{FromNode: "node_east_fort", ToNode: "node_east_outpost"},
		{FromNode: "node_east_outpost", ToNode: "node_east_base"},
	}
}

func GuildBaseNode(guild string) string {
	if guild == GuildArgent {
		return "node_east_base"
	}
	return "node_west_base"
}

func SupplyConnectedNodes(w *WorldState, guild string) map[string]bool {
	baseID := GuildBaseNode(guild)
	owned := make(map[string]bool, len(w.WarNodes))
	for _, n := range w.WarNodes {
		if n.OwnerGuild == guild {
			owned[n.NodeID] = true
		}
	}
	connected := make(map[string]bool)
	if !owned[baseID] {
		return connected
	}
	adj := make(map[string][]string)
	for _, e := range w.WarEdges {
		adj[e.FromNode] = append(adj[e.FromNode], e.ToNode)
		adj[e.ToNode] = append(adj[e.ToNode], e.FromNode)
	}
	queue := []string{baseID}
	connected[baseID] = true
	for len(queue) > 0 {
		cur := queue[0]
		queue = queue[1:]
		for _, nb := range adj[cur] {
			if owned[nb] && !connected[nb] {
				connected[nb] = true
				queue = append(queue, nb)
			}
		}
	}
	return connected
}

func DeployableNodes(w *WorldState, guild string) map[string]bool {
	connected := SupplyConnectedNodes(w, guild)
	deployable := make(map[string]bool)
	for id := range connected {
		deployable[id] = true
	}
	for _, e := range w.WarEdges {
		if connected[e.FromNode] {
			deployable[e.ToNode] = true
		}
		if connected[e.ToNode] {
			deployable[e.FromNode] = true
		}
	}
	return deployable
}

func DeployWarTroops(w *WorldState, p *PlayerState, nodeID string, infDelta, arcDelta, cavDelta int32, now time.Time) error {
	if p.Profession == ProfNone {
		return ErrPrecondition("war_locked", "请先开启【神秘的宝藏】并选择职业后再参与商会战争")
	}
	if infDelta < 0 || arcDelta < 0 || cavDelta < 0 {
		return ErrInvalidInput("部署军备数量必须为非负整数")
	}
	totalAdd := infDelta + arcDelta + cavDelta
	if totalAdd <= 0 {
		return ErrInvalidInput("请至少选择 1 单位军备进行部署")
	}
	if p.DailyWarBudgetUsed+totalAdd > DailyWarBudgetCap {
		return ErrPrecondition("daily_budget_exceeded", fmt.Sprintf("超出每日个人军备投入上限（%d/%d 点）", p.DailyWarBudgetUsed, DailyWarBudgetCap))
	}

	deployable := DeployableNodes(w, p.GuildCode)
	if !deployable[nodeID] {
		return ErrPrecondition("supply_disconnected", "该城池与己方补给线不相连，只能向已连通城池或相邻 1 条边的目标出兵")
	}

	var targetNode *WarNodeState
	for i := range w.WarNodes {
		if w.WarNodes[i].NodeID == nodeID {
			targetNode = &w.WarNodes[i]
			break
		}
	}
	if targetNode == nil {
		return ErrNotFound("未知的战略城池节点")
	}

	needInf := int64(infDelta) * ResourceScale
	needArc := int64(arcDelta) * ResourceScale
	needCav := int64(cavDelta) * ResourceScale
	if p.ResourcesMilli[ResInfantryKit] < needInf {
		return ErrPrecondition("insufficient_infantry", "仓库中【重步兵军备箱】不足，请先在工坊制造或在交易所采购")
	}
	if p.ResourcesMilli[ResArcherKit] < needArc {
		return ErrPrecondition("insufficient_archer", "仓库中【长弓兵军备箱】不足，请先在工坊制造或在交易所采购")
	}
	if p.ResourcesMilli[ResCavalryKit] < needCav {
		return ErrPrecondition("insufficient_cavalry", "仓库中【铁甲骑兵军备箱】不足，请先在工坊制造或在交易所采购")
	}

	p.ResourcesMilli[ResInfantryKit] -= needInf
	p.ResourcesMilli[ResArcherKit] -= needArc
	p.ResourcesMilli[ResCavalryKit] -= needCav
	p.DailyWarBudgetUsed += totalAdd

	if targetNode.PlayerDeployed == nil {
		targetNode.PlayerDeployed = make(map[string]Troops)
	}
	cur := targetNode.PlayerDeployed[p.Handle]
	cur.Infantry += infDelta
	cur.Archer += arcDelta
	cur.Cavalry += cavDelta
	targetNode.PlayerDeployed[p.Handle] = cur

	if p.GuildCode == GuildArgent {
		targetNode.ArgentTroops.Infantry += infDelta
		targetNode.ArgentTroops.Archer += arcDelta
		targetNode.ArgentTroops.Cavalry += cavDelta
	} else {
		targetNode.ObsidianTroops.Infantry += infDelta
		targetNode.ObsidianTroops.Archer += arcDelta
		targetNode.ObsidianTroops.Cavalry += cavDelta
	}

	AppendLog(p, now, "WAR", fmt.Sprintf("已向【%s】部署军团：步兵 +%d / 弓兵 +%d / 骑兵 +%d（今日已用预算 %d/%d）。",
		targetNode.Name, infDelta, arcDelta, cavDelta, p.DailyWarBudgetUsed, DailyWarBudgetCap))
	return nil
}

func ComputeWeightedPower(side Troops, opp Troops, defenseBonusPct int32) int64 {
	totalSide := side.Total()
	if totalSide <= 0 {
		return 0
	}
	totalOpp := opp.Total()
	kBps := [3][3]int64{
		{10000, 11500, 9000},
		{9000, 10000, 11500},
		{11500, 9000, 10000},
	}
	sArr := [3]int64{int64(side.Infantry), int64(side.Archer), int64(side.Cavalry)}
	oArr := [3]int64{int64(opp.Infantry), int64(opp.Archer), int64(opp.Cavalry)}

	var weightedMilli int64
	if totalOpp <= 0 {
		weightedMilli = int64(totalSide) * 1000
	} else {
		var numer int64
		for i := 0; i < 3; i++ {
			if sArr[i] == 0 {
				continue
			}
			var inner int64
			for j := 0; j < 3; j++ {
				inner += oArr[j] * kBps[i][j]
			}
			numer += sArr[i] * inner
		}
		weightedMilli = numer / (int64(totalOpp) * 10)
	}

	if defenseBonusPct > 0 {
		weightedMilli = (weightedMilli * int64(100+defenseBonusPct)) / 100
	}
	return weightedMilli
}

func ApplyAttrition(t Troops, lossPct int32) Troops {
	keepPct := int64(100 - lossPct)
	return Troops{
		Infantry: int32((int64(t.Infantry) * keepPct) / 100),
		Archer:   int32((int64(t.Archer) * keepPct) / 100),
		Cavalry:  int32((int64(t.Cavalry) * keepPct) / 100),
	}
}

func SettleWarDay(w *WorldState, activePlayer *PlayerState, now time.Time) {
	for i := range w.WarNodes {
		n := &w.WarNodes[i]
		switch n.NodeID {
		case "node_north_fort":
			n.ObsidianTroops.Cavalry += 4
			n.ArgentTroops.Archer += 3
		case "node_south_ferry":
			n.ObsidianTroops.Infantry += 4
			n.ArgentTroops.Cavalry += 4
		case "node_center_vault":
			n.ObsidianTroops.Infantry += 5
			n.ObsidianTroops.Archer += 4
			n.ArgentTroops.Infantry += 4
			n.ArgentTroops.Cavalry += 5
		case "node_east_fort":
			n.ArgentTroops.Archer += 5
		}
	}

	reports := make([]WarBattleNodeReport, 0, len(w.WarNodes))
	var obsDelta, argDelta int32

	for i := range w.WarNodes {
		n := &w.WarNodes[i]
		prevOwner := n.OwnerGuild
		obs := n.ObsidianTroops
		arg := n.ArgentTroops
		neu := n.NeutralGarrison

		var atkMilli, defMilli int64
		winner := prevOwner
		casualtyText := "无交火，驻军维持警戒"

		switch prevOwner {
		case GuildObsidian:
			if arg.Total() > 0 {
				atkMilli = ComputeWeightedPower(arg, obs, 0)
				defMilli = ComputeWeightedPower(obs, arg, n.DefenseBonusPct)
				if atkMilli > defMilli {
					winner = GuildArgent
					n.ArgentTroops = ApplyAttrition(arg, 20)
					n.ObsidianTroops = ApplyAttrition(obs, 40)
					casualtyText = "白银同盟攻破城防（胜方战损 20%，守军战损 40%）"
				} else {
					winner = GuildObsidian
					n.ObsidianTroops = ApplyAttrition(obs, 20)
					n.ArgentTroops = ApplyAttrition(arg, 40)
					casualtyText = fmt.Sprintf("黑曜商会依托 +%d%% 城防成功守住节点（守军战损 20%%，攻方战损 40%%）", n.DefenseBonusPct)
				}
			} else {
				defMilli = ComputeWeightedPower(obs, Troops{}, n.DefenseBonusPct)
			}

		case GuildArgent:
			if obs.Total() > 0 {
				atkMilli = ComputeWeightedPower(obs, arg, 0)
				defMilli = ComputeWeightedPower(arg, obs, n.DefenseBonusPct)
				if atkMilli > defMilli {
					winner = GuildObsidian
					n.ObsidianTroops = ApplyAttrition(obs, 20)
					n.ArgentTroops = ApplyAttrition(arg, 40)
					casualtyText = "黑曜商会攻克城池（胜方战损 20%，守军战损 40%）"
				} else {
					winner = GuildArgent
					n.ArgentTroops = ApplyAttrition(arg, 20)
					n.ObsidianTroops = ApplyAttrition(obs, 40)
					casualtyText = fmt.Sprintf("白银同盟依托 +%d%% 城防击退进攻（守军战损 20%%，攻方战损 40%%）", n.DefenseBonusPct)
				}
			} else {
				defMilli = ComputeWeightedPower(arg, Troops{}, n.DefenseBonusPct)
			}

		default: // NEUTRAL
			obsAtk := ComputeWeightedPower(obs, neu, 0)
			argAtk := ComputeWeightedPower(arg, neu, 0)
			neuDef := ComputeWeightedPower(neu, Troops{
				Infantry: obs.Infantry + arg.Infantry,
				Archer:   obs.Archer + arg.Archer,
				Cavalry:  obs.Cavalry + arg.Cavalry,
			}, n.DefenseBonusPct)
			defMilli = neuDef
			if obsAtk >= argAtk {
				atkMilli = obsAtk
				if obsAtk > neuDef && obs.Total() > 0 {
					winner = GuildObsidian
					n.ObsidianTroops = ApplyAttrition(obs, 20)
					n.ArgentTroops = ApplyAttrition(arg, 40)
					n.NeutralGarrison = Troops{}
					casualtyText = "黑曜商会击败中立守军与竞争者，夺取城池控制权"
				} else if obs.Total() > 0 || arg.Total() > 0 {
					n.ObsidianTroops = ApplyAttrition(obs, 40)
					n.ArgentTroops = ApplyAttrition(arg, 40)
					n.NeutralGarrison = ApplyAttrition(neu, 20)
					casualtyText = "进攻火力未突破中立城防（+25%），双方部队受创撤退"
				}
			} else {
				atkMilli = argAtk
				if argAtk > neuDef && arg.Total() > 0 {
					winner = GuildArgent
					n.ArgentTroops = ApplyAttrition(arg, 20)
					n.ObsidianTroops = ApplyAttrition(obs, 40)
					n.NeutralGarrison = Troops{}
					casualtyText = "白银同盟击败中立守军与竞争者，夺取城池控制权"
				} else {
					n.ObsidianTroops = ApplyAttrition(obs, 40)
					n.ArgentTroops = ApplyAttrition(arg, 40)
					n.NeutralGarrison = ApplyAttrition(neu, 20)
					casualtyText = "进攻火力未突破中立城防（+25%），双方部队受创撤退"
				}
			}
		}

		n.OwnerGuild = winner
		if winner == GuildObsidian {
			obsDelta += n.DailyScore
		} else if winner == GuildArgent {
			argDelta += n.DailyScore
		}

		reports = append(reports, WarBattleNodeReport{
			NodeID:                n.NodeID,
			NodeName:              n.Name,
			PrevOwner:             prevOwner,
			NewOwner:              winner,
			ObsidianInfantry:      obs.Infantry,
			ObsidianArcher:        obs.Archer,
			ObsidianCavalry:       obs.Cavalry,
			ArgentInfantry:        arg.Infantry,
			ArgentArcher:          arg.Archer,
			ArgentCavalry:         arg.Cavalry,
			EffectiveAttackMilli:  atkMilli,
			EffectiveDefenseMilli: defMilli,
			Winner:                winner,
			CasualtySummary:       casualtyText,
		})
	}

	w.ObsidianScore += obsDelta
	w.ArgentScore += argDelta

	var activeEarned int32
	activeSubmitted := activePlayer.DailyWarBudgetUsed
	for _, p := range w.Players {
		basePts := int32(45)
		if (p.GuildCode == GuildObsidian && obsDelta >= argDelta) || (p.GuildCode == GuildArgent && argDelta > obsDelta) {
			basePts = 75
		}
		contribPts := p.DailyWarBudgetUsed * 3
		earned := basePts + contribPts
		p.ActivityPoints += earned

		stipend := int64(80+p.DailyWarBudgetUsed*4) * GoldScale
		if w.TreasuryHeldBasis >= stipend {
			w.TreasuryHeldBasis -= stipend
			p.GoldBasis += stipend
		}
		if p.Handle == activePlayer.Handle {
			activeEarned = earned
		}
		p.DailyWarBudgetUsed = 0
	}

	settlement := WarDaySettlement{
		DayIndex:              w.WarDay,
		SettledAt:             now.UTC().Format("2006-01-02 15:04:05"),
		ObsidianScoreDelta:    obsDelta,
		ArgentScoreDelta:      argDelta,
		PlayerPointsEarned:    activeEarned,
		PlayerBudgetSubmitted: activeSubmitted,
		NodeReports:           reports,
	}
	w.WarHistory = append([]WarDaySettlement{settlement}, w.WarHistory...)
	if len(w.WarHistory) > 14 {
		w.WarHistory = w.WarHistory[:14]
	}

	AppendLog(activePlayer, now, "WAR", fmt.Sprintf("★ 第 D%d 晚 20:00 商会战争结算完成！黑曜 +%d 分 / 白银 +%d 分，你获得 +%d 活动点数与财政军饷补贴。",
		w.WarDay, obsDelta, argDelta, activeEarned))

	w.WarDay++
	if w.WarDay > 7 {
		w.WarDay = 1
	}
}
