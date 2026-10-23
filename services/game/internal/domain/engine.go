package domain

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math"
	"sort"
	"time"
)

func HashPassword(handle, rawPassword string) string {
	sum := sha256.Sum256([]byte("d2e::" + handle + "::" + rawPassword))
	return hex.EncodeToString(sum[:])
}

func NewSessionToken(handle string, now time.Time) string {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		sum := sha256.Sum256([]byte(fmt.Sprintf("%s-%d", handle, now.UnixNano())))
		return hex.EncodeToString(sum[:])
	}
	return hex.EncodeToString(b)
}

func EnsureDefaultAccounts(w *WorldState, now time.Time) {
	if w.Players == nil {
		w.Players = make(map[string]*PlayerState)
	}
	if w.Sessions == nil {
		w.Sessions = make(map[string]string)
	}
	if p, ok := w.Players["pioneer"]; ok {
		if p.PasswordHash == "" {
			p.PasswordHash = HashPassword("pioneer", "pioneer123")
		}
	} else {
		pioneer := NewBlankPlayer("pioneer", now)
		pioneer.PasswordHash = HashPassword("pioneer", "pioneer123")
		w.Players["pioneer"] = pioneer
	}
	if vet, ok := w.Players["archon_demo"]; ok {
		if vet.PasswordHash == "" {
			vet.PasswordHash = HashPassword("archon_demo", "demo123456")
		}
	}
	if adm, ok := w.Players["admin"]; ok {
		adm.IsAdmin = true
		if adm.PasswordHash == "" {
			adm.PasswordHash = HashPassword("admin", "admin123456")
		}
	} else {
		adm := NewBlankPlayer("admin", now)
		adm.IsAdmin = true
		adm.PasswordHash = HashPassword("admin", "admin123456")
		w.Players["admin"] = adm
	}
}

func NewDefaultWorld(now time.Time) *WorldState {
	lastPrices := make(map[string]int64, len(ResourceCatalog))
	openPrices := make(map[string]int64, len(ResourceCatalog))
	for _, r := range ResourceCatalog {
		lastPrices[r.Key] = r.InitPriceBasis
		openPrices[r.Key] = r.InitPriceBasis
	}

	// Monetary supply bootstrap:
	// Central treasury holds 5,000,000.0000 Gold; NPC market makers hold 2,000,000.0000 Gold.
	treasuryInit := int64(5_000_000) * GoldScale
	npcInit := int64(2_000_000) * GoldScale

	w := &WorldState{
		ActiveHandle:           "pioneer",
		Players:                make(map[string]*PlayerState),
		Sessions:               make(map[string]string),
		TotalIssuedBasis:       treasuryInit + npcInit,
		NPCHeldBasis:           npcInit,
		TreasuryHeldBasis:      treasuryInit,
		PermanentlyBurnedBasis: 0,
		LastPricesBasis:        lastPrices,
		OpenPriceBasis:         openPrices,
		Orders:                 []MarketOrder{},
		Trades:                 []MarketTrade{},
		SeasonCode:             "S1-INK-AUTOMATON",
		SeasonName:             "第一赛季 · 墨械筑城纪元",
		WarDay:                 1,
		ObsidianScore:          35,
		ArgentScore:            35,
		WarNodes:               DefaultWarNodes(),
		WarEdges:               DefaultWarEdges(),
		WarHistory:             []WarDaySettlement{},
		Collectibles:           []CollectibleItem{},
		NextOrderSeq:           100,
		NextTradeSeq:           500,
		NextCollectibleSeq:     1,
	}

	// Primary player starts at 0 water, 0 population (GDD 3.2 & 4.1 authentic start).
	pioneer := NewBlankPlayer("pioneer", now)
	pioneer.PasswordHash = HashPassword("pioneer", "pioneer123")
	w.Players["pioneer"] = pioneer

	// Dedicated Admin account (strictly separated from normal player accounts).
	admin := NewBlankPlayer("admin", now)
	admin.IsAdmin = true
	admin.PasswordHash = HashPassword("admin", "admin123456")
	w.Players["admin"] = admin

	// Pre-seeded veteran account so user can also test multi-account trading immediately if desired.
	veteran := NewBlankPlayer("archon_demo", now)
	veteran.PasswordHash = HashPassword("archon_demo", "demo123456")
	veteran.PopulationTotal = 45
	veteran.Workers[JobWater] = 18
	veteran.Workers[JobWood] = 12
	veteran.Workers[JobStone] = 8
	veteran.Workers[JobSmeltIron] = 4
	veteran.Workers[JobPrepRation] = 3
	for _, bp := range BlueprintCatalog {
		veteran.UnlockedBlueprints[bp.Code] = true
	}
	veteran.Phase = 3
	veteran.Profession = ProfScientist
	veteran.ArtifactName = "阿基米德水力核"
	veteran.ResourcesMilli[ResWater] = 12500 * ResourceScale
	veteran.ResourcesMilli[ResWood] = 4800 * ResourceScale
	veteran.ResourcesMilli[ResStone] = 2100 * ResourceScale
	veteran.ResourcesMilli[ResIronIngot] = 28 * ResourceScale
	veteran.ResourcesMilli[ResRation] = 36 * ResourceScale
	veteran.ResourcesMilli[ResAutoPump] = 3 * ResourceScale
	veteran.ResourcesMilli[ResInfantryKit] = 16 * ResourceScale
	veteran.ResourcesMilli[ResArcherKit] = 12 * ResourceScale
	veteran.ResourcesMilli[ResCavalryKit] = 10 * ResourceScale
	veteran.ResourcesMilli[ResSeasonChest] = 2 * ResourceScale
	veteran.InstalledEquipments[ResAutoPump] = 2
	veteran.InstalledEquipments[ResAlchCatalyst] = 1
	veteran.ActivityPoints = 260
	veteranGrant := int64(1850) * GoldScale
	w.TreasuryHeldBasis -= veteranGrant
	veteran.GoldBasis = veteranGrant
	veteran.SimulatedElapsedSeconds = 2400
	AppendLog(veteran, now, "PROFESSION", "账号 archon_demo 已预置完成第一阶段并就职【科学家】，可直接体验跨职业制造、现货挂单、商会城池战与宝箱铸造。")
	w.Players["archon_demo"] = veteran

	SeedNPCMarket(w, now)
	return w
}

func NewBlankPlayer(handle string, now time.Time) *PlayerState {
	res := make(map[string]int64, len(ResourceCatalog))
	frozen := make(map[string]int64, len(ResourceCatalog))
	for _, r := range ResourceCatalog {
		res[r.Key] = 0
		frozen[r.Key] = 0
	}
	p := &PlayerState{
		ID:                   "plr_" + handle,
		Handle:               handle,
		Phase:                1,
		Profession:           ProfNone,
		ArtifactName:         "",
		PopulationTotal:      0,
		Workers:              map[string]int32{JobWater: 0, JobWood: 0, JobStone: 0, JobSmeltIron: 0, JobPrepRation: 0},
		ResourcesMilli:       res,
		FrozenResourcesMilli: frozen,
		UnlockedBlueprints:      map[string]bool{},
		InstalledEquipments:     map[string]int32{},
		Presets:                 []AllocationPreset{},
		GoldBasis:               0,
		GoldFrozenBasis:         0,
		ActivityPoints:          0,
		GuildCode:               GuildObsidian,
		DailyWarBudgetUsed:      0,
		SpeedMultiplier:         1,
		TotalManualClicks:       0,
		SimulatedElapsedSeconds: 0,
		LastSettledAt:           now.UTC(),
		LastOfflineSummary:      "",
		EventLogs:               []EventEntry{},
	}
	AppendLog(p, now, "PRODUCTION", "文明起点：点击【手动打水 +1】积攒最初的 10 滴水，招募第一位居民开启自动化。")
	return p
}

