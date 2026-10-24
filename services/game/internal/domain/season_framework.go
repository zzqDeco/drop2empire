package domain

import (
	"fmt"
	"strings"
	"time"
)

// SeasonResetRules lists what is wiped at the start of every new season (docs/design/04-seasons/season-framework.md).
var SeasonResetRules = []string{
	"聚落人口、水/木/炭/石/铁/军粮库存及基建科技蓝图全部归零",
	"终身职业抉择、工坊装槽设备及三系军备库存全部归零",
	"玩家流通与托管金币、开放挂单及商会城池战驻军全部归零",
	"本赛季已研读的荒原高阶蓝图配方（bp_*）与赛季安全保险箱等级重置为 1 格",
}

// SeasonRetentionRules lists what is permanently preserved across all seasons (docs/design/04-seasons/season-framework.md).
var SeasonRetentionRules = []string{
	"账号身份、历史赛季徽章与累积收藏家声望永久保留",
	"已获取的赛季限定动态领主外观（cos_* 头饰/背饰/手持/随从）与穿戴配置永久保留",
	"已开启铸造的唯一序列号程序化纹理藏品（Collectibles）永久保留",
}

func DefaultSeasonAnnouncements() []SeasonNotice {
	return []SeasonNotice{
		{
			SeasonID:    "S1-CURRENT",
			Title:       "第一赛季 · 墨械纪元皇室敕令",
			EffectiveIn: "本季生效中",
			Summary:     "要塞驻防战力 +25%，铁锭、抽水机与步兵军备需求旺盛；荒原裂隙已发现游商营帐与高危黑曜圣殿。",
			DemandShifts: []string{
				"自动抽水机（科学家）",
				"泰坦精锻工具组 & 重步兵军备（工匠）",
			},
		},
		{
			SeasonID:    "S2-PREVIEW-T7D",
			Title:       "第二赛季前瞻 · 秘法狂潮",
			EffectiveIn: "7 天后轮换",
			Summary:     "新增酸雾沼泽与以太裂隙，催化剂与附魔卷轴需求上升。所有 S1 赛季限定动态外观与唯一纹理藏品将跨赛季永久保留。",
			DemandShifts: []string{
				"赫尔墨斯催化剂（炼金术士）",
				"星界附魔卷轴（魔法师）",
			},
		},
	}
}

func EnsureSeasonState(w *WorldState, now time.Time) {
	if w.SeasonNumber <= 0 {
		w.SeasonNumber = 1
	}
	if w.SeasonCode == "" {
		w.SeasonCode = fmt.Sprintf("S%d-OBSIDIAN-AWAKENING", w.SeasonNumber)
	}
	if w.SeasonName == "" {
		w.SeasonName = "S1 · 黑曜复苏与墨械纪元"
	}
	if w.SeasonStartedAt == "" {
		w.SeasonStartedAt = now.UTC().Format("2006-01-02 15:04:05")
	}
	if len(w.Announcements) == 0 {
		w.Announcements = DefaultSeasonAnnouncements()
	}
}

func PublishNotice(w *WorldState, title, effectiveIn, summary string, demandShifts []string, now time.Time) error {
	EnsureSeasonState(w, now)
	cleanTitle := strings.TrimSpace(title)
	cleanEff := strings.TrimSpace(effectiveIn)
	cleanSum := strings.TrimSpace(summary)
	if cleanTitle == "" || cleanSum == "" {
		return ErrInvalidInput("公告标题与正文摘要不能为空")
	}
	if cleanEff == "" {
		cleanEff = "即时生效"
	}
	shifts := make([]string, 0, len(demandShifts))
	for _, s := range demandShifts {
		if trimmed := strings.TrimSpace(s); trimmed != "" {
			shifts = append(shifts, trimmed)
		}
	}
	notice := SeasonNotice{
		SeasonID:     fmt.Sprintf("S%d-NOTICE-%d", w.SeasonNumber, now.Unix()),
		Title:        cleanTitle,
		EffectiveIn:  cleanEff,
		Summary:      cleanSum,
		DemandShifts: shifts,
	}
	w.Announcements = append([]SeasonNotice{notice}, w.Announcements...)
	if len(w.Announcements) > 8 {
		w.Announcements = w.Announcements[:8]
	}
	for _, p := range w.Players {
		if p != nil {
			AppendLog(p, now, "EMPIRE", fmt.Sprintf("【帝国皇室公告】%s（%s）：%s", cleanTitle, cleanEff, cleanSum))
		}
	}
	return nil
}

// isCosmeticKey checks if a resource key is a permanent season cosmetic (cos_*).
func isCosmeticKey(key string) bool {
	return strings.HasPrefix(key, "cos_")
}

