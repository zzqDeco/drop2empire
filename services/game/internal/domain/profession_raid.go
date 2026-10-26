package domain

import (
	"strings"
	"time"
)

// Called only through ApplyRaidCommand: retries, expiry and raid identity share
// the existing authoritative command fence. These common craftables do not
// grant rare loot, extend the expedition timer, or duplicate seasonal potions.
func useRaidConsumable(p *PlayerState, key string, dx, dy int32, now time.Time) error {
	s := p.RaidLoadout.ActiveSession
	if s == nil || !now.Before(s.ExpiresAt) {
		return ErrPrecondition("no_active_raid", "远征已结束")
	}
	spec, ok := FindConsumable(key)
	if !ok || spec.Use != "raid" {
		return ErrInvalidInput("不是远征耗材")
	}
	if p.ResourcesMilli[key] < 1000 {
		return ErrPrecondition("insufficient_resource", "没有该耗材")
	}
	for _, used := range s.UsedPotionKeys {
		if used == key {
			return ErrPrecondition("already_used", "每局只能使用一次同类耗材")
		}
	}
	z := &s.Zones[s.CurrentZoneID]
	switch key {
	case ResRecovery:
		if s.HP >= s.MaxHP {
			return ErrPrecondition("full_health", "生命已满")
		}
		s.HP = min(s.MaxHP, s.HP+30)
	case ResDetector:
		revealServerZoneAround(z, s.PlayerX, s.PlayerY, 4, false)
	case ResBreach:
		tile := z.Tiles[int(s.PlayerY*z.Width+s.PlayerX)]
		if !strings.HasPrefix(tile.Kind, "chest_") || tile.Looted || s.ChannelReadyAt.IsZero() || !now.Before(s.ChannelReadyAt) {
			return ErrPrecondition("no_active_channel", "需要正在搜索尚未开启的宝箱")
		}
		s.ChannelReadyAt = now.Add(s.ChannelReadyAt.Sub(now) * 6 / 10)
	case ResBlink:
		if !((dx == 2 || dx == -2) && dy == 0 || (dy == 2 || dy == -2) && dx == 0) {
			return ErrInvalidInput("闪步需指定正交方向两格")
		}
		for step := int32(1); step <= 2; step++ {
			x, y := s.PlayerX+dx*step/2, s.PlayerY+dy*step/2
			if x < 0 || y < 0 || x >= z.Width || y >= z.Height {
				return ErrPrecondition("unsafe_blink", "闪步路径越界")
			}
			t := z.Tiles[int(y*z.Width+x)]
			if !t.Explored || t.Kind == "wall" || strings.HasPrefix(t.Kind, "enemy_") && !t.Looted {
				return ErrPrecondition("unsafe_blink", "只能沿已探索的安全通道闪步")
			}
		}
		if now.Before(s.LastMoveAt.Add(time.Duration(RaidMoveCooldownMs(s, now)) * time.Millisecond)) {
			return ErrPrecondition("move_cooldown", "等待移动冷却")
		}
		s.PlayerX += dx
		s.PlayerY += dy
		s.LastMoveAt = now
		s.SteppedOnTileAt = now
		s.ActiveChestDrops = nil
		setRaidChannel(s, z.Tiles[int(s.PlayerY*z.Width+s.PlayerX)].Kind, now)
	}
	p.ResourcesMilli[key] -= 1000
	s.UsedPotionKeys = append(s.UsedPotionKeys, key)
	prependRaidLog(s, "使用"+spec.Name)
	return nil
}
