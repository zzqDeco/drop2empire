package domain

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"time"
)

type RaidCommand struct {
	Action                                      string
	DX, DY                                      int32
	ItemID, FromContainer, ToContainer, ItemKey string
	Status                                      string
}

// ApplyRaidCommand binds every mutation to one raid and a monotonically increasing
// sequence. A retry of the last accepted command is read-only; older commands fail
// closed. Terminal receipts survive subsequent raids (bounded to the last 16).
func ApplyRaidCommand(p *PlayerState, raidID string, seq int64, cmd RaidCommand, now time.Time) error {
	if raidID == "" || seq < 1 {
		return ErrInvalidInput("缺少有效的远征标识或指令序号")
	}
	raw, _ := json.Marshal(cmd)
	sum := sha256.Sum256(raw)
	digest := hex.EncodeToString(sum[:])
	for _, receipt := range p.RaidLoadout.CompletedRaids {
		if receipt.RaidID == raidID && receipt.CommandSeq == seq && receipt.CommandDigest == digest {
			return nil
		}
	}
	sess := p.RaidLoadout.ActiveSession
	if sess == nil || sess.RaidID != raidID {
		return ErrPrecondition("stale_raid", "远征已结束或指令属于另一局，请刷新状态")
	}
	if seq == sess.LastCommandSeq && digest == sess.LastCommandDigest {
		return nil
	}
	if seq != sess.LastCommandSeq+1 {
		return ErrPrecondition("raid_sequence_conflict", "远征指令顺序冲突，请刷新后重试")
	}
	var err error
	if cmd.Action == "finish" {
		err = FinishRaid(p, cmd.Status, now)
	} else {
		err = PerformRaidAction(p, cmd.Action, cmd.DX, cmd.DY, cmd.ItemID, cmd.FromContainer, cmd.ToContainer, cmd.ItemKey, now)
	}
	if err != nil {
		return err
	}
	sess.LastCommandSeq, sess.LastCommandDigest = seq, digest
	if p.RaidLoadout.ActiveSession == nil {
		rep := p.RaidLoadout.LastSettlementReport
		rep.CommandSeq, rep.CommandDigest = seq, digest
		p.RaidLoadout.CompletedRaids = append([]RaidSettlementReport{*rep}, p.RaidLoadout.CompletedRaids...)
		if len(p.RaidLoadout.CompletedRaids) > 16 {
			p.RaidLoadout.CompletedRaids = p.RaidLoadout.CompletedRaids[:16]
		}
	}
	return nil
}

func RaidMoveCooldownMs(sess *ActiveRaidSession, now time.Time) int32 {
	cd := sess.BaseMoveCooldownMs
	if cd <= 0 {
		cd = RaidBalance.BaseMoveCooldownMs
	}
	if now.Before(sess.GaleEndsAt) && RaidBalance.GalePotionCooldownMs < cd {
		cd = RaidBalance.GalePotionCooldownMs
	}
	return cd
}

// Channels start automatically on entering a tile. Their deadline is frozen at
// entry, so drinking a potion or its expiry cannot retroactively shorten a cast.
func setRaidChannel(sess *ActiveRaidSession, kind string, now time.Time) {
	sess.ChannelReadyAt = time.Time{}
	duration := RaidChannelDurationMs[kind]
	if duration <= 0 {
		return
	}
	if now.Before(sess.ScavEndsAt) {
		duration = duration * (100 - RaidBalance.PotionScavSpeedPct) / 100
	}
	sess.ChannelReadyAt = now.Add(time.Duration(duration) * time.Millisecond)
}

func verifyRaidChannel(sess *ActiveRaidSession, now time.Time) error {
	if sess.ChannelReadyAt.IsZero() || now.Before(sess.ChannelReadyAt) || now.Before(sess.SteppedOnTileAt) {
		return ErrPrecondition("channeling_incomplete", "原地读条尚未完成，请保持位置")
	}
	return nil
}
