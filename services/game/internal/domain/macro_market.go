package domain

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
)

func ResourceName(key string) string {
	for _, r := range ResourceCatalog {
		if r.Key == key {
			return r.Name
		}
	}
	if strings.HasPrefix(key, "share:") {
		if s, ok := FindCompanySpec(strings.TrimPrefix(key, "share:")); ok {
			return s.Name + "股份"
		}
	}
	return key
}

// A clean economy has no fabricated quotes or trade history. Public procurement
// is placed by an audited planner policy with real cash escrow.
func SeedNPCMarket(w *WorldState, now time.Time) { EnsureEconomy(w, now) }

type marketAccount struct {
	handle        string
	cash, escrow  *int64
	stock, frozen map[string]int64
	player        *PlayerState
}

func playerMarketAccount(p *PlayerState) *marketAccount {
	return &marketAccount{p.Handle, &p.GoldBasis, &p.GoldFrozenBasis, p.ResourcesMilli, p.FrozenResourcesMilli, p}
}
func walletMarketAccount(p *TradingWallet) *marketAccount {
	return &marketAccount{p.Handle, &p.Cash, &p.Escrow, p.Stock, p.Frozen, nil}
}
func lookupMarketAccount(w *WorldState, handle string) *marketAccount {
	if p := w.Players[handle]; p != nil {
		return playerMarketAccount(p)
	}
	if w.Economy != nil {
		if handle == w.Economy.Public.Handle {
			return walletMarketAccount(&w.Economy.Public)
		}
		for _, c := range w.Economy.Companies {
			if c.Wallet.Handle == handle {
				return walletMarketAccount(&c.Wallet)
			}
		}
	}
	return nil
}
func tradable(w *WorldState, key string) bool {
	for _, r := range ResourceCatalog {
		if r.Key == key && r.Tradable {
			return true
		}
	}
	if w.Economy != nil && strings.HasPrefix(key, "share:") {
		c := w.Economy.Companies[strings.TrimPrefix(key, "share:")]
		return c != nil && c.Status == "listed"
	}
	return false
}
func PlaceMarketOrder(w *WorldState, p *PlayerState, item, side string, price, qty int64, now time.Time) error {
	if p.Profession == ProfNone && !(strings.HasPrefix(item, "share:") && HasFinancialPosition(w, p)) {
		return ErrPrecondition("market_locked", "选择职业后开放市场")
	}
	return placeMarketOrder(w, playerMarketAccount(p), item, side, price, qty, now)
}
func placeMarketOrder(w *WorldState, a *marketAccount, item, side string, price, qty int64, now time.Time) error {
	if side != "BID" && side != "ASK" {
		return ErrInvalidInput("交易方向必须为 BID 或 ASK")
	}
	if price < MacroBalance.MinOrderPriceBasis || price > MacroBalance.MaxOrderPriceBasis || qty < 1000 || qty > MacroBalance.MaxOrderQtyMilli || qty%1000 != 0 {
		return ErrInvalidInput("价格或数量超出范围，数量必须为整数单位")
	}
	if !tradable(w, item) {
		return ErrInvalidInput("该资产不可交易")
	}
	open, own := 0, 0
	for _, o := range w.Orders {
		if o.Status == "OPEN" {
			open++
			if o.MakerHandle == a.handle {
				own++
			}
		}
	}
	if open >= 10000 || own >= 128 {
		return ErrPrecondition("order_limit", "未成交订单数量已达上限")
	}
	value, err := marketValue(qty, price)
	if err != nil {
		return err
	}
	if side == "BID" {
		if *a.cash < value {
			return ErrPrecondition("insufficient_gold", "买单所需可用金币不足")
		}
		if err := applyMarketDeltas([]balanceDelta{{a.cash, -value}, {a.escrow, value}}); err != nil {
			return err
		}
	} else {
		if a.stock[item] < qty {
			return ErrPrecondition("insufficient_resource", "卖单所需库存不足")
		}
		if !validBalanceDelta(a.frozen[item], qty) {
			return ErrInvalidInput("冻结库存超出安全范围")
		}
		a.stock[item] -= qty
		a.frozen[item] += qty
	}
	w.NextOrderSeq++
	order := MarketOrder{ID: fmt.Sprintf("ord_%d", w.NextOrderSeq), ItemKey: item, Side: side, PriceBasis: price, QuantityMilli: qty, RemainingMilli: qty, MakerHandle: a.handle, Status: "OPEN", CreatedAt: now.UTC().Format(time.RFC3339)}
	if err := matchOrder(w, a, &order, now); err != nil {
		return err
	}
	w.Orders = append([]MarketOrder{order}, w.Orders...)
	// Keep all live orders and bounded closed-order history. Trades are durably audited.
	retained := w.Orders[:0]
	closed := 0
	for _, o := range w.Orders {
		if o.Status == "OPEN" || closed < 256 {
			retained = append(retained, o)
			if o.Status != "OPEN" {
				closed++
			}
		}
	}
	w.Orders = retained
	if a.player != nil {
		AppendLog(a.player, now, "MARKET", fmt.Sprintf("%s %s：成交 %.0f，挂单 %.0f", side, ResourceName(item), float64(order.FilledMilli)/1000, float64(order.RemainingMilli)/1000))
	}
	return nil
}
func MatchOrder(w *WorldState, p *PlayerState, incoming *MarketOrder, now time.Time) error {
	return matchOrder(w, playerMarketAccount(p), incoming, now)
}
func matchOrder(w *WorldState, taker *marketAccount, incoming *MarketOrder, now time.Time) error {
	var indices []int
	for i, o := range w.Orders {
		if o.Status != "OPEN" || o.ItemKey != incoming.ItemKey || o.Side == incoming.Side || o.RemainingMilli <= 0 || o.MakerHandle == incoming.MakerHandle {
			continue
		}
		if incoming.Side == "BID" && incoming.PriceBasis >= o.PriceBasis || incoming.Side == "ASK" && incoming.PriceBasis <= o.PriceBasis {
			indices = append(indices, i)
		}
	}
	sort.Slice(indices, func(i, j int) bool {
		a, b := w.Orders[indices[i]], w.Orders[indices[j]]
		if a.PriceBasis != b.PriceBasis {
			if incoming.Side == "BID" {
				return a.PriceBasis < b.PriceBasis
			}
			return a.PriceBasis > b.PriceBasis
		}
		return orderSequence(a.ID) < orderSequence(b.ID)
	})
	for _, idx := range indices {
		if incoming.RemainingMilli == 0 {
			break
		}
		resting := &w.Orders[idx]
		maker := lookupMarketAccount(w, resting.MakerHandle)
		if maker == nil {
			return ErrPrecondition("invalid_order_owner", "订单账户不存在，请清档后启动新经济规则")
		}
		qty := min(incoming.RemainingMilli, resting.RemainingMilli)
		gold, err := marketValue(qty, resting.PriceBasis)
		if err != nil {
			return err
		}
		buyer, seller := maker, taker
		locked := gold
		if incoming.Side == "BID" {
			buyer, seller = taker, maker
			locked, err = marketValue(qty, incoming.PriceBasis)
			if err != nil {
				return err
			}
		}
		for _, a := range []*marketAccount{buyer, seller} {
			if a.player != nil && a != taker {
				SettleProduction(a.player, now)
			}
		}
		tax := (gold/10000)*MarketTaxBps + (gold%10000)*MarketTaxBps/10000
		stock, frozen := buyer.stock[incoming.ItemKey], seller.frozen[incoming.ItemKey]
		if err := applyMarketDeltas([]balanceDelta{{buyer.escrow, -locked}, {buyer.cash, locked - gold}, {seller.cash, gold - tax}, {&stock, qty}, {&frozen, -qty}, {&w.TreasuryHeldBasis, tax}}); err != nil {
			return err
		}
		buyer.stock[incoming.ItemKey], seller.frozen[incoming.ItemKey] = stock, frozen
		recordCorporateTrade(w, buyer.handle, seller.handle, incoming.ItemKey, qty, gold, tax)
		incoming.FilledMilli += qty
		incoming.RemainingMilli -= qty
		resting.FilledMilli += qty
		resting.RemainingMilli -= qty
		if resting.RemainingMilli == 0 {
			resting.Status = "FILLED"
		}
		w.LastPricesBasis[incoming.ItemKey] = resting.PriceBasis
		if w.OpenPriceBasis[incoming.ItemKey] == 0 {
			w.OpenPriceBasis[incoming.ItemKey] = resting.PriceBasis
		}
		w.NextTradeSeq++
		trade := MarketTrade{ID: fmt.Sprintf("trd_%d", w.NextTradeSeq), ItemKey: incoming.ItemKey, PriceBasis: resting.PriceBasis, QuantityMilli: qty, TotalGoldBasis: gold, TaxTreasuryBasis: tax, BuyerHandle: buyer.handle, SellerHandle: seller.handle, ExecutedAt: now.UTC().Format(time.RFC3339)}
		w.PendingTrades = append(w.PendingTrades, trade)
		w.Trades = append([]MarketTrade{trade}, w.Trades...)
		if len(w.Trades) > 60 {
			w.Trades = w.Trades[:60]
		}
	}
	if incoming.RemainingMilli == 0 {
		incoming.Status = "FILLED"
	}
	return nil
}
func CancelMarketOrder(w *WorldState, p *PlayerState, id string, now time.Time) error {
	return cancelMarketOrder(w, playerMarketAccount(p), id)
}
func cancelMarketOrder(w *WorldState, a *marketAccount, id string) error {
	for i := range w.Orders {
		o := &w.Orders[i]
		if o.ID != id {
			continue
		}
		if o.MakerHandle != a.handle {
			return ErrPrecondition("not_order_owner", "只能撤销自己的订单")
		}
		if o.Status != "OPEN" || o.RemainingMilli <= 0 {
			return ErrPrecondition("order_not_open", "订单已关闭")
		}
		if o.Side == "BID" {
			v, err := marketValue(o.RemainingMilli, o.PriceBasis)
			if err != nil {
				return err
			}
			if err := applyMarketDeltas([]balanceDelta{{a.escrow, -v}, {a.cash, v}}); err != nil {
				return err
			}
		} else {
			if a.frozen[o.ItemKey] < o.RemainingMilli || !validBalanceDelta(a.stock[o.ItemKey], o.RemainingMilli) {
				return ErrPrecondition("invalid_escrow", "库存托管异常")
			}
			a.frozen[o.ItemKey] -= o.RemainingMilli
			a.stock[o.ItemKey] += o.RemainingMilli
		}
		o.RemainingMilli = 0
		o.Status = "CANCELLED"
		return nil
	}
	return ErrNotFound("挂单不存在")
}

// The HTTP integer wire format must remain exactly representable by JS clients.
const maxAccountAmount int64 = 1<<53 - 1

type balanceDelta struct {
	value *int64
	delta int64
}

func validBalanceDelta(value, delta int64) bool {
	return value >= 0 && value <= maxAccountAmount && delta >= -value && delta <= maxAccountAmount-value
}
func applyMarketDeltas(deltas []balanceDelta) error {
	for _, d := range deltas {
		if !validBalanceDelta(*d.value, d.delta) {
			return ErrPrecondition("invalid_escrow", "资产余额或托管金额超出安全范围，交易未执行")
		}
	}
	for _, d := range deltas {
		*d.value += d.delta
	}
	return nil
}
func marketValue(qty, price int64) (int64, error) {
	if qty <= 0 || qty%ResourceScale != 0 || price <= 0 || qty/ResourceScale > maxAccountAmount/price {
		return 0, ErrInvalidInput("订单总金额超出安全记账范围")
	}
	return (qty / ResourceScale) * price, nil
}
func orderSequence(id string) uint64 {
	n, _ := strconv.ParseUint(strings.TrimPrefix(id, "ord_"), 10, 64)
	return n
}
