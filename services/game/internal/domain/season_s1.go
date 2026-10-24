package domain

import (
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"time"
)

func RedeemSeasonChest(p *PlayerState, count int32, now time.Time) error {
	if count <= 0 {
		count = 1
	}
	if count > SeasonChestBalance.MaxRedeemBatchCount {
		count = SeasonChestBalance.MaxRedeemBatchCount
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

func OpenSeasonChest(w *WorldState, p *PlayerState, _ int64, now time.Time) error {
	EnsureSeasonState(w, now)
	if p.ResourcesMilli[ResSeasonChest] < ResourceScale {
		return ErrPrecondition("no_chest", "仓库中没有【S1·墨械典藏宝箱】，请先用活动点数兑换或在市场购买")
	}
	p.ResourcesMilli[ResSeasonChest] -= ResourceScale

	serial := w.NextCollectibleSeq
	w.NextCollectibleSeq++

	// Cryptographically secure server entropy (ignoring client-provided seed hints)
	var csprngBuf [8]byte
	var rawSeed uint64
	if _, err := rand.Read(csprngBuf[:]); err == nil {
		rawSeed = binary.LittleEndian.Uint64(csprngBuf[:]) ^ (uint64(serial) * 0x9e3779b97f4a7c15) ^ uint64(now.UnixNano())
	} else {
		rawSeed = uint64(now.UnixNano()) ^ (uint64(serial) * 0x9e3779b97f4a7c15)
	}
	rawSeed ^= rawSeed >> 30
	rawSeed *= 0xbf58476d1ce4e5b9
	rawSeed ^= rawSeed >> 27
	rawSeed *= 0x94d049bb133111eb
	rawSeed ^= rawSeed >> 31
	patternSeed := int64(rawSeed & 0x7fffffffffffff)
	if patternSeed < 100000 {
		patternSeed += 100000
	}

	m := SeasonRelicModels[int(rawSeed%uint64(len(SeasonRelicModels)))]
	tex := SeasonRelicTextures[int((rawSeed>>8)%uint64(len(SeasonRelicTextures)))]
	pal := SeasonRelicPalettes[int((rawSeed>>16)%uint64(len(SeasonRelicPalettes)))]

	uvOffsetX := int32((rawSeed >> 20) % 1000)
	uvOffsetY := int32((rawSeed >> 30) % 1000)
	uvScale := SeasonChestBalance.UVScaleBase + int32((rawSeed>>40)%SeasonChestBalance.UVScaleSpan)
	uvRotation := int32((rawSeed >> 50) % 360)

	roll := int((rawSeed >> 12) % 100)
	rarity := "COMMON"
	if roll >= SeasonChestBalance.LegendaryRollMin {
		rarity = "LEGENDARY"
	} else if roll >= SeasonChestBalance.EpicRollMin {
		rarity = "EPIC"
	} else if roll >= SeasonChestBalance.RareRollMin {
		rarity = "RARE"
	}

	specialTag := "标准采样花纹"
	if uvOffsetX >= SeasonChestBalance.CenterLockMin && uvOffsetX <= SeasonChestBalance.CenterLockMax &&
		uvOffsetY >= SeasonChestBalance.CenterLockMin && uvOffsetY <= SeasonChestBalance.CenterLockMax {
		specialTag = "★ 居中同心核 (Center-Axis Lock)"
	} else if uvRotation == 0 || uvRotation == 45 || uvRotation == 90 || uvRotation == 135 || uvRotation == 180 {
		specialTag = "★ 正交工程角 (Orthogonal Angle)"
	} else if uvScale >= SeasonChestBalance.MicroEtchScaleMin {
		specialTag = "★ 高密微雕纹 (Micro-Etch High Density)"
	} else if uvScale <= SeasonChestBalance.MacroMinScaleMax {
		specialTag = "★ 极简巨构纹 (Macro-Minimalist)"
	}

	item := CollectibleItem{
		ItemID:        fmt.Sprintf("d2e-s%d-%04d-%06x", w.SeasonNumber, serial, rawSeed&0xffffff),
		SerialNumber:  serial,
		SeasonID:      w.SeasonCode,
		CollectionID:  fmt.Sprintf("COL-S%d-GENESIS", w.SeasonNumber),
		Name:          fmt.Sprintf("%s | %s #%03d", m.Name, tex.Name, serial),
		BaseModelID:   m.ID,
		BaseModelName: m.Name,
		TextureID:     tex.ID,
		TextureName:   tex.Name,
		PatternSeed:   patternSeed,
		UVOffsetX:     uvOffsetX,
		UVOffsetY:     uvOffsetY,
		UVScale:       uvScale,
		UVRotation:    uvRotation,
		PaletteID:     pal.ID,
		PaletteName:   pal.Name,
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
