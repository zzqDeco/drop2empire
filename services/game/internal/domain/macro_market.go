package domain

import (
	"fmt"
	"sort"
	"time"
)

var ResourceCatalog = []ResourceMeta{
	{Key: ResWater, Name: "水", Tier: "basic", Description: "居民维持与动力水源", Tradable: true, InitPriceBasis: 1000},
	{Key: ResWood, Name: "木材", Tier: "basic", Description: "建筑与烧炭原木", Tradable: true, InitPriceBasis: 4500},
	{Key: ResCharcoal, Name: "木炭", Tier: "basic", Description: "炭窑烧制 · 冶金与夜班燃料", Tradable: true, InitPriceBasis: 12000},
	{Key: ResStone, Name: "石材", Tier: "basic", Description: "工程与冶炼矿石", Tradable: true, InitPriceBasis: 9500},
	{Key: ResFlint, Name: "燧石结晶", Tier: "relic", Description: "采集伴生晶矿 · 用于机关与游商易物", Tradable: true, InitPriceBasis: 28000},
	{Key: ResAncientShard, Name: "古文明残片", Tier: "relic", Description: "远征与深层采掘所得 · 远古遗物核心", Tradable: true, InitPriceBasis: 65000},
	{Key: ResMeteorOre, Name: "星陨秘银", Tier: "relic", Description: "荒原秘境搜出 · 高阶军械与黑市硬通货", Tradable: true, InitPriceBasis: 145000},
	{Key: ResIronIngot, Name: "铁锭", Tier: "intermediate", Description: "高炉吞吐石材与木炭精炼", Tradable: true, InitPriceBasis: 32000},
	{Key: ResRation, Name: "军粮", Tier: "intermediate", Description: "消耗净水与木材封装", Tradable: true, InitPriceBasis: 24000},
	{Key: ResAutoPump, Name: "自动抽水机", Tier: "profession", Description: "科学家制品 · 打水/伐木 +15%", Tradable: true, InitPriceBasis: 185000},
	{Key: ResAlchCatalyst, Name: "赫尔墨斯催化剂", Tier: "profession", Description: "炼金制品 · 全岗位 +12%", Tradable: true, InitPriceBasis: 195000},
	{Key: ResEnchantScroll, Name: "星界附魔卷轴", Tier: "profession", Description: "魔法师制品 · 采石/军粮 +15%", Tradable: true, InitPriceBasis: 200000},
	{Key: ResHeavyToolset, Name: "泰坦精锻工具组", Tier: "profession", Description: "工匠制品 · 伐木/炼铁 +15%", Tradable: true, InitPriceBasis: 190000},
	{Key: ResInfantryKit, Name: "重步兵军备", Tier: "war", Description: "步兵编制 · 克弓兵", Tradable: true, InitPriceBasis: 98000},
	{Key: ResArcherKit, Name: "长弓兵军备", Tier: "war", Description: "弓兵编制 · 克骑兵", Tradable: true, InitPriceBasis: 102000},
	{Key: ResCavalryKit, Name: "铁骑兵军备", Tier: "war", Description: "骑兵编制 · 克步兵", Tradable: true, InitPriceBasis: 112000},
	{Key: ResSeasonChest, Name: "S1·墨械宝箱", Tier: "season", Description: "开启获得随机纹理藏品", Tradable: true, InitPriceBasis: 450000},

	// Tradable Single-Use Raid Blueprints (consumed on learn to unlock season crafting, or traded on Market)
	{Key: ResBPCrossbow, Name: "★图纸：墨械连发手弩", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季 T2 武器打造（可交易）", Tradable: true, InitPriceBasis: 220000},
	{Key: ResBPTitanHammer, Name: "★★图纸：泰坦裂地重锤", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季 T3 武器打造（可交易）", Tradable: true, InitPriceBasis: 580000},
	{Key: ResBPCarapaceArmor, Name: "★图纸：沙虫壳胸甲", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季 T2 护甲打造（可交易）", Tradable: true, InitPriceBasis: 210000},
	{Key: ResBPHydroArmor, Name: "★★图纸：水压动力重甲", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季 T3 护甲打造（可交易）", Tradable: true, InitPriceBasis: 620000},
	{Key: ResBPSpringBoots, Name: "★图纸：墨械弹簧战靴", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季 T2 战靴打造（可交易）", Tradable: true, InitPriceBasis: 240000},
	{Key: ResBPHermesBoots, Name: "★★图纸：赫尔墨斯风行靴", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季 T3 极速靴打造（可交易）", Tradable: true, InitPriceBasis: 680000},
	{Key: ResBPCipherSafe, Name: "★图纸：墨械密码保险箱", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季 3 格安全箱打造（可交易）", Tradable: true, InitPriceBasis: 360000},
	{Key: ResBPAetherSafe, Name: "★★图纸：泰坦次元保险箱", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季 5 格安全箱打造（可交易）", Tradable: true, InitPriceBasis: 950000},
	{Key: ResBPScavengeElixir, Name: "★图纸：速搜合剂配方", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季速搜药水调配（可交易）", Tradable: true, InitPriceBasis: 190000},
	{Key: ResBPBerserkElixir, Name: "★★图纸：狂暴圣水配方", Tier: "blueprint", Description: "一次性蓝图 · 研读解锁本赛季免死圣水调配（可交易）", Tradable: true, InitPriceBasis: 520000},

	// Tradable Season-Limited Animated Avatar Cosmetics
	{Key: ResCosGoggles, Name: "荒原防风护目镜", Tier: "cosmetic", Description: "罕见头饰 · 领主与地图形象可穿戴（可交易）", Tradable: true, InitPriceBasis: 320000},
	{Key: ResCosSteamCrown, Name: "墨械蒸汽齿轮冠", Tier: "cosmetic", Description: "史诗头饰 · 动态旋转黄铜齿轮（可交易）", Tradable: true, InitPriceBasis: 880000},
	{Key: ResCosObsidianCrown, Name: "★S1·曜石星辉王冠", Tier: "cosmetic", Description: "S1传说限定头饰 · 悬浮黑曜星环特效（可交易）", Tradable: true, InitPriceBasis: 2800000},
	{Key: ResCosSandCloak, Name: "沙行旅人斗篷", Tier: "cosmetic", Description: "罕见背饰 · 荒原防风披风（可交易）", Tradable: true, InitPriceBasis: 310000},
	{Key: ResCosHydroWings, Name: "阿基米德水翼背甲", Tier: "cosmetic", Description: "史诗背饰 · 水压喷流羽翼（可交易）", Tradable: true, InitPriceBasis: 920000},
	{Key: ResCosAstralWings, Name: "★S1·星界流光羽翼", Tier: "cosmetic", Description: "S1传说限定背饰 · 双翼动态扇动与星轨（可交易）", Tradable: true, InitPriceBasis: 3200000},
	{Key: ResCosCompass, Name: "寻脉青铜罗盘", Tier: "cosmetic", Description: "罕见手持 · 磁针摆动罗盘（可交易）", Tradable: true, InitPriceBasis: 300000},
	{Key: ResCosAlchLantern, Name: "赫尔墨斯荧光提灯", Tier: "cosmetic", Description: "史诗手持 · 翠绿炼金火苗跳动（可交易）", Tradable: true, InitPriceBasis: 860000},
	{Key: ResCosThunderStaff, Name: "★S1·泰坦雷鸣权杖", Tier: "cosmetic", Description: "S1传说限定手持 · 脉冲电弧核心（可交易）", Tradable: true, InitPriceBasis: 2950000},
	{Key: ResCosWoodFrog, Name: "汲水发条木蛙", Tier: "cosmetic", Description: "罕见随从 · 蹦跳机巧木蛙（可交易）", Tradable: true, InitPriceBasis: 350000},
	{Key: ResCosMechOwl, Name: "炼金机械猫头鹰", Tier: "cosmetic", Description: "史诗随从 · 振翅盘旋夜视枭（可交易）", Tradable: true, InitPriceBasis: 960000},
	{Key: ResCosAetherDrake, Name: "★S1·星界以太幼龙", Tier: "cosmetic", Description: "S1传说限定随从 · 环绕飞行吐泡幼龙（可交易）", Tradable: true, InitPriceBasis: 3500000},
}

func ResourceName(key string) string {
	for _, r := range ResourceCatalog {
		if r.Key == key {
			return r.Name
		}
	}
	return key
}

// SeedNPCMarket populates realistic limit orders from the 4 profession guilds, quartermaster, and wasteland collectors.
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
		// Single-use Raid Blueprints & S1 Cosmetics liquidity orders
		{ResBPCrossbow, "BID", 200000, 2 * ResourceScale, "斥候统领·雷恩"},
		{ResBPCrossbow, "ASK", 240000, 2 * ResourceScale, "荒原黑市商团"},
		{ResBPSpringBoots, "BID", 220000, 2 * ResourceScale, "斥候统领·雷恩"},
		{ResBPSpringBoots, "ASK", 260000, 2 * ResourceScale, "荒原黑市商团"},
		{ResBPCipherSafe, "BID", 330000, 2 * ResourceScale, "收藏家·维克"},
		{ResBPCipherSafe, "ASK", 390000, 1 * ResourceScale, "荒原黑市商团"},
		{ResCosGoggles, "BID", 290000, 2 * ResourceScale, "收藏家·维克"},
		{ResCosGoggles, "ASK", 350000, 1 * ResourceScale, "荒原黑市商团"},
		{ResCosObsidianCrown, "BID", 2600000, 1 * ResourceScale, "收藏家·维克"},
		{ResCosAstralWings, "BID", 3000000, 1 * ResourceScale, "收藏家·维克"},
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
		return ErrPrecondition("market_locked", "完成【神秘的宝藏】并选定职业后解锁全球现货交易所")
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
		taxBurn := taxTotal / 2
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
