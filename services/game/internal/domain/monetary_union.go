package domain

import (
	"fmt"
	"strings"
	"time"
)

// Supply is deliberately bounded below JS's integer ceiling, including all
// institutional ledgers. Only this function issues or cancels currency.
const MaxMoneySupply int64 = 1_000_000_000_000

func ApplyMonetaryPolicy(w *WorldState, p MonetaryPolicy, now time.Time) error {
	EnsureEconomy(w, now)
	e := w.Economy
	if len(p.ID) < 3 || len(p.ID) > 80 {
		return ErrInvalidInput("政策编号长度需为 3–80")
	}
	for _, old := range e.Policies {
		if old.ID == p.ID {
			if old.Action == p.Action && old.Amount == p.Amount && old.Item == p.Item && old.Quantity == p.Quantity && old.Price == p.Price {
				return nil
			}
			return ErrPrecondition("policy_conflict", "政策编号已使用，内容不可更改")
		}
	}
	if p.Amount < 0 || p.Amount > MaxMoneySupply {
		return ErrInvalidInput("政策金额超出范围")
	}
	var changes []balanceDelta
	switch p.Action {
	case "issue":
		if p.Amount == 0 || w.TotalIssuedBasis > MaxMoneySupply-p.Amount {
			return ErrInvalidInput("发行额必须大于零且不超过货币总量上限")
		}
		changes = []balanceDelta{{&e.Reserve, p.Amount}, {&e.Issued, p.Amount}, {&w.TotalIssuedBasis, p.Amount}}
	case "fund_public":
		changes = []balanceDelta{{&e.Reserve, -p.Amount}, {&e.Public.Cash, p.Amount}}
	case "fund_treasury":
		changes = []balanceDelta{{&e.Reserve, -p.Amount}, {&w.TreasuryHeldBasis, p.Amount}}
	case "recall_public":
		changes = []balanceDelta{{&e.Public.Cash, -p.Amount}, {&e.Reserve, p.Amount}}
	case "recall_treasury":
		changes = []balanceDelta{{&w.TreasuryHeldBasis, -p.Amount}, {&e.Reserve, p.Amount}}
	case "cancel":
		changes = []balanceDelta{{&e.Reserve, -p.Amount}, {&e.Cancelled, p.Amount}, {&w.PermanentlyBurnedBasis, p.Amount}, {&w.TotalIssuedBasis, -p.Amount}}
	case "procure":
		if strings.HasPrefix(p.Item, "share:") || isCorporateGood(p.Item) {
			return ErrInvalidInput("公共采购仅支持基础商品和职业制品，不托底公司或股价")
		}
		if err := placeMarketOrder(w, walletMarketAccount(&e.Public), p.Item, "BID", p.Price, p.Quantity, now); err != nil {
			return err
		}
	case "withdraw_order":
		if err := cancelMarketOrder(w, walletMarketAccount(&e.Public), p.Item); err != nil {
			return err
		}
	case "consume_public":
		if p.Quantity <= 0 || p.Quantity > e.Public.Stock[p.Item] {
			return ErrInvalidInput("公共库存不足")
		}
		e.Public.Stock[p.Item] -= p.Quantity
	default:
		return ErrInvalidInput("未知的货币联盟政策")
	}
	if err := applyMarketDeltas(changes); err != nil {
		return err
	}
	p.At = now.UTC()
	e.Policies = append(e.Policies, p)
	RecordEconomy(w, "monetary_policy", "", "planner", p, now)
	return nil
}

// Guild treasury is a labelled allocation inside TreasuryHeldBasis, not a
// second account. Stock values and unfilled asks never enter this identity.
func MoneyHoldings(w *WorldState) int64 {
	total := w.TreasuryHeldBasis + w.NPCHeldBasis
	for _, p := range w.Players {
		total += p.GoldBasis + p.GoldFrozenBasis
	}
	if e := w.Economy; e != nil {
		total += e.Reserve + e.Public.Cash + e.Public.Escrow
		for _, c := range e.Companies {
			total += c.Wallet.Cash + c.Wallet.Escrow + c.IPOCash
		}
	}
	return total
}

