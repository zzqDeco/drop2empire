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
	return key
}

// SeedNPCMarket populates realistic limit orders and sample trades driven by NPCMarketSeedOrders and NPCMarketSeedTrades.
func SeedNPCMarket(w *WorldState, now time.Time) {
	ts := now.UTC().Format("15:04:05")
	for _, so := range NPCMarketSeedOrders {
		w.NextOrderSeq++
		w.Orders = append(w.Orders, MarketOrder{
			ID:             fmt.Sprintf("ord_%d", w.NextOrderSeq),
			ItemKey:        so.ItemKey,
			Side:           so.Side,
			PriceBasis:     so.PriceBasis,
			QuantityMilli:  so.QuantityMilli,
			FilledMilli:    0,
			RemainingMilli: so.QuantityMilli,
			MakerHandle:    so.MakerHandle,
			IsNPC:          true,
			Status:         "OPEN",
			CreatedAt:      ts,
		})
	}

	for _, st := range NPCMarketSeedTrades {
		w.NextTradeSeq++
		totalGold := (st.QuantityMilli / ResourceScale) * st.PriceBasis
		tax := (totalGold * MarketTaxBps) / 10000
		burn := (tax * MarketBurnShareBps) / MarketTaxBps
		treas := tax - burn
		w.NPCHeldBasis -= tax
		w.PermanentlyBurnedBasis += burn
		w.TotalIssuedBasis -= burn
		w.TreasuryHeldBasis += treas
		w.Trades = append(w.Trades, MarketTrade{
			ID:               fmt.Sprintf("trd_%d", w.NextTradeSeq),
			ItemKey:          st.ItemKey,
			PriceBasis:       st.PriceBasis,
			QuantityMilli:    st.QuantityMilli,
			TotalGoldBasis:   totalGold,
			TaxBurnedBasis:   burn,
			TaxTreasuryBasis: treas,
			BuyerHandle:      st.BuyerHandle,
			SellerHandle:     st.SellerHandle,
			ExecutedAt:       ts,
		})
	}
}