// RolloverSeason executes an authoritative cross-season rollover:
//   - Increments SeasonNumber, updates SeasonCode and SeasonName.
//   - Resets central monetary ledger, CLOB market orders, and Chamber War map.
//   - Resets each player's settlement, population, non-cosmetic resources, profession, gold, learned raid blueprints, and raid gear/safebox.
//   - Permanently preserves each player's owned cosmetics (including any cosmetics frozen in open ASK orders) and minted Collectibles.
func RolloverSeason(w *WorldState, nextSeasonTitle string, now time.Time) {
	EnsureSeasonState(w, now)

	// 1. Return any frozen cosmetic ASK orders to their makers before wiping orders
	for i := range w.Orders {
		o := &w.Orders[i]
		if o.Status == "OPEN" && !o.IsNPC && o.Side == "ASK" && isCosmeticKey(o.ItemKey) && o.RemainingMilli > 0 {
			if pl, ok := w.Players[o.MakerHandle]; ok && pl != nil {
				pl.FrozenResourcesMilli[o.ItemKey] = 0
				pl.ResourcesMilli[o.ItemKey] += o.RemainingMilli
			}
		}
	}

	// 2. Advance Season Metadata
	w.SeasonNumber++
	title := strings.TrimSpace(nextSeasonTitle)
	if title == "" {
		title = fmt.Sprintf("S%d · 荒原裂隙新纪元", w.SeasonNumber)
	}
	w.SeasonCode = fmt.Sprintf("S%d-EPOCH", w.SeasonNumber)
	w.SeasonName = title
	w.SeasonStartedAt = now.UTC().Format("2006-01-02 15:04:05")

	// 3. Reset Macro Economy & War Ledger
	treasuryInit := int64(5_000_000) * GoldScale
	npcInit := int64(2_000_000) * GoldScale
	w.TotalIssuedBasis = treasuryInit + npcInit
	w.NPCHeldBasis = npcInit
	w.TreasuryHeldBasis = treasuryInit
	w.PermanentlyBurnedBasis = 0
	for _, r := range ResourceCatalog {
		w.LastPricesBasis[r.Key] = r.InitPriceBasis
		w.OpenPriceBasis[r.Key] = r.InitPriceBasis
	}
	w.Orders = []MarketOrder{}
	w.Trades = []MarketTrade{}
	w.WarDay = 1
	w.ObsidianScore = 35
	w.ArgentScore = 35
	w.WarNodes = DefaultWarNodes()
	w.WarEdges = DefaultWarEdges()
	w.WarHistory = []WarDaySettlement{}

	// 4. Reset Player Seasonal Progression while Retaining Cosmetics & Collectibles
	for _, p := range w.Players {
		if p == nil {
			continue
		}
		savedCosmetics := make(map[string]int64)
		for k, v := range p.ResourcesMilli {
			if isCosmeticKey(k) && v > 0 {
				savedCosmetics[k] = v
			}
		}
		for k, v := range p.FrozenResourcesMilli {
			if isCosmeticKey(k) && v > 0 {
				savedCosmetics[k] += v
			}
		}
		savedEquippedCosmetics := make(map[string]string)
		for slot, itemKey := range p.EquippedCosmetics {
			if savedCosmetics[itemKey] >= ResourceScale {
				savedEquippedCosmetics[slot] = itemKey
			}
		}

		// Reset settlement & macro state
		p.Phase = 1
		p.Profession = ProfNone
		p.ArtifactName = ""
		p.PopulationTotal = 0
		p.HydrationWarning = false
		p.Workers = map[string]int32{
			JobWater:      0,
			JobWood:       0,
			JobCharcoal:   0,
			JobStone:      0,
			JobSmeltIron:  0,
			JobPrepRation: 0,
		}
		p.ResourcesMilli = make(map[string]int64, len(ResourceCatalog))
		p.FrozenResourcesMilli = make(map[string]int64, len(ResourceCatalog))
		for _, r := range ResourceCatalog {
			p.ResourcesMilli[r.Key] = 0
			p.FrozenResourcesMilli[r.Key] = 0
		}
		for k, v := range savedCosmetics {
			p.ResourcesMilli[k] = v
		}

		p.UnlockedBlueprints = map[string]bool{}
		p.ActiveEdicts = map[string]bool{}
		p.ActiveExpedition = nil
		p.InstalledEquipments = map[string]int32{}
		p.GoldBasis = 0
		p.GoldFrozenBasis = 0
		p.ActivityPoints = 0
		p.DailyWarBudgetUsed = 0
		p.TotalManualClicks = 0
		p.SimulatedElapsedSeconds = 0
		p.LastSettledAt = now.UTC()
		p.LastOfflineSummary = ""

		// Reset seasonal raid blueprints, gear, and safebox, while keeping permanent cosmetics
		p.EquippedCosmetics = savedEquippedCosmetics
		p.LearnedRaidBlueprints = map[string]bool{}
		p.RaidGearInventory = map[string]int32{}
		p.RaidLoadout = RaidLoadoutState{}
		EnsureRaidState(p)

		AppendLog(p, now, "COLLECTIBLE", fmt.Sprintf("★ 新赛季【%s】已开启！聚落与宏观经济已重置，你的赛季限定动态外观与历史唯一藏品已永久保留。", w.SeasonName))
	}

	SeedNPCMarket(w, now)
}
