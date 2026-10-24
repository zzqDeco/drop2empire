package domain

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

func HashPassword(handle, rawPassword string) string {
	sum := sha256.Sum256([]byte("d2e::" + handle + "::" + rawPassword))
	return hex.EncodeToString(sum[:])
}

func HashInviteCode(rawCode string) string {
	norm := strings.ToLower(strings.TrimSpace(rawCode))
	sum := sha256.Sum256([]byte("d2e-invite::" + norm))
	return hex.EncodeToString(sum[:])
}

func CreateInvite(w *WorldState, now time.Time) (RegistrationInvite, string) {
	w.NextInviteSeq++
	b := make([]byte, 6)
	if _, err := rand.Read(b); err != nil {
		sum := sha256.Sum256([]byte(fmt.Sprintf("inv-%d-%d", w.NextInviteSeq, now.UnixNano())))
		copy(b, sum[:6])
	}
	hx := hex.EncodeToString(b) // 12 hex chars
	plain := fmt.Sprintf("d2e-inv-%s-%s-%s", hx[0:4], hx[4:8], hx[8:12])
	preview := fmt.Sprintf("d2e-inv-%s-****-%s", hx[0:4], hx[8:12])
	inv := RegistrationInvite{
		ID:          fmt.Sprintf("inv_%d", w.NextInviteSeq),
		CodeHash:    HashInviteCode(plain),
		CodePreview: preview,
		CreatedAt:   now.UTC().Format(time.RFC3339),
		ExpiresAt:   now.UTC().Add(7 * 24 * time.Hour).Format(time.RFC3339),
	}
	w.Invites = append([]RegistrationInvite{inv}, w.Invites...)
	return inv, plain
}

func ConsumeInvite(w *WorldState, rawCode, usedByHandle string, now time.Time) error {
	cleanCode := strings.TrimSpace(rawCode)
	if cleanCode == "" {
		return ErrInvalidInput("注册需提供管理员发放的邀请码")
	}
	targetHash := HashInviteCode(cleanCode)
	for i := range w.Invites {
		inv := &w.Invites[i]
		if inv.CodeHash != targetHash {
			continue
		}
		if inv.RevokedAt != "" {
			return ErrPrecondition("invite_revoked", "该邀请码已被管理员吊销")
		}
		if inv.UsedAt != "" {
			return ErrPrecondition("invite_used", "该邀请码已被使用（一码一用）")
		}
		if exp, err := time.Parse(time.RFC3339, inv.ExpiresAt); err == nil && now.UTC().After(exp) {
			return ErrPrecondition("invite_expired", "该邀请码已过期")
		}
		inv.UsedAt = now.UTC().Format(time.RFC3339)
		inv.UsedBy = usedByHandle
		return nil
	}
	return ErrPrecondition("invalid_invite_code", "邀请码无效，请联系管理员获取有效邀请码")
}

func RevokeInvite(w *WorldState, inviteID string, now time.Time) error {
	targetID := strings.TrimSpace(inviteID)
	for i := range w.Invites {
		inv := &w.Invites[i]
		if inv.ID != targetID {
			continue
		}
		if inv.UsedAt != "" {
			return ErrPrecondition("invite_already_used", "该邀请码已被使用，无法吊销")
		}
		if inv.RevokedAt == "" {
			inv.RevokedAt = now.UTC().Format(time.RFC3339)
		}
		return nil
	}
	return ErrNotFound("未找到指定的邀请码")
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
	EnsureSeasonState(w, now)
	if w.Players == nil {
		w.Players = make(map[string]*PlayerState)
	}
	if w.Sessions == nil {
		w.Sessions = make(map[string]string)
	}
	if w.Invites == nil {
		w.Invites = []RegistrationInvite{}
	}
	for _, pl := range w.Players {
		if pl == nil {
			continue
		}
		if pl.ActiveEdicts == nil {
			pl.ActiveEdicts = map[string]bool{}
		}
		if pl.Workers == nil {
			pl.Workers = map[string]int32{}
		}
		if pl.ResourcesMilli == nil {
			pl.ResourcesMilli = map[string]int64{}
		}
		if pl.FrozenResourcesMilli == nil {
			pl.FrozenResourcesMilli = map[string]int64{}
		}
		if pl.UnlockedBlueprints == nil {
			pl.UnlockedBlueprints = map[string]bool{}
		}
		EnsureRaidState(pl)
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
	EnsureGuildState(w)
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
		Invites:                []RegistrationInvite{},
		NextInviteSeq:          100,
		TotalIssuedBasis:       treasuryInit + npcInit,
		NPCHeldBasis:           npcInit,
		TreasuryHeldBasis:      treasuryInit,
		PermanentlyBurnedBasis: 0,
		LastPricesBasis:        lastPrices,
		OpenPriceBasis:         openPrices,
		Orders:                 []MarketOrder{},
		Trades:                 []MarketTrade{},
		SeasonNumber:           1,
		SeasonCode:             "S1-OBSIDIAN-AWAKENING",
		SeasonName:             "S1 · 黑曜苏醒",
		SeasonSubtitle:         "第一赛季 · 墨械筑城与沉没圣殿纪元",
		SeasonStartedAt:        now.UTC().Format(time.RFC3339),
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

	// Primary player starts at 0 water, 0 population.
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
	veteran.ResourcesMilli[ResFlint] = 14 * ResourceScale
	veteran.ResourcesMilli[ResAncientShard] = 5 * ResourceScale
	veteran.ResourcesMilli[ResMeteorOre] = 2 * ResourceScale
	veteran.ResourcesMilli[ResBPCrossbow] = 1 * ResourceScale
	veteran.ResourcesMilli[ResBPSpringBoots] = 1 * ResourceScale
	veteran.ResourcesMilli[ResCosSteamCrown] = 1 * ResourceScale
	veteran.ResourcesMilli[ResCosHydroWings] = 1 * ResourceScale
	veteran.ResourcesMilli[ResCosAlchLantern] = 1 * ResourceScale
	veteran.ResourcesMilli[ResCosMechOwl] = 1 * ResourceScale
	veteran.EquippedCosmetics = map[string]string{
		"headgear":   ResCosSteamCrown,
		"mantle":     ResCosHydroWings,
		"held_relic": ResCosAlchLantern,
		"companion":  ResCosMechOwl,
	}
	EnsureRaidState(veteran)
	veteran.InstalledEquipments[ResAutoPump] = 2
	veteran.InstalledEquipments[ResAlchCatalyst] = 1
	veteran.ActivityPoints = 260
	veteranGrant := int64(1850) * GoldScale
	w.TreasuryHeldBasis -= veteranGrant
	veteran.GoldBasis = veteranGrant
	veteran.SimulatedElapsedSeconds = 2400
	AppendLog(veteran, now, "PROFESSION", "账号 archon_demo 已预置完成第一阶段并就职【科学家】，可直接体验跨职业制造、现货挂单、商会城池战与宝箱铸造。")
	w.Players["archon_demo"] = veteran

	EnsureGuildState(w)
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
		ID:                      "plr_" + handle,
		Handle:                  handle,
		Phase:                   1,
		Profession:              ProfNone,
		ArtifactName:            "",
		PopulationTotal:         0,
		Workers:                 map[string]int32{JobWater: 0, JobWood: 0, JobCharcoal: 0, JobStone: 0, JobSmeltIron: 0, JobPrepRation: 0},
		ResourcesMilli:          res,
		FrozenResourcesMilli:    frozen,
		UnlockedBlueprints:      map[string]bool{},
		ActiveEdicts:            map[string]bool{},
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
	EnsureRaidState(p)
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