func AppendLog(p *PlayerState, now time.Time, category, msg string) {
	entry := EventEntry{
		ID:        fmt.Sprintf("ev_%d_%d", now.UnixNano(), len(p.EventLogs)+1),
		Timestamp: now.UTC().Format("15:04:05"),
		Category:  category,
		Message:   msg,
	}
	p.EventLogs = append([]EventEntry{entry}, p.EventLogs...)
	if len(p.EventLogs) > 40 {
		p.EventLogs = p.EventLogs[:40]
	}
}

// NextResidentCostMilli computes the exact water cost (in milli-units) to recruit resident #(n+1) when current population is n.
// Follows GDD 4.4: C_population(n) = ceil(10 * 1.12^n) for n < 40, and transitions to a polynomial mid-game curve for n >= 40.
func NextResidentCostMilli(n int32) int64 {
	if n < 0 {
		n = 0
	}
	if n < 40 {
		cost := math.Ceil(10.0 * math.Pow(1.12, float64(n)))
		return int64(cost) * ResourceScale
	}
	extra := float64(n - 39)
	cost := math.Ceil(931.0 + 55.0*math.Pow(extra, 1.32))
	return int64(cost) * ResourceScale
}

type ComputedJob struct {
	JobKey                 string
	Name                   string
	OutputResourceKey      string
	Assigned               int32
	BaseRateMilli          int64
	EffectiveRateMilli     int64
	TotalOutputPerSecMilli int64
	EfficiencyPct          int32
	Unlocked               bool
	UnlockHint             string
	InputSummary           string
}

func ComputeJobs(p *PlayerState) []ComputedJob {
	pumpCount := int64(p.InstalledEquipments[ResAutoPump])
	catalystCount := int64(p.InstalledEquipments[ResAlchCatalyst])
	scrollCount := int64(p.InstalledEquipments[ResEnchantScroll])
	toolsetCount := int64(p.InstalledEquipments[ResHeavyToolset])

	// Base efficiency is 100%
	waterEff := int64(100)
	woodEff := int64(100)
	stoneEff := int64(100)
	ironEff := int64(100)
	rationEff := int64(100)

	if p.UnlockedBlueprints[BPWaterWheel1] {
		waterEff += 25
	}
	if p.UnlockedBlueprints[BPStoneSaw1] {
		woodEff += 25
		stoneEff += 25
	}
	if p.UnlockedBlueprints[BPPartValve] {
		waterEff += 20
	}
	if p.UnlockedBlueprints[BPPartFrame] {
		woodEff += 25
	}
	if p.UnlockedBlueprints[BPPartTablet] {
		stoneEff += 30
	}

	switch p.Profession {
	case ProfScientist:
		waterEff += 15
		woodEff += 15
		stoneEff += 15
	case ProfAlchemist:
		rationEff += 20
		waterEff += 10
	case ProfMage:
		stoneEff += 20
		rationEff += 15
	case ProfArtisan:
		ironEff += 25
		woodEff += 15
	}

	// Installed cross-profession equipment bonuses (GDD 5.3)
	waterEff += pumpCount*15 + catalystCount*12
	woodEff += pumpCount*15 + toolsetCount*15 + catalystCount*12
	stoneEff += scrollCount*15 + catalystCount*12
	ironEff += toolsetCount*15 + catalystCount*12
	rationEff += scrollCount*15 + catalystCount*12

	specs := []struct {
		key       string
		name      string
		outRes    string
		baseMilli int64
		effPct    int64
		unlocked  bool
		hint      string
		inputNote string
	}{
		{
			key:       JobWater,
			name:      "打水",
			outRes:    ResWater,
			baseMilli: 2000, // 2.00 water/s per worker (GDD 4.4)
			effPct:    waterEff,
			unlocked:  p.PopulationTotal > 0,
			hint:      "招募第 1 位居民后开启",
			inputNote: "无原料消耗 · 基础流体采集",
		},
		{
			key:       JobWood,
			name:      "伐木",
			outRes:    ResWood,
			baseMilli: 450, // 0.45 wood/s per worker (GDD 4.4)
			effPct:    woodEff,
			unlocked:  p.UnlockedBlueprints[BPAxeBlueprint],
			hint:      "需解锁【斧头蓝图】（10 人口）",
			inputNote: "无原料消耗 · 结构木材采集",
		},
		{
			key:       JobStone,
			name:      "采石",
			outRes:    ResStone,
			baseMilli: 220, // 0.22 stone/s per worker (GDD 4.4)
			effPct:    stoneEff,
			unlocked:  p.UnlockedBlueprints[BPQuarryTech],
			hint:      "需解锁【采石技术】（25 人口）",
			inputNote: "无原料消耗 · 坚固石材开采",
		},
		{
			key:       JobSmeltIron,
			name:      "高炉炼铁",
			outRes:    ResIronIngot,
			baseMilli: 80, // 0.08 iron/s per worker
			effPct:    ironEff,
			unlocked:  p.UnlockedBlueprints[BPBasicWorkshop] && p.Profession != ProfNone,
			hint:      "需完成职业选择并启动工坊高炉",
			inputNote: "工坊持续熔炼精炼铁锭",
		},
		{
			key:       JobPrepRation,
			name:      "军粮制备",
			outRes:    ResRation,
			baseMilli: 120, // 0.12 ration/s per worker
			effPct:    rationEff,
			unlocked:  p.UnlockedBlueprints[BPBasicWorkshop] && p.Profession != ProfNone,
			hint:      "需完成职业选择并开启军需产线",
			inputNote: "工坊持续封装行军口粮",
		},
	}

	out := make([]ComputedJob, 0, len(specs))
	for _, s := range specs {
		assigned := p.Workers[s.key]
		if !s.unlocked {
			assigned = 0
		}
		effRate := (s.baseMilli * s.effPct) / 100
		totalRate := int64(assigned) * effRate
		out = append(out, ComputedJob{
			JobKey:                 s.key,
			Name:                   s.name,
			OutputResourceKey:      s.outRes,
			Assigned:               assigned,
			BaseRateMilli:          s.baseMilli,
			EffectiveRateMilli:     effRate,
			TotalOutputPerSecMilli: totalRate,
			EfficiencyPct:          int32(s.effPct),
			Unlocked:               s.unlocked,
			UnlockHint:             s.hint,
			InputSummary:           s.inputNote,
		})
	}
	return out
}

func NetResourceRatesPerSecMilli(p *PlayerState) map[string]int64 {
	rates := make(map[string]int64, len(ResourceCatalog))
	for _, j := range ComputeJobs(p) {
		rates[j.OutputResourceKey] += j.TotalOutputPerSecMilli
	}
	return rates
}

// SettleProduction performs tickless authoritative production settlement for the elapsed interval [LastSettledAt, now].
func SettleProduction(p *PlayerState, now time.Time) {
	nowUTC := now.UTC()
	if p.LastSettledAt.IsZero() {
		p.LastSettledAt = nowUTC
		return
	}
	elapsedMs := nowUTC.Sub(p.LastSettledAt).Milliseconds()
	if elapsedMs <= 0 {
		return
	}
	mult := int64(p.SpeedMultiplier)
	if mult < 1 {
		mult = 1
	}
	simMs := elapsedMs * mult
	maxMs := OfflineCapSeconds * 1000
	capped := false
	if simMs > maxMs {
		simMs = maxMs
		capped = true
	}

	rates := NetResourceRatesPerSecMilli(p)
	for resKey, rateMilliPerSec := range rates {
		if rateMilliPerSec <= 0 {
			continue
		}
		deltaMilli := (rateMilliPerSec * simMs) / 1000
		if deltaMilli > 0 {
			p.ResourcesMilli[resKey] += deltaMilli
		}
	}

	p.SimulatedElapsedSeconds += simMs / 1000
	p.LastSettledAt = nowUTC
	if capped {
		p.LastOfflineSummary = "离线产出已达单次 8 小时封顶上限（GDD 6.4）。"
	}
}

