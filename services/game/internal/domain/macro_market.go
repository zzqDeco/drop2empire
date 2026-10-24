package domain

import (
	"fmt"
	"sort"
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
		totalGold := (st.QuantityMilli * st.PriceBasis) / ResourceScale
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
	if quantityMilli < MacroBalance.MinOrderQtyMilli || quantityMilli%ResourceScale != 0 {
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

	MatchOrder(w, p, &newOrd, now)
	w.Orders = append([]MarketOrder{newOrd}, w.Orders...)
	return nil
}

func MatchOrder(w *WorldState, taker *PlayerState, incoming *MarketOrder, now time.Time) {
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
		taxBurn := (taxTotal * MarketBurnShareBps) / MarketTaxBps
		taxTreasury := taxTotal - taxBurn

		var buyerHandle, sellerHandle string
		if incoming.Side == "BID" {
			buyerHandle = incoming.MakerHandle
			sellerHandle = resting.MakerHandle

			lockedForFill := (fillMilli * incoming.PriceBasis) / ResourceScale
			refund := lockedForFill - tradeGold
			taker.GoldFrozenBasis -= lockedForFill
			if refund > 0 {
				taker.GoldBasis += refund
			}
			taker.ResourcesMilli[incoming.ItemKey] += fillMilli

			if resting.IsNPC {
				w.NPCHeldBasis += (tradeGold - taxTotal)
			} else if seller, ok := w.Players[resting.MakerHandle]; ok {
				seller.FrozenResourcesMilli[incoming.ItemKey] -= fillMilli
				seller.GoldBasis += (tradeGold - taxTotal)
			}
		} else {
			sellerHandle = incoming.MakerHandle
			buyerHandle = resting.MakerHandle

			taker.FrozenResourcesMilli[incoming.ItemKey] -= fillMilli
			taker.GoldBasis += (tradeGold - taxTotal)

			if resting.IsNPC {
				w.NPCHeldBasis -= tradeGold
			} else if buyer, ok := w.Players[resting.MakerHandle]; ok {
				buyer.GoldFrozenBasis -= tradeGold
				buyer.ResourcesMilli[incoming.ItemKey] += fillMilli
			}
		}

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
