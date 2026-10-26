package domain

import (
	"encoding/json"
	"strings"
	"time"
)

type EconomyCommand struct {
	Action   string
	Target   string
	Option   string
	Quantity int64
	VoteID   int64
	Approve  bool
	Plan     CompanyPlan
}

func ApplyEconomyCommand(w *WorldState, p *PlayerState, seq int64, cmd EconomyCommand, now time.Time) error {
	EnsureEconomy(w, now)
	raw, _ := json.Marshal(cmd)
	return settlementCommand(p, seq, "economy:"+string(raw), func() error {
		switch cmd.Action {
		case "build_facility":
			return BuildProfessionFacility(p, cmd.Option, now)
		case "craft":
			if cmd.Quantity < 1 || cmd.Quantity > 20 {
				return ErrInvalidInput("批次需为 1–20")
			}
			return QueueProfessionalCraft(p, cmd.Target, int32(cmd.Quantity), now)
		case "use":
			return UseConsumable(w, p, cmd.Target, cmd.Option, now)
		case "subscribe":
			return SubscribeIPO(w, p, cmd.Target, cmd.Quantity, now)
		case "propose":
			return OpenCompanyVote(w, p, cmd.Target, cmd.Plan, now)
		case "vote":
			return VoteCompany(w, p, cmd.Target, cmd.VoteID, cmd.Approve, now)
		default:
			return ErrInvalidInput("未知的经济指令")
		}
	})
}

func HasFinancialPosition(w *WorldState, p *PlayerState) bool {
	if w.Economy == nil {
		return false
	}
	for _, order := range w.Orders {
		if order.MakerHandle == p.Handle && order.Status == "OPEN" && order.RemainingMilli > 0 && strings.HasPrefix(order.ItemKey, "share:") {
			return true
		}
	}
	for id, c := range w.Economy.Companies {
		if p.ResourcesMilli[ShareKey(id)]+p.FrozenResourcesMilli[ShareKey(id)] > 0 || c.Status == "subscription" && c.Subscriptions[p.Handle] > 0 {
			return true
		}
		if c.Vote != nil && c.Vote.Result == "" && c.Vote.Weights[p.Handle] > 0 {
			return true
		}
	}
	return false
}