// AdvancePlayerSeconds fast-forwards a player's production deterministically by sec seconds.
func AdvancePlayerSeconds(p *PlayerState, sec int64) {
	if sec <= 0 {
		return
	}
	if sec > OfflineCapSeconds {
		sec = OfflineCapSeconds
	}
	rates := NetResourceRatesPerSecMilli(p)
	for resKey, rateMilliPerSec := range rates {
		if rateMilliPerSec > 0 {
			p.ResourcesMilli[resKey] += rateMilliPerSec * sec
		}
	}
	p.SimulatedElapsedSeconds += sec
}

func AssignedPopulation(p *PlayerState) int32 {
	var sum int32
	for _, c := range p.Workers {
		if c > 0 {
			sum += c
		}
	}
	return sum
}

func GatherWater(p *PlayerState, clicks int32, now time.Time) error {
	if clicks <= 0 {
		clicks = 1
	}
	if clicks > 50 {
		clicks = 50
	}
	perClickMilli := ResourceScale // 1.000 water
	if p.UnlockedBlueprints[BPFirstResident] {
		perClickMilli = 2 * ResourceScale
	}
	gain := int64(clicks) * perClickMilli
	p.ResourcesMilli[ResWater] += gain
	p.TotalManualClicks += int64(clicks)
	if p.TotalManualClicks == 10 && p.PopulationTotal == 0 {
		AppendLog(p, now, "PRODUCTION", "已累计 10 滴水！右侧【招募居民】入口已就绪，立即招募首位居民开启自动取水。")
	}
	return nil
}

func RecruitResident(p *PlayerState, count int32, now time.Time) error {
	if count <= 0 {
		count = 1
	}
	if count > 50 {
		count = 50
	}
	recruited := int32(0)
	var totalSpentMilli int64
	for i := int32(0); i < count; i++ {
		cost := NextResidentCostMilli(p.PopulationTotal)
		if p.ResourcesMilli[ResWater] < cost {
			if recruited == 0 {
				return ErrPrecondition("insufficient_water", fmt.Sprintf("水资源不足：招募下一位居民需要 %.1f 水", float64(cost)/float64(ResourceScale)))
			}
			break
		}
		p.ResourcesMilli[ResWater] -= cost
		totalSpentMilli += cost
		p.PopulationTotal++
		// Automatically assign new resident to water collection so automation is immediate; player can reallocate anytime.
		p.Workers[JobWater]++
		recruited++
	}
	if p.PopulationTotal == 1 && recruited == 1 {
		AppendLog(p, now, "PRODUCTION", "第一位居民已加入并自动分配至【打水】（+2.00 水/秒）！第一次自动化生产已启动。")
	} else {
		AppendLog(p, now, "PRODUCTION", fmt.Sprintf("成功招募 %d 名居民（消耗 %.1f 水），当前总人口 %d。", recruited, float64(totalSpentMilli)/1000.0, p.PopulationTotal))
	}
	return nil
}

func AllocateWorkers(p *PlayerState, mode string, entries map[string]int32, presetName string, now time.Time) error {
	total := p.PopulationTotal
	if total <= 0 {
		return ErrPrecondition("no_population", "当前尚无居民可供分配，请先招募居民")
	}

	switch mode {
	case "delta":
		for k, delta := range entries {
			if delta == 0 {
				continue
			}
			if k == JobWood && !p.UnlockedBlueprints[BPAxeBlueprint] {
				return ErrPrecondition("job_locked", "尚未解锁【斧头蓝图】，无法分配伐木工")
			}
			if k == JobStone && !p.UnlockedBlueprints[BPQuarryTech] {
				return ErrPrecondition("job_locked", "尚未解锁【采石技术】，无法分配采石工")
			}
			if (k == JobSmeltIron || k == JobPrepRation) && (!p.UnlockedBlueprints[BPBasicWorkshop] || p.Profession == ProfNone) {
				return ErrPrecondition("job_locked", "尚未开启工坊高炉/军需产线，无法分配该岗位")
			}
			assigned := AssignedPopulation(p)
			idle := total - assigned
			if idle < 0 {
				idle = 0
			}
			if delta > 0 {
				useIdle := delta
				if useIdle > idle {
					useIdle = idle
				}
				needTransfer := delta - useIdle
				if needTransfer > 0 {
					if k != JobWater {
						if p.Workers[JobWater] < needTransfer {
							return ErrPrecondition("no_available_workers", "当前无闲置或打水居民可供调配，请先从其他岗位调出居民")
						}
						p.Workers[JobWater] -= needTransfer
					} else {
						for _, src := range []string{JobPrepRation, JobSmeltIron, JobStone, JobWood} {
							if needTransfer <= 0 {
								break
							}
							avail := p.Workers[src]
							if avail <= 0 {
								continue
							}
							take := needTransfer
							if take > avail {
								take = avail
							}
							p.Workers[src] -= take
							needTransfer -= take
						}
						if needTransfer > 0 {
							return ErrPrecondition("no_available_workers", "所有居民均已在打水岗位")
						}
					}
				}
				p.Workers[k] += delta
			} else {
				rem := -delta
				if rem > p.Workers[k] {
					rem = p.Workers[k]
				}
				if rem > 0 {
					p.Workers[k] -= rem
					if k != JobWater {
						p.Workers[JobWater] += rem
					}
				}
			}
		}
		return nil

	case "manual":
		next := map[string]int32{
			JobWater:      0,
			JobWood:       0,
			JobStone:      0,
			JobSmeltIron:  0,
			JobPrepRation: 0,
		}
		var sum int32
		for k, v := range entries {
			if v < 0 {
				return ErrInvalidInput("分配人数不能为负数")
			}
			if v == 0 {
				continue
			}
			if k == JobWood && !p.UnlockedBlueprints[BPAxeBlueprint] {
				return ErrPrecondition("job_locked", "尚未解锁【斧头蓝图】，无法分配伐木工")
			}
			if k == JobStone && !p.UnlockedBlueprints[BPQuarryTech] {
				return ErrPrecondition("job_locked", "尚未解锁【采石技术】，无法分配采石工")
			}
			if (k == JobSmeltIron || k == JobPrepRation) && !p.UnlockedBlueprints[BPBasicWorkshop] {
				return ErrPrecondition("job_locked", "尚未建成【基础工坊】，无法分配工坊岗位")
			}
			next[k] = v
			sum += v
		}
		if sum > total {
			excess := sum - total
			if next[JobWater] >= excess && next[JobWater] == p.Workers[JobWater] {
				next[JobWater] -= excess
				sum -= excess
			} else {
				return ErrPrecondition("population_exceeded", fmt.Sprintf("分配总人数 (%d) 超过当前人口上限 (%d)", sum, total))
			}
		}
		p.Workers = next
		AppendLog(p, now, "PRODUCTION", fmt.Sprintf("已更新劳动力分配：打水 %d / 伐木 %d / 采石 %d / 炼铁 %d / 军粮 %d（闲置 %d）。",
			next[JobWater], next[JobWood], next[JobStone], next[JobSmeltIron], next[JobPrepRation], total-sum))
		return nil

	case "auto_balanced":
		ApplyBalancedAllocation(p)
		AppendLog(p, now, "PRODUCTION", "已按当前科技阶段执行【智能均衡分配】。")
		return nil

	case "water_focus":
		ApplyFocusAllocation(p, JobWater)
		AppendLog(p, now, "PRODUCTION", "已切换为【优先打水】劳动力配置。")
		return nil

	case "wood_focus":
		if !p.UnlockedBlueprints[BPAxeBlueprint] {
			return ErrPrecondition("job_locked", "尚未解锁【斧头蓝图】")
		}
		ApplyFocusAllocation(p, JobWood)
		AppendLog(p, now, "PRODUCTION", "已切换为【优先伐木】劳动力配置。")
		return nil

	case "stone_focus":
		if !p.UnlockedBlueprints[BPQuarryTech] {
			return ErrPrecondition("job_locked", "尚未解锁【采石技术】")
		}
		ApplyFocusAllocation(p, JobStone)
		AppendLog(p, now, "PRODUCTION", "已切换为【优先采石】劳动力配置。")
		return nil

	case "preset":
		for _, pr := range p.Presets {
			if pr.Name == presetName {
				ApplyScaledPreset(p, pr.Allocations)
				AppendLog(p, now, "PRODUCTION", fmt.Sprintf("已应用分配方案【%s】。", presetName))
				return nil
			}
		}
		return ErrNotFound("未找到指定的分配方案")

	default:
		return ErrInvalidInput("未知的分配模式")
	}
}

