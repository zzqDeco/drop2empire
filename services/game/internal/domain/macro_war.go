package domain

import (
	"fmt"
	"strings"
	"time"
)

func DefaultGuilds() []GuildState {
	return []GuildState{
		{
			GuildID:           "guild_obsidian_vanguard",
			Name:              "墨械先驱团",
			Tag:               "INK",
			Faction:           GuildObsidian,
			LeaderHandle:      "archon_demo",
			Level:             3,
			XP:                420,
			TreasuryGoldBasis: 650 * GoldScale,
			RallyNodeID:       "node_north_fort",
			Announcement:      "以水力与黑曜齿轮构筑西线铁壁，优先集结北侧据点！",
			Members: []GuildMember{
				{Handle: "archon_demo", Role: "会长", Contribution: 680, WarDeployed: 28},
				{Handle: "墨匠·玄枢", Role: "副会长", Contribution: 420, WarDeployed: 18},
				{Handle: "铁砧·墨衡", Role: "精锐", Contribution: 260, WarDeployed: 12},
			},
		},
		{
			GuildID:           "guild_obsidian_iron",
			Name:              "黑曜铁卫公会",
			Tag:               "IRON",
			Faction:           GuildObsidian,
			LeaderHandle:      "重甲督军·岩罡",
			Level:             2,
			XP:                260,
			TreasuryGoldBasis: 320 * GoldScale,
			RallyNodeID:       "node_south_ferry",
			Announcement:      "专司南线渡口重步兵攻坚，欢迎巨匠与炼金师加盟。",
			Members: []GuildMember{
				{Handle: "重甲督军·岩罡", Role: "会长", Contribution: 450, WarDeployed: 22},
				{Handle: "燧火·赤锤", Role: "精锐", Contribution: 190, WarDeployed: 10},
			},
		},
		{
			GuildID:           "guild_argent_astral",
			Name:              "白银星界议会",
			Tag:               "ASTR",
			Faction:           GuildArgent,
			LeaderHandle:      "星轨大导师·凛月",
			Level:             3,
			XP:                410,
			TreasuryGoldBasis: 600 * GoldScale,
			RallyNodeID:       "node_east_fort",
			Announcement:      "星盘所指即为白银疆域，协同夺取东侧据点与中央宝藏城。",
			Members: []GuildMember{
				{Handle: "星轨大导师·凛月", Role: "会长", Contribution: 640, WarDeployed: 26},
				{Handle: "银羽·星河", Role: "精锐", Contribution: 290, WarDeployed: 14},
			},
		},
		{
			GuildID:           "guild_argent_hermes",
			Name:              "赫尔墨斯炼金会",
			Tag:               "ALCH",
			Faction:           GuildArgent,
			LeaderHandle:      "翠玉炼金师·维克",
			Level:             2,
			XP:                240,
			TreasuryGoldBasis: 280 * GoldScale,
			RallyNodeID:       "node_center_vault",
			Announcement:      "海量催化剂与附魔卷轴后勤支援，直插中央宝藏城。",
			Members: []GuildMember{
				{Handle: "翠玉炼金师·维克", Role: "会长", Contribution: 410, WarDeployed: 18},
				{Handle: "白银之翼", Role: "成员", Contribution: 150, WarDeployed: 8},
			},
		},
	}
}

func EnsureGuildState(w *WorldState) {
	if len(w.Guilds) == 0 {
		w.Guilds = DefaultGuilds()
	}
	if w.NextGuildSeq < 10 {
		w.NextGuildSeq = 10
	}
	if vet, ok := w.Players["archon_demo"]; ok && vet != nil && vet.JoinedGuildID == "" {
		vet.JoinedGuildID = "guild_obsidian_vanguard"
		vet.GuildCode = GuildObsidian
		if vet.GuildContribution == 0 {
			vet.GuildContribution = 680
		}
	}
}

func FindGuild(w *WorldState, guildID string) *GuildState {
	for i := range w.Guilds {
		if w.Guilds[i].GuildID == guildID {
			return &w.Guilds[i]
		}
	}
	return nil
}

func GuildNextLevelXP(level int32) int64 {
	if level < 1 {
		level = 1
	}
	return int64(level) * 500
}

func GuildBonusSummary(level int32, faction string) string {
	factionLabel := "黑曜商会"
	if faction == GuildArgent {
		factionLabel = "白银同盟"
	}
	return fmt.Sprintf("%s直属 · Lv.%d 公会战旗：集结目标城池攻防 +%d%%，每日战区结算额外 +%d 活动积分",
		factionLabel, level, 10+level*3, level*5)
}

