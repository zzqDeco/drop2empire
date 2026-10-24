# 宏观设计 I：货币银行学模型与 CLOB 现货交易市场 (Macro Monetary Ledger & CLOB Market)

> **层级定位**：`02-macro`（宏观设计层 · 全服多玩家经济与金融秩序）  
> **职责边界**：定义全服金币 (`Gold`) 的定点数记账精度、宏观货币存量恒等式 $M(t)$、货币发行（Faucets）与销毁（Sinks）机制、中央限价订单簿 (CLOB) 撮合算法及 NPC 做市商流动性锚定。  
> **代码映射**：[`services/game/internal/domain/engine.go`](../../../services/game/internal/domain/engine.go)、[`services/game/internal/domain/catalog.go`](../../../services/game/internal/domain/catalog.go)

---

## 1. 宏观货币存量恒等式 (Monetary Supply Identity)

全服所有金币以 `1 Basis = 0.0001 Gold`（`1.0000 Gold = 10,000 Basis`）的 64 位整数定点数存储。在任意时刻 $t$，系统强制满足以下**五账本闭环恒等式**：

$$M_{\text{issued}}(t) \equiv M_{\text{player}}(t) + M_{\text{escrow}}(t) + M_{\text{npc}}(t) + M_{\text{treasury}}(t)$$

| 账本科目 | 字段名 (`MacroLedgerDTO`) | 经济学定义 |
| :--- | :--- | :--- |
| **当前流通总发行量** | `totalIssuedBasis` ($M_{\text{issued}}$) | 当前存活于全服各主体账户中的货币总和（已扣除永久销毁税 $M_{\text{burned}}$） |
| **玩家可用总余额** | `playerHeldBasis` ($M_{\text{player}}$) | 全服所有注册玩家当前可自由支配的 `GoldBasis` 之和 |
| **买单托管冻结池** | `escrowFrozenBasis` ($M_{\text{escrow}}$) | 玩家挂出未成交 `BID` 限价买单时锁定的保证金总和 |
| **帝国商会做市商池** | `npcHeldBasis` ($M_{\text{npc}}$) | 官方 NPC 做市商用于提供双边初始流动性的准备金池（初始注入 `200,000.0000 G`） |
| **帝国中央国库** | `treasuryHeldBasis` ($M_{\text{treasury}}$) | 吸收 50% 工坊铸造费与 50% 市场交易税，并在每晚 20:00 商会战争结算时向参战玩家发放战争津贴（初始注入 `20,000.0000 G`） |
| **累计永久销毁量** | `permanentlyBurnedBasis` ($M_{\text{burned}}$) | 因工坊手续费销毁与市场交易税销毁而永久退出流通的通缩计数器 |

---

## 2. 货币水龙头与水池矩阵 (Faucets & Sinks Matrix)

| 行为事件 | 账本流向公式 | 宏观调控目的 |
| :--- | :--- | :--- |
| **开启【神秘的宝藏】** | 新铸造 `+500.0000 G` $\rightarrow$ 注入玩家账户 ($M_{\text{issued}} \uparrow, M_{\text{player}} \uparrow$) | 为每位突破 Phase 1 的新领主注入首笔贸易启动资本 |
| **工坊制造专属工具/军备** | 玩家支付 `2.0000 G` 手续费 $\rightarrow$ **`1.0000 G` 永久销毁** ($M_{\text{issued}} \downarrow, M_{\text{burned}} \uparrow$) + **`1.0000 G` 注入中央国库** ($M_{\text{treasury}} \uparrow$) | 抑制工业品无限制造，同时为每晚战争国库充能 |
| **现货市场挂买单 (`BID`)** | 玩家可用金币 $-\text{Price} \times \text{Qty}$ $\rightarrow$ 转入托管冻结池 ($M_{\text{player}} \downarrow, M_{\text{escrow}} \uparrow$，$M_{\text{issued}}$ 不变) | 100% 准备金制度，杜绝穿仓与空头支票 |
| **现货市场撮合成交** | 卖方总成交额 $V = P_{\text{exec}} \times Q$，扣除 **`1.00%` 印花税** $T = \lfloor V \times 0.01 \rfloor$：<br>- 卖方实收 $V - T$<br>- **销毁税 $T_{\text{burn}} = \lfloor T / 2 \rfloor$ (`0.50%`) 永久销毁**<br>- **国库税 $T_{\text{treasury}} = T - T_{\text{burn}}$ (`0.50%`) 注入国库** | 高频贸易自动抽水通缩，并将另一半税收通过每晚战争回流给活跃参战者 |
| **每日 20:00 商会战争结算** | 从中央国库 $M_{\text{treasury}}$ 中，向参战玩家发放金币 ($M_{\text{player}} \uparrow$) | 将和平时期的贸易税收转化为阵营战争的经济激励 |