// ApplyBalancedAllocation implements the stage-aware worker ratio from GDD 4.4.
func ApplyBalancedAllocation(p *PlayerState) {
	total := p.PopulationTotal
	next := map[string]int32{
		JobWater:      0,
		JobWood:       0,
		JobStone:      0,
		JobSmeltIron:  0,
		JobPrepRation: 0,
	}
	if total <= 0 {
		p.Workers = next
		return
	}
	if !p.UnlockedBlueprints[BPAxeBlueprint] {
		next[JobWater] = total
		p.Workers = next
		return
	}
	if !p.UnlockedBlueprints[BPQuarryTech] {
		// GDD 4.4: 70% water, 30% wood
		wood := int32(math.Round(float64(total) * 0.30))
		if wood < 1 {
			wood = 1
		}
		next[JobWood] = wood
		next[JobWater] = total - wood
		p.Workers = next
		return
	}
	if !p.UnlockedBlueprints[BPBasicWorkshop] {
		// GDD 4.4: 60% water, 25% wood, 15% stone
		wood := int32(math.Round(float64(total) * 0.25))
		stone := int32(math.Round(float64(total) * 0.15))
		if stone < 1 {
			stone = 1
		}
		next[JobWood] = wood
		next[JobStone] = stone
		next[JobWater] = total - wood - stone
		p.Workers = next
		return
	}
	if p.Profession == ProfNone {
		// GDD 4.4 Workshop -> Treasure: 50% water, 30% wood, 20% stone
		wood := int32(math.Round(float64(total) * 0.30))
		stone := int32(math.Round(float64(total) * 0.20))
		next[JobWood] = wood
		next[JobStone] = stone
		next[JobWater] = total - wood - stone
		p.Workers = next
		return
	}
	// Post-profession: include iron & ration lines
	iron := int32(math.Max(1, math.Round(float64(total)*0.10)))
	ration := int32(math.Max(1, math.Round(float64(total)*0.10)))
	wood := int32(math.Round(float64(total) * 0.25))
	stone := int32(math.Round(float64(total) * 0.20))
	water := total - iron - ration - wood - stone
	if water < 1 {
		water = 1
	}
	next[JobWater] = water
	next[JobWood] = wood
	next[JobStone] = stone
	next[JobSmeltIron] = iron
	next[JobPrepRation] = ration
	p.Workers = next
}

func ApplyFocusAllocation(p *PlayerState, focusJob string) {
	total := p.PopulationTotal
	next := map[string]int32{
		JobWater:      0,
		JobWood:       0,
		JobStone:      0,
		JobSmeltIron:  0,
		JobPrepRation: 0,
	}
	primary := int32(math.Ceil(float64(total) * 0.75))
	rem := total - primary
	next[focusJob] = primary
	if focusJob != JobWater {
		next[JobWater] = rem
	} else if p.UnlockedBlueprints[BPAxeBlueprint] {
		next[JobWood] = rem
	} else {
		next[JobWater] = total
	}
	p.Workers = next
}

func ApplyScaledPreset(p *PlayerState, raw map[string]int32) {
	var rawSum int32
	for k, v := range raw {
		if k == JobWood && !p.UnlockedBlueprints[BPAxeBlueprint] {
			continue
		}
		if k == JobStone && !p.UnlockedBlueprints[BPQuarryTech] {
			continue
		}
		if (k == JobSmeltIron || k == JobPrepRation) && !p.UnlockedBlueprints[BPBasicWorkshop] {
			continue
		}
		if v > 0 {
			rawSum += v
		}
	}
	if rawSum <= 0 {
		ApplyBalancedAllocation(p)
		return
	}
	total := p.PopulationTotal
	next := map[string]int32{
		JobWater:      0,
		JobWood:       0,
		JobStone:      0,
		JobSmeltIron:  0,
		JobPrepRation: 0,
	}
	var assigned int32
	for _, k := range []string{JobWood, JobStone, JobSmeltIron, JobPrepRation} {
		v := raw[k]
		if v <= 0 {
			continue
		}
		if k == JobWood && !p.UnlockedBlueprints[BPAxeBlueprint] {
			continue
		}
		if k == JobStone && !p.UnlockedBlueprints[BPQuarryTech] {
			continue
		}
		if (k == JobSmeltIron || k == JobPrepRation) && !p.UnlockedBlueprints[BPBasicWorkshop] {
			continue
		}
		scaled := int32(math.Round(float64(total) * float64(v) / float64(rawSum)))
		if assigned+scaled > total {
			scaled = total - assigned
		}
		next[k] = scaled
		assigned += scaled
	}
	next[JobWater] = total - assigned
	p.Workers = next
}

func SavePreset(p *PlayerState, name string, now time.Time) error {
	if len(name) == 0 || len([]rune(name)) > 20 {
		return ErrInvalidInput("方案名称长度需在 1–20 个字符之间")
	}
	copyAlloc := make(map[string]int32, len(p.Workers))
	for k, v := range p.Workers {
		copyAlloc[k] = v
	}
	for i := range p.Presets {
		if p.Presets[i].Name == name {
			p.Presets[i].Allocations = copyAlloc
			AppendLog(p, now, "PRODUCTION", fmt.Sprintf("已更新人口分配方案【%s】。", name))
			return nil
		}
	}
	p.Presets = append(p.Presets, AllocationPreset{
		Name:        name,
		Allocations: copyAlloc,
	})
	AppendLog(p, now, "PRODUCTION", fmt.Sprintf("已保存人口分配方案【%s】。", name))
	return nil
}

func UnlockBlueprint(w *WorldState, p *PlayerState, code string, now time.Time) error {
	var spec *BlueprintSpec
	for i := range BlueprintCatalog {
		if BlueprintCatalog[i].Code == code {
			spec = &BlueprintCatalog[i]
			break
		}
	}
	if spec == nil {
		return ErrNotFound("未知的蓝图节点")
	}
	if p.UnlockedBlueprints[code] {
		return ErrPrecondition("already_unlocked", "该蓝图已经解锁")
	}
	if spec.PrerequisiteCode != "" && !p.UnlockedBlueprints[spec.PrerequisiteCode] {
		return ErrPrecondition("prerequisite_missing", "尚未完成前置蓝图研发")
	}
	if p.PopulationTotal < spec.RequiredPopulation {
		return ErrPrecondition("insufficient_population", fmt.Sprintf("需要人口达到 %d 人（当前 %d 人）", spec.RequiredPopulation, p.PopulationTotal))
	}
	for resKey, reqMilli := range spec.CostsMilli {
		if p.ResourcesMilli[resKey] < reqMilli {
			return ErrPrecondition("insufficient_resource", fmt.Sprintf("%s不足：需要 %.1f，当前 %.1f",
				ResourceName(resKey), float64(reqMilli)/1000.0, float64(p.ResourcesMilli[resKey])/1000.0))
		}
	}
	for resKey, reqMilli := range spec.CostsMilli {
		p.ResourcesMilli[resKey] -= reqMilli
	}
	p.UnlockedBlueprints[code] = true

	if code == BPMysteryTreasure {
		if p.Phase < 2 {
			p.Phase = 2
		}
		// Grant 500.0000 starter gold from Central Treasury (GDD 7.2)
		starterGold := int64(500) * GoldScale
		if w.TreasuryHeldBasis >= starterGold {
			w.TreasuryHeldBasis -= starterGold
			p.GoldBasis += starterGold
		} else {
			w.TotalIssuedBasis += starterGold
			p.GoldBasis += starterGold
		}
		AppendLog(p, now, "BLUEPRINT", "★ 已开启【神秘的宝藏】！获得中央财政发放的 500.0000 启动金币，请立即在职业面板抉择你的终身职业！")
	} else {
		AppendLog(p, now, "BLUEPRINT", fmt.Sprintf("已解锁【%s】：%s", spec.Name, spec.EffectSummary))
	}
	return nil
}