func addGuildXP(g *GuildState, delta int64) {
	g.XP += delta
	for g.Level < 10 && g.XP >= GuildNextLevelXP(g.Level) {
		g.XP -= GuildNextLevelXP(g.Level)
		g.Level++
	}
}

func removeMemberFromAllGuilds(w *WorldState, handle string) {
	for i := range w.Guilds {
		g := &w.Guilds[i]
		filtered := make([]GuildMember, 0, len(g.Members))
		for _, m := range g.Members {
			if m.Handle != handle {
				filtered = append(filtered, m)
			}
		}
		g.Members = filtered
	}
}

func addOrUpdateGuildMember(g *GuildState, handle, role string, contribDelta int64, deployedDelta int32) {
	for i := range g.Members {
		if g.Members[i].Handle == handle {
			g.Members[i].Contribution += contribDelta
			g.Members[i].WarDeployed += deployedDelta
			return
		}
	}
	if role == "" {
		role = "成员"
	}
	g.Members = append(g.Members, GuildMember{
		Handle:       handle,
		Role:         role,
		Contribution: contribDelta,
		WarDeployed:  deployedDelta,
	})
}

func PerformGuildAction(w *WorldState, p *PlayerState, action, guildID, name, tag, faction, rallyNodeID string, now time.Time) error {
	EnsureGuildState(w)
	act := strings.ToLower(strings.TrimSpace(action))

	switch act {
	case "join":
		g := FindGuild(w, strings.TrimSpace(guildID))
		if g == nil {
			return ErrNotFound("未找到目标公会")
		}
		removeMemberFromAllGuilds(w, p.Handle)
		addOrUpdateGuildMember(g, p.Handle, "成员", 0, 0)
		p.JoinedGuildID = g.GuildID
		p.GuildCode = g.Faction
		AppendLog(p, now, "WAR", fmt.Sprintf("已加入公会【[%s] %s】（所属商会：%s），现在可协同公会战友出兵争夺城池！",
			g.Tag, g.Name, g.Faction))
		return nil

	case "create":
		cleanName := strings.TrimSpace(name)
		cleanTag := strings.ToUpper(strings.TrimSpace(tag))
		cleanFaction := strings.ToUpper(strings.TrimSpace(faction))
		if len([]rune(cleanName)) < 2 || len([]rune(cleanName)) > 16 {
			return ErrInvalidInput("公会名称长度需在 2 至 16 个字符之间")
		}
		if len(cleanTag) < 2 || len(cleanTag) > 4 {
			return ErrInvalidInput("公会徽标简称需为 2 至 4 位字母或数字")
		}
		if cleanFaction != GuildObsidian && cleanFaction != GuildArgent {
			cleanFaction = GuildObsidian
		}
		waterCost := MacroBalance.GuildCreateWaterCostMilli
		woodCost := MacroBalance.GuildCreateWoodCostMilli
		stoneCost := MacroBalance.GuildCreateStoneCostMilli
		if p.ResourcesMilli[ResWater] < waterCost || p.ResourcesMilli[ResWood] < woodCost || p.ResourcesMilli[ResStone] < stoneCost {
			return ErrPrecondition("insufficient_resources", "创建新公会需要建造驻地物资：清水 100、木材 60、石料 30")
		}
		p.ResourcesMilli[ResWater] -= waterCost
		p.ResourcesMilli[ResWood] -= woodCost
		p.ResourcesMilli[ResStone] -= stoneCost

		removeMemberFromAllGuilds(w, p.Handle)
		w.NextGuildSeq++
		newID := fmt.Sprintf("guild_custom_%d", w.NextGuildSeq)
		rally := "node_north_fort"
		if cleanFaction == GuildArgent {
			rally = "node_east_fort"
		}
		newG := GuildState{
			GuildID:           newID,
			Name:              cleanName,
			Tag:               cleanTag,
			Faction:           cleanFaction,
			LeaderHandle:      p.Handle,
			Level:             1,
			XP:                120,
			TreasuryGoldBasis: 0,
			RallyNodeID:       rally,
			Announcement:      fmt.Sprintf("由领主 %s 创立的墨械战团，全员协同争夺战区要塞！", p.Handle),
			Members: []GuildMember{
				{Handle: p.Handle, Role: "会长", Contribution: 100, WarDeployed: 0},
			},
		}
		w.Guilds = append([]GuildState{newG}, w.Guilds...)
		p.JoinedGuildID = newID
		p.GuildCode = cleanFaction
		p.GuildContribution += 100
		AppendLog(p, now, "WAR", fmt.Sprintf("★ 成功创立新公会【[%s] %s】（效忠 %s）！", cleanTag, cleanName, cleanFaction))
		return nil

	case "donate_supplies":
		if p.JoinedGuildID == "" {
			return ErrPrecondition("guild_required", "请先加入或创建一个公会")
		}
		g := FindGuild(w, p.JoinedGuildID)
		if g == nil {
			return ErrNotFound("当前所属公会不存在")
		}
		waterCost := int64(80) * ResourceScale
		woodCost := int64(50) * ResourceScale
		stoneCost := int64(25) * ResourceScale
		if p.ResourcesMilli[ResWater] < waterCost || p.ResourcesMilli[ResWood] < woodCost || p.ResourcesMilli[ResStone] < stoneCost {
			return ErrPrecondition("insufficient_resources", "公会后勤物资捐献需：清水 80、木材 50、石料 25")
		}
		p.ResourcesMilli[ResWater] -= waterCost
		p.ResourcesMilli[ResWood] -= woodCost
		p.ResourcesMilli[ResStone] -= stoneCost
		addGuildXP(g, 120)
		addOrUpdateGuildMember(g, p.Handle, "成员", 100, 0)
		p.GuildContribution += 100
		p.ActivityPoints += 15
		AppendLog(p, now, "WAR", fmt.Sprintf("向公会【%s】捐献后勤物资包：公会经验 +120，个人贡献 +100，活动积分 +15。", g.Name))
		return nil

	case "donate_gold":
		if p.JoinedGuildID == "" {
			return ErrPrecondition("guild_required", "请先加入或创建一个公会")
		}
		g := FindGuild(w, p.JoinedGuildID)
		if g == nil {
			return ErrNotFound("当前所属公会不存在")
		}
		goldCost := int64(50) * GoldScale
		if p.GoldBasis < goldCost {
			return ErrPrecondition("insufficient_gold", "公会军费捐献需 50.0000 金币")
		}
		p.GoldBasis -= goldCost
		w.TreasuryHeldBasis += goldCost
		g.TreasuryGoldBasis += goldCost
		addGuildXP(g, 200)
		addOrUpdateGuildMember(g, p.Handle, "成员", 180, 0)
		p.GuildContribution += 180
		p.ActivityPoints += 25
		AppendLog(p, now, "WAR", fmt.Sprintf("向公会【%s】金库捐献 50 金币：公会经验 +200，个人贡献 +180，活动积分 +25。", g.Name))
		return nil

	case "set_rally":
		if p.JoinedGuildID == "" {
			return ErrPrecondition("guild_required", "请先加入或创建一个公会")
		}
		g := FindGuild(w, p.JoinedGuildID)
		if g == nil {
			return ErrNotFound("当前所属公会不存在")
		}
		var targetName string
		for _, n := range w.WarNodes {
			if n.NodeID == rallyNodeID {
				targetName = n.Name
				break
			}
		}
		if targetName == "" {
			return ErrNotFound("未知的集结城池节点")
		}
		g.RallyNodeID = rallyNodeID
		AppendLog(p, now, "WAR", fmt.Sprintf("已将公会【%s】集结目标设为【%s】，全体成员向该城池派兵享集结加成！", g.Name, targetName))
		return nil

	default:
		return ErrInvalidInput("未知的公会操作指令")
	}
}

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
	EnsureGuildState(w)
	if p.Profession == ProfNone {
		return ErrPrecondition("war_locked", "请先开启【神秘的宝藏】并选择职业后再参与商会战争")
	}
	if p.JoinedGuildID == "" {
		return ErrPrecondition("guild_required", "请先在【公会大厅】加入或创建一个公会，再以公会名义向战区出兵")
	}
	guild := FindGuild(w, p.JoinedGuildID)
	if guild == nil {
		return ErrPrecondition("guild_required", "当前所属公会无效，请重新加入一个公会")
	}
	p.GuildCode = guild.Faction

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

	contribGain := int64(totalAdd) * 15
	p.GuildContribution += contribGain
	addGuildXP(guild, int64(totalAdd)*10)
	addOrUpdateGuildMember(guild, p.Handle, "成员", contribGain, totalAdd)

	rallyMsg := ""
	if guild.RallyNodeID == nodeID {
		p.ActivityPoints += 5
		rallyMsg = "（命中公会集结令目标，额外获得 +5 活动积分）"
	}

	AppendLog(p, now, "WAR", fmt.Sprintf("代表公会【%s】向【%s】部署军团：步兵 +%d / 弓兵 +%d / 骑兵 +%d（公会贡献 +%d，今日预算 %d/%d）%s。",
		guild.Name, targetNode.Name, infDelta, arcDelta, cavDelta, contribGain, p.DailyWarBudgetUsed, DailyWarBudgetCap, rallyMsg))
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