---

## 3. 中央限价订单簿 (CLOB) 撮合算法

现货市场支持 **五类可交易标的**：
1. **大宗基础与中阶物资** (`water`, `wood`, `charcoal`, `stone`, `flint`, `ancient_shard`, `iron_ingot`, `ration`)
2. **四大职业专属工业设备** (`auto_pump`, `hermes_catalyst`, `astral_scroll`, `titan_tools`)
3. **三军标准军备** (`infantry_gear`, `archer_gear`, `cavalry_gear`)
4. **荒原掉落的一次性高阶装备/安全箱蓝图** (`bp_*`，未研习前可自由买卖)
5. **荒原掉落的当季限定动态外观** (`cos_*`，可自由买卖或穿戴)

### 价格-时间优先 (Price-Time Priority) 原子撮合规则
1. **资产前置冻结**：
   - 挂 `BID`（买单）：立即从 `player.GoldBasis` 冻结 $P_{\text{bid}} \times Q$ 至 `player.GoldFrozenBasis`。
   - 挂 `ASK`（卖单）：立即从 `player.ResourcesMilli` 或 `player.InventoryItems` 冻结对应数量至 `Frozen`。
2. **对手盘扫描与成交价决定**：
   - 新买单 (`BID`) 按**卖方报价从低到高 (`Price ASC`)、单调数字订单序号从小到大（`ord_99` 先于 `ord_100`）** 扫描所有存活 `ASK` 单（只要 $P_{\text{bid}} \ge P_{\text{ask}}$）。
   - 新卖单 (`ASK`) 按**买方报价从高到低 (`Price DESC`)、单调数字订单序号从小到大（`ord_99` 先于 `ord_100`）** 扫描所有存活 `BID` 单（只要 $P_{\text{bid}} \ge P_{\text{ask}}$）。
   - **成交执行价 $P_{\text{exec}}$** 恒取对手盘（Maker）挂单价；若买方限价高于实际成交价 $P_{\text{exec}}$，差额 $(P_{\text{bid}} - P_{\text{exec}}) \times Q_{\text{matched}}$ **当场退还买方可用余额**。
   - **禁止自成交 (Self-Trade Prevention)**：同一玩家的 `BID` 与 `ASK` 单互不撮合。


### 记账范围与失败原子性

订单数量为整资源单位：`quantityMilli >= 1000`、`quantityMilli % 1000 == 0`，上限 `1,000,000,000,000 milli`。单价范围仍为 `100..100,000,000 basis`。金额先以数量除以 `1000`，再检查乘法范围，最后乘单价；市场资产字段及订单总额上限为 `2^53-1`，保持 HTTP 数字对 JavaScript 客户端可精确表示。

每笔成交与撤单在修改前校验可用余额、托管余额、库存及国库变化，均不得为负或超范围。异常托管余额拒绝交易，不归零掩盖差额；NPC 买单也不得透支。总量恒等式与分账户非负约束同时成立。每笔撮合都在同一 PostgreSQL 事务写入审计，包括单次撮合超过 UI 最近 60 笔窗口的记录；审计失败则资产变更全部回滚。