func ChooseProfession(p *PlayerState, prof string, now time.Time) error {
	if !p.UnlockedBlueprints[BPMysteryTreasure] {
		return ErrPrecondition("treasure_locked", "必须先开启【神秘的宝藏】才能选择职业")
	}
	if p.Profession != ProfNone {
		return ErrPrecondition("profession_locked", "首次职业选择已锁定，不可反悔（GDD 4.3）")
	}
	var spec *ProfessionSpec
	for i := range ProfessionCatalog {
		if ProfessionCatalog[i].Code == prof {
			spec = &ProfessionCatalog[i]
			break
		}
	}
	if spec == nil {
		return ErrInvalidInput("无效的职业代码")
	}
	p.Profession = spec.Code
	p.ArtifactName = spec.ArtifactName
	p.Phase = 3

	// Grant starter batch of profession goods & basic war kits so player can immediately trade or deploy
	switch spec.Code {
	case ProfScientist:
		p.ResourcesMilli[ResAutoPump] += 2 * ResourceScale
	case ProfAlchemist:
		p.ResourcesMilli[ResAlchCatalyst] += 2 * ResourceScale
	case ProfMage:
		p.ResourcesMilli[ResEnchantScroll] += 2 * ResourceScale
	case ProfArtisan:
		p.ResourcesMilli[ResHeavyToolset] += 2 * ResourceScale
	}
	p.ResourcesMilli[ResIronIngot] += 10 * ResourceScale
	p.ResourcesMilli[ResRation] += 12 * ResourceScale
	p.ResourcesMilli[ResInfantryKit] += 6 * ResourceScale
	p.ResourcesMilli[ResArcherKit] += 6 * ResourceScale
	p.ResourcesMilli[ResCavalryKit] += 6 * ResourceScale
	p.ActivityPoints += 120

	AppendLog(p, now, "PROFESSION", fmt.Sprintf("已执掌神器【%s】并就职为【%s】！全球现货交易所、跨职业工坊与七日商会战争已全面开放。", spec.ArtifactName, spec.Name))
	return nil
}

func CraftItem(w *WorldState, p *PlayerState, recipeCode string, batches int32, now time.Time) error {
	if !p.UnlockedBlueprints[BPBasicWorkshop] {
		return ErrPrecondition("workshop_locked", "需要先建成【基础工坊】")
	}
	if batches <= 0 {
		batches = 1
	}
	if batches > 20 {
		batches = 20
	}
	var spec *CraftRecipeSpec
	for i := range CraftRecipeCatalog {
		if CraftRecipeCatalog[i].RecipeCode == recipeCode {
			spec = &CraftRecipeCatalog[i]
			break
		}
	}
	if spec == nil {
		return ErrNotFound("未知的制造配方")
	}
	if spec.ProfessionReq != "all" && p.Profession != spec.ProfessionReq {
		return ErrPrecondition("profession_mismatch", fmt.Sprintf("该配方为【%s】独占配方，其他职业请前往现货交易所向该职业玩家采购（GDD 5.2）", spec.ProfessionReqName))
	}

	b64 := int64(batches)
	totalGoldCost := spec.GoldCostBasis * b64
	if p.GoldBasis < totalGoldCost {
		return ErrPrecondition("insufficient_gold", fmt.Sprintf("金币不足：需要 %.4f 金币", float64(totalGoldCost)/float64(GoldScale)))
	}
	for resKey, costMilli := range spec.CostsMilli {
		need := costMilli * b64
		if p.ResourcesMilli[resKey] < need {
			return ErrPrecondition("insufficient_resource", fmt.Sprintf("%s不足：需要 %.1f，当前 %.1f",
				ResourceName(resKey), float64(need)/1000.0, float64(p.ResourcesMilli[resKey])/1000.0))
		}
	}

	for resKey, costMilli := range spec.CostsMilli {
		p.ResourcesMilli[resKey] -= costMilli * b64
	}
	if totalGoldCost > 0 {
		p.GoldBasis -= totalGoldCost
		// System crafting fee: 50% burned, 50% to public treasury (GDD 7.2)
		burn := totalGoldCost / 2
		treasury := totalGoldCost - burn
		w.PermanentlyBurnedBasis += burn
		w.TotalIssuedBasis -= burn
		w.TreasuryHeldBasis += treasury
	}

	outMilli := spec.OutputAmountMilli * b64
	// Artisan gets +25% bonus output when crafting military armaments; Alchemist gets +25% when crafting catalysts
	if p.Profession == ProfArtisan && spec.Category == "armament" {
		outMilli = (outMilli * 125) / 100
	}
	p.ResourcesMilli[spec.OutputKey] += outMilli
	AppendLog(p, now, "PRODUCTION", fmt.Sprintf("工坊制造完成：产出 %.1f 单位【%s】。", float64(outMilli)/1000.0, spec.OutputName))
	return nil
}

func InstallEquipment(p *PlayerState, itemKey string, delta int32, now time.Time) error {
	if !p.UnlockedBlueprints[BPBasicWorkshop] {
		return ErrPrecondition("workshop_locked", "需要先建成【基础工坊】")
	}
	if delta == 0 {
		return nil
	}
	var spec *EquipmentSpec
	for i := range EquipmentCatalog {
		if EquipmentCatalog[i].ItemKey == itemKey {
			spec = &EquipmentCatalog[i]
			break
		}
	}
	if spec == nil {
		return ErrNotFound("该物品不可作为工坊设备加装")
	}

	cur := p.InstalledEquipments[itemKey]
	if delta > 0 {
		if cur+delta > spec.MaxStack {
			return ErrPrecondition("max_stack_reached", fmt.Sprintf("该设备最多加装 %d 件", spec.MaxStack))
		}
		needMilli := int64(delta) * ResourceScale
		if p.ResourcesMilli[itemKey] < needMilli {
			return ErrPrecondition("insufficient_equipment", fmt.Sprintf("仓库中没有足够的【%s】可供加装，请先制造或在市场购买", ResourceName(itemKey)))
		}
		p.ResourcesMilli[itemKey] -= needMilli
		p.InstalledEquipments[itemKey] = cur + delta
		AppendLog(p, now, "PRODUCTION", fmt.Sprintf("已在工坊加装 %d 件【%s】（当前 %d/%d）。", delta, spec.Name, cur+delta, spec.MaxStack))
	} else {
		remove := -delta
		if remove > cur {
			remove = cur
		}
		if remove <= 0 {
			return ErrPrecondition("none_installed", "当前未加装该设备")
		}
		p.InstalledEquipments[itemKey] = cur - remove
		p.ResourcesMilli[itemKey] += int64(remove) * ResourceScale
		AppendLog(p, now, "PRODUCTION", fmt.Sprintf("已从工坊卸下 %d 件【%s】并退回仓库。", remove, spec.Name))
	}
	return nil
}