func PlaceMarketOrder(w *WorldState, p *PlayerState, itemKey, side string, priceBasis, quantityMilli int64, now time.Time) error {
	if p.Profession == ProfNone {
		return ErrPrecondition("market_locked", "完成【神秘的宝藏】并选定职业后解锁全球现货交易所")
	}
	if side != "BID" && side != "ASK" {
		return ErrInvalidInput("交易方向必须为 BID（买入）或 ASK（卖出）")
	}
	if priceBasis < MacroBalance.MinOrderPriceBasis || priceBasis > MacroBalance.MaxOrderPriceBasis {
		return ErrInvalidInput("单价超出允许范围（0.0100 - 10,000.0000 金币）")
	}
	if quantityMilli < MacroBalance.MinOrderQtyMilli || quantityMilli > 1_000_000_000_000 || quantityMilli%ResourceScale != 0 {
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

	totalEscrowGold, err := marketValue(quantityMilli, priceBasis)
	if err != nil {
		return err
	}
	if side == "BID" {
		if p.GoldBasis < totalEscrowGold {
			return ErrPrecondition("insufficient_gold", fmt.Sprintf("可用金币不足：买单需冻结 %.4f 金币", float64(totalEscrowGold)/float64(GoldScale)))
		}
		if err := applyMarketDeltas([]balanceDelta{{&p.GoldBasis, -totalEscrowGold}, {&p.GoldFrozenBasis, totalEscrowGold}}); err != nil {
			return err
		}
	} else {
		if p.ResourcesMilli[itemKey] < quantityMilli {
			return ErrPrecondition("insufficient_resource", fmt.Sprintf("可用【%s】库存不足：卖单需冻结 %.1f 单位", ResourceName(itemKey), float64(quantityMilli)/1000.0))
		}
		if !validBalanceDelta(p.FrozenResourcesMilli[itemKey], quantityMilli) {
			return ErrInvalidInput("冻结资源超出记账范围")
		}
		p.ResourcesMilli[itemKey] -= quantityMilli
		p.FrozenResourcesMilli[itemKey] += quantityMilli
		EnsureRaidState(p)
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

	if err := MatchOrder(w, p, &newOrd, now); err != nil {
		return err
	}
	w.Orders = append([]MarketOrder{newOrd}, w.Orders...)
	return nil
}

func MatchOrder(w *WorldState, taker *PlayerState, incoming *MarketOrder, now time.Time) error {
	var candidateIdx []int
	for i := range w.Orders {
		o := &w.Orders[i]
		if o.Status != "OPEN" || o.ItemKey != incoming.ItemKey || o.Side == incoming.Side || o.RemainingMilli <= 0 {
			continue
		}
		if o.MakerHandle == incoming.MakerHandle && !o.IsNPC {
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
			if oa.PriceBasis != ob.PriceBasis {
				return oa.PriceBasis < ob.PriceBasis
			}
		} else {
			if oa.PriceBasis != ob.PriceBasis {
				return oa.PriceBasis > ob.PriceBasis
			}
		}
		return orderSequence(oa.ID) < orderSequence(ob.ID)
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
		tradeGold, err := marketValue(fillMilli, execPrice)
		if err != nil {
			return err
		}
		taxTotal := tradeGold / 100
		taxBurn := taxTotal / 2
		taxTreasury := taxTotal - taxBurn

		var buyerHandle, sellerHandle string
		var buyer, seller *PlayerState
		lockedForFill := tradeGold
		if incoming.Side == "BID" {
			buyerHandle, sellerHandle = incoming.MakerHandle, resting.MakerHandle
			buyer = taker
			if !resting.IsNPC {
				seller = w.Players[sellerHandle]
			}
			lockedForFill, err = marketValue(fillMilli, incoming.PriceBasis)
			if err != nil {
				return err
			}
		} else {
			buyerHandle, sellerHandle = resting.MakerHandle, incoming.MakerHandle
			seller = taker
			if !resting.IsNPC {
				buyer = w.Players[buyerHandle]
			}
		}
		if !resting.IsNPC && (buyer == nil || seller == nil) {
			return ErrPrecondition("invalid_order_owner", "订单账户不存在")
		}
		deltas := []balanceDelta{{&w.PermanentlyBurnedBasis, taxBurn}, {&w.TotalIssuedBasis, -taxBurn}, {&w.TreasuryHeldBasis, taxTreasury}}
		var buyerStock, sellerFrozen int64
		if buyer != nil {
			buyerStock = buyer.ResourcesMilli[incoming.ItemKey]
			deltas = append(deltas, balanceDelta{&buyer.GoldFrozenBasis, -lockedForFill}, balanceDelta{&buyer.GoldBasis, lockedForFill - tradeGold}, balanceDelta{&buyerStock, fillMilli})
		} else {
			if w.NPCHeldBasis < tradeGold {
				continue
			}
			deltas = append(deltas, balanceDelta{&w.NPCHeldBasis, -tradeGold})
		}
		if seller != nil {
			sellerFrozen = seller.FrozenResourcesMilli[incoming.ItemKey]
			deltas = append(deltas, balanceDelta{&seller.GoldBasis, tradeGold - taxTotal}, balanceDelta{&sellerFrozen, -fillMilli})
		} else {
			deltas = append(deltas, balanceDelta{&w.NPCHeldBasis, tradeGold - taxTotal})
		}
		if err := applyMarketDeltas(deltas); err != nil {
			return err
		}
		if buyer != nil {
			buyer.ResourcesMilli[incoming.ItemKey] = buyerStock
		}
		if seller != nil {
			seller.FrozenResourcesMilli[incoming.ItemKey] = sellerFrozen
		}

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
		w.PendingTrades = append(w.PendingTrades, trd)
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
	return nil
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
			refundGold, err := marketValue(rem, o.PriceBasis)
			if err != nil {
				return err
			}
			if err := applyMarketDeltas([]balanceDelta{{&p.GoldFrozenBasis, -refundGold}, {&p.GoldBasis, refundGold}}); err != nil {
				return err
			}
		} else {
			if p.FrozenResourcesMilli[o.ItemKey] < rem || !validBalanceDelta(p.ResourcesMilli[o.ItemKey], rem) {
				return ErrPrecondition("invalid_escrow", "订单托管余额异常，撤单未执行")
			}
			p.FrozenResourcesMilli[o.ItemKey] -= rem
			p.ResourcesMilli[o.ItemKey] += rem
		}
		o.RemainingMilli = 0
		o.Status = "CANCELLED"
		AppendLog(p, now, "MARKET", fmt.Sprintf("已撤单【%s %s】，冻结资产已原子退回。", o.ID, ResourceName(o.ItemKey)))
		return nil
	}
	return ErrNotFound("未找到该挂单")
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