func CheckEconomy(w *WorldState) error {
	if w.TotalIssuedBasis < 0 || w.TotalIssuedBasis > MaxMoneySupply || w.TreasuryHeldBasis < 0 || w.NPCHeldBasis < 0 {
		return fmt.Errorf("invalid monetary total")
	}
	accounts := map[string]*marketAccount{}
	for h, p := range w.Players {
		if strings.HasPrefix(h, "@") || h != p.Handle {
			return fmt.Errorf("invalid player account identity: %s", h)
		}
		accounts[h] = playerMarketAccount(p)
	}
	if e := w.Economy; e != nil {
		if e.Reserve < 0 || e.Issued < e.Cancelled {
			return fmt.Errorf("invalid reserve or cancellation")
		}
		accounts[e.Public.Handle] = walletMarketAccount(&e.Public)
		for _, c := range e.Companies {
			accounts[c.Wallet.Handle] = walletMarketAccount(&c.Wallet)
		}
	}
	expectedCash := map[string]int64{}
	expectedStock := map[string]map[string]int64{}
	for _, o := range w.Orders {
		if o.Status != "OPEN" {
			continue
		}
		if accounts[o.MakerHandle] == nil || o.RemainingMilli <= 0 || o.RemainingMilli%1000 != 0 {
			return fmt.Errorf("invalid open order: %s", o.ID)
		}
		if o.Side == "BID" {
			v, err := marketValue(o.RemainingMilli, o.PriceBasis)
			if err != nil {
				return err
			}
			expectedCash[o.MakerHandle] += v
		} else if o.Side == "ASK" {
			if expectedStock[o.MakerHandle] == nil {
				expectedStock[o.MakerHandle] = map[string]int64{}
			}
			expectedStock[o.MakerHandle][o.ItemKey] += o.RemainingMilli
		} else {
			return fmt.Errorf("invalid order side: %s", o.ID)
		}
	}
	for h, a := range accounts {
		if *a.cash < 0 || *a.escrow < 0 || *a.escrow != expectedCash[h] {
			return fmt.Errorf("invalid cash or order escrow: %s", h)
		}
		for key, n := range a.stock {
			if n < 0 || strings.HasPrefix(key, "share:") && n%1000 != 0 {
				return fmt.Errorf("invalid stock: %s %s", h, key)
			}
		}
		for key, n := range a.frozen {
			if n < 0 || n != expectedStock[h][key] {
				return fmt.Errorf("invalid frozen stock: %s %s", h, key)
			}
		}
		for key, n := range expectedStock[h] {
			if a.frozen[key] != n {
				return fmt.Errorf("unfunded ask: %s %s", h, key)
			}
		}
	}
	if MoneyHoldings(w) != w.TotalIssuedBasis {
		return fmt.Errorf("money mismatch: holdings=%d issued=%d", MoneyHoldings(w), w.TotalIssuedBasis)
	}
	if e := w.Economy; e != nil {
		if e.Issued-e.Cancelled != w.TotalIssuedBasis {
			return fmt.Errorf("authorized issuance mismatch")
		}
		for id, c := range e.Companies {
			if c.Wallet.Cash < 0 || c.Wallet.Escrow < 0 || c.IPOCash < 0 {
				return fmt.Errorf("negative corporate cash: %s", id)
			}
			ipoCash := int64(0)
			if c.Status == "subscription" {
				for h, n := range c.Subscriptions {
					if w.Players[h] == nil || n < 0 || n > c.Shares {
						return fmt.Errorf("invalid IPO subscription: %s", id)
					}
					ipoCash += n * c.IPOPrice
				}
			}
			if c.IPOCash != ipoCash {
				return fmt.Errorf("IPO escrow mismatch: %s", id)
			}
			if c.Status == "listed" {
				shares := int64(0)
				for _, p := range w.Players {
					shares += (p.ResourcesMilli[ShareKey(id)] + p.FrozenResourcesMilli[ShareKey(id)]) / ResourceScale
				}
				if shares != c.Shares {
					return fmt.Errorf("share mismatch: %s got %d want %d", id, shares, c.Shares)
				}
			}
		}
	}
	return nil
}