// SeedNPCMarket populates realistic limit orders from the 4 profession guilds and quartermaster.
func SeedNPCMarket(w *WorldState, now time.Time) {
	ts := now.UTC().Format("15:04:05")
	seedOrders := []struct {
		item  string
		side  string
		price int64
		qty   int64
		maker string
	}{
		{ResWater, "BID", 900, 5000 * ResourceScale, "炼金师·赫尔"},
		{ResWater, "ASK", 1100, 6000 * ResourceScale, "科学家·林格"},
		{ResWood, "BID", 4200, 2000 * ResourceScale, "铁匠·巴隆"},
		{ResWood, "ASK", 4800, 2500 * ResourceScale, "科学家·林格"},
		{ResStone, "BID", 9000, 1200 * ResourceScale, "铁匠·巴隆"},
		{ResStone, "ASK", 10200, 1400 * ResourceScale, "大法师·梅林"},
		{ResIronIngot, "BID", 30000, 40 * ResourceScale, "科学家·林格"},
		{ResIronIngot, "ASK", 34000, 45 * ResourceScale, "铁匠·巴隆"},
		{ResRation, "BID", 22000, 50 * ResourceScale, "军需官·霍克"},
		{ResRation, "ASK", 26000, 60 * ResourceScale, "炼金师·赫尔"},
		{ResAutoPump, "BID", 170000, 4 * ResourceScale, "炼金师·赫尔"},
		{ResAutoPump, "ASK", 192000, 5 * ResourceScale, "科学家·林格"},
		{ResAlchCatalyst, "BID", 180000, 4 * ResourceScale, "大法师·梅林"},
		{ResAlchCatalyst, "ASK", 205000, 5 * ResourceScale, "炼金师·赫尔"},
		{ResEnchantScroll, "BID", 185000, 4 * ResourceScale, "铁匠·巴隆"},
		{ResEnchantScroll, "ASK", 210000, 5 * ResourceScale, "大法师·梅林"},
		{ResHeavyToolset, "BID", 175000, 4 * ResourceScale, "科学家·林格"},
		{ResHeavyToolset, "ASK", 198000, 5 * ResourceScale, "铁匠·巴隆"},
		{ResInfantryKit, "BID", 94000, 15 * ResourceScale, "黑曜军需处"},
		{ResInfantryKit, "ASK", 104000, 15 * ResourceScale, "铁匠·巴隆"},
		{ResArcherKit, "BID", 97000, 15 * ResourceScale, "白银军需处"},
		{ResArcherKit, "ASK", 108000, 15 * ResourceScale, "大法师·梅林"},
		{ResCavalryKit, "BID", 106000, 15 * ResourceScale, "黑曜军需处"},
		{ResCavalryKit, "ASK", 118000, 15 * ResourceScale, "炼金师·赫尔"},
		{ResSeasonChest, "BID", 420000, 3 * ResourceScale, "收藏家·维克"},
		{ResSeasonChest, "ASK", 480000, 2 * ResourceScale, "白银军需处"},
	}

	for _, so := range seedOrders {
		w.NextOrderSeq++
		w.Orders = append(w.Orders, MarketOrder{
			ID:             fmt.Sprintf("ord_%d", w.NextOrderSeq),
			ItemKey:        so.item,
			Side:           so.side,
			PriceBasis:     so.price,
			QuantityMilli:  so.qty,
			FilledMilli:    0,
			RemainingMilli: so.qty,
			MakerHandle:    so.maker,
			IsNPC:          true,
			Status:         "OPEN",
			CreatedAt:      ts,
		})
	}

	// Seed a few initial trades so market tape has realistic baseline activity
	sampleTrades := []struct {
		item   string
		price  int64
		qty    int64
		buyer  string
		seller string
	}{
		{ResAutoPump, 185000, 2 * ResourceScale, "炼金师·赫尔", "科学家·林格"},
		{ResAlchCatalyst, 195000, 2 * ResourceScale, "铁匠·巴隆", "炼金师·赫尔"},
		{ResEnchantScroll, 200000, 1 * ResourceScale, "科学家·林格", "大法师·梅林"},
		{ResInfantryKit, 98000, 6 * ResourceScale, "黑曜军需处", "铁匠·巴隆"},
	}
	for _, st := range sampleTrades {
		w.NextTradeSeq++
		totalGold := (st.qty * st.price) / ResourceScale
		tax := (totalGold * MarketTaxBps) / 10000
		burn := tax / 2
		treas := tax - burn
		w.NPCHeldBasis -= tax
		w.PermanentlyBurnedBasis += burn
		w.TotalIssuedBasis -= burn
		w.TreasuryHeldBasis += treas
		w.Trades = append(w.Trades, MarketTrade{
			ID:               fmt.Sprintf("trd_%d", w.NextTradeSeq),
			ItemKey:          st.item,
			PriceBasis:       st.price,
			QuantityMilli:    st.qty,
			TotalGoldBasis:   totalGold,
			TaxBurnedBasis:   burn,
			TaxTreasuryBasis: treas,
			BuyerHandle:      st.buyer,
			SellerHandle:     st.seller,
			ExecutedAt:       ts,
		})
	}
}

func PlaceMarketOrder(w *WorldState, p *PlayerState, itemKey, side string, priceBasis, quantityMilli int64, now time.Time) error {
	if p.Profession == ProfNone {
		return ErrPrecondition("market_locked", "完成【神秘的宝藏】并选定职业后解锁全球现货交易所（GDD 9.3）")
	}
	if side != "BID" && side != "ASK" {
		return ErrInvalidInput("交易方向必须为 BID（买入）或 ASK（卖出）")
	}
	if priceBasis < 100 || priceBasis > 100_000_000 {
		return ErrInvalidInput("单价超出允许范围（0.0100 - 10,000.0000 金币）")
	}
	if quantityMilli < 1000 || quantityMilli%1000 != 0 {
		return ErrInvalidInput("挂单数量必须为至少 1.000 的整数单位")
	}
	validItem := false
	for _, r := range ResourceCatalog {
		if r.Key == itemKey && r.Tradable {
			validItem = true
			break
		}
	}
	if !validItem {
		return ErrInvalidInput("该商品不支持现货交易")
	}

	totalEscrowGold := (quantityMilli * priceBasis) / ResourceScale
	if side == "BID" {
		if p.GoldBasis < totalEscrowGold {
			return ErrPrecondition("insufficient_gold", fmt.Sprintf("可用金币不足：买单需冻结 %.4f 金币", float64(totalEscrowGold)/float64(GoldScale)))
		}
		p.GoldBasis -= totalEscrowGold
		p.GoldFrozenBasis += totalEscrowGold
	} else {
		if p.ResourcesMilli[itemKey] < quantityMilli {
			return ErrPrecondition("insufficient_resource", fmt.Sprintf("可用【%s】库存不足：卖单需冻结 %.1f 单位", ResourceName(itemKey), float64(quantityMilli)/1000.0))
		}
		p.ResourcesMilli[itemKey] -= quantityMilli
		p.FrozenResourcesMilli[itemKey] += quantityMilli
	}

	w.NextOrderSeq++
	newOrd := MarketOrder{
		ID:             fmt.Sprintf("ord_%d", w.NextOrderSeq),
		ItemKey:        itemKey,
		Side:           side,
		PriceBasis:     priceBasis,
		QuantityMilli:  quantityMilli,
		FilledMilli:    0,
		RemainingMilli: quantityMilli,
		MakerHandle:    p.Handle,
		IsNPC:          false,
		Status:         "OPEN",
		CreatedAt:      now.UTC().Format("15:04:05"),
	}

	MatchOrder(w, p, &newOrd, now)
	w.Orders = append([]MarketOrder{newOrd}, w.Orders...)
	return nil
}

func MatchOrder(w *WorldState, taker *PlayerState, incoming *MarketOrder, now time.Time) {
	// Collect candidate opposite open orders indices
	var candidateIdx []int
	for i := range w.Orders {
		o := &w.Orders[i]
		if o.Status != "OPEN" || o.ItemKey != incoming.ItemKey || o.Side == incoming.Side || o.RemainingMilli <= 0 {
			continue
		}
		if incoming.Side == "BID" && incoming.PriceBasis >= o.PriceBasis {
			candidateIdx = append(candidateIdx, i)
		} else if incoming.Side == "ASK" && incoming.PriceBasis <= o.PriceBasis {
			candidateIdx = append(candidateIdx, i)
		}
	}

	sort.Slice(candidateIdx, func(a, b int) bool {
		oa := w.Orders[candidateIdx[a]]
		ob := w.Orders[candidateIdx[b]]
		if incoming.Side == "BID" {
			// Cheapest ASK first
			if oa.PriceBasis != ob.PriceBasis {
				return oa.PriceBasis < ob.PriceBasis
			}
		} else {
			// Highest BID first
			if oa.PriceBasis != ob.PriceBasis {
				return oa.PriceBasis > ob.PriceBasis
			}
		}
		return oa.ID < ob.ID
	})

	ts := now.UTC().Format("15:04:05")
	for _, idx := range candidateIdx {
		if incoming.RemainingMilli <= 0 {
			break
		}
		resting := &w.Orders[idx]
		fillMilli := incoming.RemainingMilli
		if resting.RemainingMilli < fillMilli {
			fillMilli = resting.RemainingMilli
		}
		execPrice := resting.PriceBasis
		tradeGold := (fillMilli * execPrice) / ResourceScale
		taxTotal := (tradeGold * MarketTaxBps) / 10000
		taxBurn := taxTotal / 2
		taxTreasury := taxTotal - taxBurn

		var buyerHandle, sellerHandle string
		if incoming.Side == "BID" {
			buyerHandle = incoming.MakerHandle
			sellerHandle = resting.MakerHandle

			// Buyer (incoming) locked at incoming.PriceBasis; refund price improvement if execPrice < incoming.PriceBasis
			lockedForFill := (fillMilli * incoming.PriceBasis) / ResourceScale
			refund := lockedForFill - tradeGold
			taker.GoldFrozenBasis -= lockedForFill
			if refund > 0 {
				taker.GoldBasis += refund
			}
			taker.ResourcesMilli[incoming.ItemKey] += fillMilli

			// Seller (resting)
			if resting.IsNPC {
				w.NPCHeldBasis += (tradeGold - taxTotal)
			} else if seller, ok := w.Players[resting.MakerHandle]; ok {
				seller.FrozenResourcesMilli[incoming.ItemKey] -= fillMilli
				seller.GoldBasis += (tradeGold - taxTotal)
			}
		} else {
			sellerHandle = incoming.MakerHandle
			buyerHandle = resting.MakerHandle

			// Seller (incoming)
			taker.FrozenResourcesMilli[incoming.ItemKey] -= fillMilli
			taker.GoldBasis += (tradeGold - taxTotal)

			// Buyer (resting)
			if resting.IsNPC {
				w.NPCHeldBasis -= tradeGold
			} else if buyer, ok := w.Players[resting.MakerHandle]; ok {
				buyer.GoldFrozenBasis -= tradeGold
				buyer.ResourcesMilli[incoming.ItemKey] += fillMilli
			}
		}

		// Apply tax burn & treasury routing (GDD 7.2 & 7.4)
		w.PermanentlyBurnedBasis += taxBurn
		w.TotalIssuedBasis -= taxBurn
		w.TreasuryHeldBasis += taxTreasury
		w.LastPricesBasis[incoming.ItemKey] = execPrice

		incoming.FilledMilli += fillMilli
		incoming.RemainingMilli -= fillMilli
		resting.FilledMilli += fillMilli
		resting.RemainingMilli -= fillMilli
		if resting.RemainingMilli <= 0 {
			resting.Status = "FILLED"
		}

		w.NextTradeSeq++
		trd := MarketTrade{
			ID:               fmt.Sprintf("trd_%d", w.NextTradeSeq),
			ItemKey:          incoming.ItemKey,
			PriceBasis:       execPrice,
			QuantityMilli:    fillMilli,
			TotalGoldBasis:   tradeGold,
			TaxBurnedBasis:   taxBurn,
			TaxTreasuryBasis: taxTreasury,
			BuyerHandle:      buyerHandle,
			SellerHandle:     sellerHandle,
			ExecutedAt:       ts,
		}
		w.Trades = append([]MarketTrade{trd}, w.Trades...)
		if len(w.Trades) > 60 {
			w.Trades = w.Trades[:60]
		}
	}

	if incoming.RemainingMilli <= 0 {
		incoming.Status = "FILLED"
		AppendLog(taker, now, "MARKET", fmt.Sprintf("订单【%s %s %.1f】已全部撮合成交！",
			incoming.Side, ResourceName(incoming.ItemKey), float64(incoming.QuantityMilli)/1000.0))
	} else if incoming.FilledMilli > 0 {
		AppendLog(taker, now, "MARKET", fmt.Sprintf("订单【%s %s】部分成交 %.1f，剩余 %.1f 进入深度簿挂单。",
			incoming.Side, ResourceName(incoming.ItemKey), float64(incoming.FilledMilli)/1000.0, float64(incoming.RemainingMilli)/1000.0))
	} else {
		AppendLog(taker, now, "MARKET", fmt.Sprintf("已挂出限价单【%s %s】%.1f 单位 @ %.4f 金币。",
			incoming.Side, ResourceName(incoming.ItemKey), float64(incoming.QuantityMilli)/1000.0, float64(incoming.PriceBasis)/float64(GoldScale)))
	}
}

func CancelMarketOrder(w *WorldState, p *PlayerState, orderID string, now time.Time) error {
	for i := range w.Orders {
		o := &w.Orders[i]
		if o.ID != orderID {
			continue
		}
		if o.MakerHandle != p.Handle || o.IsNPC {
			return ErrPrecondition("not_order_owner", "只能撤销自己挂出的订单")
		}
		if o.Status != "OPEN" || o.RemainingMilli <= 0 {
			return ErrPrecondition("order_not_open", "该订单已成交或已取消")
		}
		rem := o.RemainingMilli
		if o.Side == "BID" {
			refundGold := (rem * o.PriceBasis) / ResourceScale
			p.GoldFrozenBasis -= refundGold
			if p.GoldFrozenBasis < 0 {
				p.GoldFrozenBasis = 0
			}
			p.GoldBasis += refundGold
		} else {
			p.FrozenResourcesMilli[o.ItemKey] -= rem
			if p.FrozenResourcesMilli[o.ItemKey] < 0 {
				p.FrozenResourcesMilli[o.ItemKey] = 0
			}
			p.ResourcesMilli[o.ItemKey] += rem
		}
		o.RemainingMilli = 0
		o.Status = "CANCELLED"
		AppendLog(p, now, "MARKET", fmt.Sprintf("已撤单【%s %s】，冻结资产已原子退回。", o.ID, ResourceName(o.ItemKey)))
		return nil
	}
	return ErrNotFound("未找到该挂单")
}

// Graph War Connectivity & Combat Engine (GDD Chapter 10)

func GuildBaseNode(guild string) string {
	if guild == GuildArgent {
		return "node_east_base"
	}
	return "node_west_base"
}

// SupplyConnectedNodes returns the set of nodes currently owned by guild that have an unbroken path of guild-owned nodes back to the guild's base.
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

// DeployableNodes returns the set of nodes where guild members are legally allowed to deploy troops today (GDD 10.3: either supply-connected friendly nodes for defense, or enemy/neutral nodes within 1 edge of a supply-connected friendly node).
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
		return ErrPrecondition("war_locked", "请先开启【神秘的宝藏】并选择职业后再参与商会战争（GDD 9.3）")
	}
	if infDelta < 0 || arcDelta < 0 || cavDelta < 0 {
		return ErrInvalidInput("部署军备数量必须为非负整数")
	}
	totalAdd := infDelta + arcDelta + cavDelta
	if totalAdd <= 0 {
		return ErrInvalidInput("请至少选择 1 单位军备进行部署")
	}
	if p.DailyWarBudgetUsed+totalAdd > DailyWarBudgetCap {
		return ErrPrecondition("daily_budget_exceeded", fmt.Sprintf("超出每日个人军备投入上限（%d/%d 点，GDD 10.5）", p.DailyWarBudgetUsed, DailyWarBudgetCap))
	}

	deployable := DeployableNodes(w, p.GuildCode)
	if !deployable[nodeID] {
		return ErrPrecondition("supply_disconnected", "该城池与己方补给线不相连，只能向已连通城池或相邻 1 条边的目标出兵（GDD 10.3）")
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

// ComputeWeightedPower implements GDD 10.7 deterministic combat formula:
// EA = sum_i A_i * sum_j (D_j / sum D) * K[i,j]
// Returns power in milli-units (1 troop = 1,000 milli base power).
func ComputeWeightedPower(side Troops, opp Troops, defenseBonusPct int32) int64 {
	totalSide := side.Total()
	if totalSide <= 0 {
		return 0
	}
	totalOpp := opp.Total()
	// Counter matrix K[i,j] in basis points (10000 = 1.00, 11500 = 1.15, 9000 = 0.90)
	// Order: 0 = Infantry, 1 = Archer, 2 = Cavalry
	// Infantry > Archer (1.15), Archer > Cavalry (1.15), Cavalry > Infantry (1.15)
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
		// numer is scaled by totalOpp * 10000; convert to milli (* 1000)
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

// SettleWarDay executes the 20:00 nightly snapshot settlement across all map nodes (GDD 10.2, 10.7, 10.8).
func SettleWarDay(w *WorldState, activePlayer *PlayerState, now time.Time) {
	// NPC Guild commanders also reinforce frontlines before 20:00 lock
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

	// Calculate player contribution points & war stipend from Treasury
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

		// Issue public war commission stipend from Treasury (GDD 7.2)
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

// Season Chests & Procedural Collectible Minting (GDD Chapter 11)

func RedeemSeasonChest(p *PlayerState, count int32, now time.Time) error {
	if count <= 0 {
		count = 1
	}
	if count > 10 {
		count = 10
	}
	costPts := count * ChestRedeemCostPoints
	if p.ActivityPoints < costPts {
		return ErrPrecondition("insufficient_points", fmt.Sprintf("活动点数不足：兑换 %d 个赛季宝箱需要 %d 点（当前 %d 点）", count, costPts, p.ActivityPoints))
	}
	p.ActivityPoints -= costPts
	p.ResourcesMilli[ResSeasonChest] += int64(count) * ResourceScale
	AppendLog(p, now, "COLLECTIBLE", fmt.Sprintf("消耗 %d 活动点数，成功兑换 %d 个【S1·墨械典藏宝箱】（可开启或挂牌交易）。", costPts, count))
	return nil
}

func OpenSeasonChest(w *WorldState, p *PlayerState, clientSeedHint int64, now time.Time) error {
	if p.ResourcesMilli[ResSeasonChest] < ResourceScale {
		return ErrPrecondition("no_chest", "仓库中没有【S1·墨械典藏宝箱】，请先用活动点数兑换或在市场购买")
	}
	p.ResourcesMilli[ResSeasonChest] -= ResourceScale

	serial := w.NextCollectibleSeq
	w.NextCollectibleSeq++

	// Deterministic verifiable hash seed from serial, timestamp, and optional client seed hint
	rawSeed := uint64(now.UnixNano()) ^ (uint64(serial) * 0x9e3779b97f4a7c15) ^ uint64(clientSeedHint)
	rawSeed ^= rawSeed >> 30
	rawSeed *= 0xbf58476d1ce4e5b9
	rawSeed ^= rawSeed >> 27
	rawSeed *= 0x94d049bb133111eb
	rawSeed ^= rawSeed >> 31
	patternSeed := int64(rawSeed & 0x7fffffffffffff)
	if patternSeed < 100000 {
		patternSeed += 100000
	}

	models := []struct{ id, name string }{
		{"relic_chalice", "滴水圣杯 · 原初容器"},
		{"astrolabe_gear", "阿基米德星盘 · 差分轮"},
		{"alch_retort", "赫尔墨斯曲颈瓶 · 永动釜"},
		{"arcane_obelisk", "黑曜方尖碑 · 纪元碑"},
	}
	textures := []struct{ id, name string }{
		{"topo_contour", "等高线水文拓扑"},
		{"bauhaus_grid", "包豪斯黄金正交网格"},
		{"moire_wave", "双心莫尔干涉波纹"},
		{"fractal_lattice", "泰坦晶格蚀刻线"},
	}
	palettes := []struct{ id, name string }{
		{"ink_monolith", "纯墨原稿 · 炭黑象牙"},
		{"cinnabar_seal", "朱砂官印 · 矿物红点缀"},
		{"oxidized_verdigris", "青铜绿锈 · 古典蚀刻"},
		{"gilded_obsidian", "黑曜描金 · 暗金墨线"},
	}

	m := models[int(rawSeed%uint64(len(models)))]
	tex := textures[int((rawSeed>>8)%uint64(len(textures)))]
	pal := palettes[int((rawSeed>>16)%uint64(len(palettes)))]

	uvOffsetX := int32((rawSeed >> 20) % 1000)
	uvOffsetY := int32((rawSeed >> 30) % 1000)
	uvScale := int32(650 + ((rawSeed >> 40) % 1150)) // 0.65x .. 1.80x
	uvRotation := int32((rawSeed >> 50) % 360)

	// GDD 11.4 rarity roll: Common 60%, Rare 28%, Epic 10%, Legendary 2%
	roll := int((rawSeed >> 12) % 100)
	rarity := "COMMON"
	if roll >= 98 {
		rarity = "LEGENDARY"
	} else if roll >= 88 {
		rarity = "EPIC"
	} else if roll >= 60 {
		rarity = "RARE"
	}

	// Special pattern tag based on rare geometric alignment (GDD 11.3: "某些普通品质可能恰好拥有非常好看的采样花纹")
	specialTag := "标准采样花纹"
	if uvOffsetX >= 460 && uvOffsetX <= 540 && uvOffsetY >= 460 && uvOffsetY <= 540 {
		specialTag = "★ 居中同心核 (Center-Axis Lock)"
	} else if uvRotation == 0 || uvRotation == 45 || uvRotation == 90 || uvRotation == 135 || uvRotation == 180 {
		specialTag = "★ 正交工程角 (Orthogonal Angle)"
	} else if uvScale >= 1550 {
		specialTag = "★ 高密微雕纹 (Micro-Etch High Density)"
	} else if uvScale <= 750 {
		specialTag = "★ 极简巨构纹 (Macro-Minimalist)"
	}

	item := CollectibleItem{
		ItemID:        fmt.Sprintf("d2e-s1-%04d-%06x", serial, rawSeed&0xffffff),
		SerialNumber:  serial,
		SeasonID:      w.SeasonCode,
		CollectionID:  "COL-S1-GENESIS",
		Name:          fmt.Sprintf("%s | %s #%03d", m.name, tex.name, serial),
		BaseModelID:   m.id,
		BaseModelName: m.name,
		TextureID:     tex.id,
		TextureName:   tex.name,
		PatternSeed:   patternSeed,
		UVOffsetX:     uvOffsetX,
		UVOffsetY:     uvOffsetY,
		UVScale:       uvScale,
		UVRotation:    uvRotation,
		PaletteID:     pal.id,
		PaletteName:   pal.name,
		RarityTier:    rarity,
		SpecialTag:    specialTag,
		MintedAt:      now.UTC().Format("2006-01-02 15:04:05"),
		OwnerHandle:   p.Handle,
	}

	w.Collectibles = append([]CollectibleItem{item}, w.Collectibles...)
	AppendLog(p, now, "COLLECTIBLE", fmt.Sprintf("★ 开启宝箱铸造唯一藏品【%s】（品质：%s，种子：%d，特征：%s）！",
		item.Name, item.RarityTier, item.PatternSeed, item.SpecialTag))
	return nil
}
