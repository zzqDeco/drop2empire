# 宏观设计 III：双商会 7 日图结构领土战争 (Macro Chamber Territory War)

> **层级定位**：`02-macro`（宏观设计层 · 公会协同组织、全服阵营对抗与终局资源/公司产物消耗）  
> **职责边界**：定义黑曜商会 (`OBSIDIAN`) 与白银同盟 (`ARGENT`) 麾下的玩家公会系统 (`GuildState`)、公会后勤/军费/企业作业包捐献、集结令战术标定、8 节点 11 边完全镜像对称战略图拓扑、补给线连通性校验、三兵种加权克制矩阵与每日 20:00 权威战争结算。  
> **代码映射**：[`services/game/internal/domain/macro_war.go`](../../../services/game/internal/domain/macro_war.go)、[`services/game/internal/domain/balance_macro.go`](../../../services/game/internal/domain/balance_macro.go)、[`apps/web/src/features/macro/WarGuildSceneView.tsx`](../../../apps/web/src/features/macro/WarGuildSceneView.tsx)、[`apps/web/src/WarGraphMapSVG.tsx`](../../../apps/web/src/WarGraphMapSVG.tsx)

---

## 0. 公会大厅与集结协同体系 (`GuildState` & `PerformGuildAction`)

战区城池争夺以**公会 (`Guild`)** 为基本作战建制。领主完成圣坛择业后，须在【公会与战区】场景中加入现有公会或创立新公会，方可代表所属商会向战区派兵。生产环境 (`NewEmptyWorld`) 四大常驻初始公会均从 `Lv.1 (0 XP)`、**零虚构成员**起步，首位加入某常驻公会的真实领主自动就任会长：

| 公会机制 | 规则与数值说明 |
| :--- | :--- |
| **四大常驻初始公会** | 黑曜商会麾下：**`[INK] 墨械先驱团`**（初始集结 `北侧据点`）、**`[IRON] 黑曜铁卫公会`**（初始集结 `南侧渡口`）；白银同盟麾下：**`[ASTR] 白银星界议会`**（初始集结 `东侧据点`）、**`[ALCH] 赫尔墨斯炼金会`**（初始集结 `南侧渡口`）。 |
| **创立新公会 (`create`)** | 消耗驻地建材（`清水 100 + 木材 60 + 石料 30`，可用工匠 `工事包` 减免 `8%`），自定义 `2~16` 字公会名、`2~4` 位徽标简称 (`Tag`) 与效忠商会 (`OBSIDIAN` / `ARGENT`)，初始 `Lv.1 (120 XP)`、个人贡献 `+100`。 |
| **后勤物资捐献 (`donate_supplies`)** | 消耗 `清水 80 + 木材 50 + 石料 25`（可用 `工事包` 减免 `8%`）$\rightarrow$ 公会经验 `+120 XP`、个人公会贡献 `+100`、活动积分 `+15`。 |
| **金库军费捐献 (`donate_gold`)** | 消耗 `50.0000 Gold`（等额划入中央财政国库 $M_{\text{treasury}}$，严格保持宏观货币恒等式守恒）$\rightarrow$ 公会经验 `+200 XP`、个人公会贡献 `+180`、活动积分 `+25`。 |
| **企业作业包高阶后勤 (`donate_heavy_pack` / `donate_precision_pack`)** | 消耗公司终端产物 `重载作业包 ×1` 或 `精密作业包 ×1` $\rightarrow$ 公会经验 **`+260 XP`**、个人公会贡献 **`+240`**、活动积分 **`+35`**（较同等约 `50 G` 现金捐献溢价约 `+30%`，形成六家公司终端产品的持续消耗池）。 |
| **公会升级与战旗加成 (`Lv.1 ~ Lv.10`)** | 升级经验阈值 `500 × Lv` XP。当公会集结目标指向节点 $n$ 且至少有 1 名公会成员在 $n$ 部署兵力时，激活该阵营在 $n$ 的**公会集结战旗**：攻防结算战力 **`+(10 + 3 × Lv)%`**（同节点多公会集结取该阵营已参战公会的最高战旗等级，不无限叠加）；此外，每日 20:00 战区结算时，参战成员额外获得 **`+(5 × Lv)` 活动积分**。 |
| **公会集结令 (`set_rally`)** | 标定 8 节点沙盘上的优先攻坚城池（`rallyNodeId`）。公会成员向集结目标城池派兵时，立即额外获得 **`+5` 活动积分**。 |

---

## 1. 8 节点 11 边完全镜像战略图拓扑 (`DefaultWarNodes` & `DefaultWarEdges`)

战争沙盘由 **8 座战略城池节点**与 **11 条双向补给通道**构成，关于东西中轴（`南侧渡口 — 中央宝藏城`）严格左右镜像对称：

```mermaid
flowchart LR
  WB["曜石大本营 (15pt)"] --- WO["西境前哨 (20pt)"]
  WO --- NF["北侧据点 (30pt)"]
  WO --- SF["南侧渡口 (30pt)"]
  NF --- SF
  NF --- CV["★ 中央宝藏城 (60pt)"]
  SF --- CV
  SF --- EF["东侧据点 (30pt)"]
  CV --- EF
  SF --- EO["东境前哨 (20pt)"]
  EF --- EO
  EO --- EB["白银大本营 (15pt)"]
```

| 节点 ID (`nodeId`) | 节点名称 | 每日分值 (`dailyScore`) | 初始归属 | 基础城防 (`defenseBonusPct`) | 初始驻军 (`步/弓/骑`) | 每日 NPC 先锋增援 | 相邻连通节点 (`neighbors`) |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| `node_west_base` | **曜石大本营** | `15` | `OBSIDIAN` | `+25%` | 黑曜 `18/14/12` | — | `node_west_outpost` |
| `node_west_outpost` | **西境前哨** | `20` | `OBSIDIAN` | `+25%` | 黑曜 `12/10/8` | — | `node_west_base`, `node_north_fort`, `node_south_ferry` |
| `node_north_fort` | **北侧据点** | `30` | `NEUTRAL` | `+25%` | 中立 `6/6/6` | 黑曜 `2/0/2` | `node_west_outpost`, `node_south_ferry`, `node_center_vault` |
| `node_south_ferry` | **南侧渡口** | `30` | `NEUTRAL` | `+25%` | 中立 `6/8/6` | 黑曜 `2/2/0` · 白银 `2/2/0` | `node_west_outpost`, `node_north_fort`, `node_center_vault`, `node_east_fort`, `node_east_outpost` |
| `node_center_vault` | **中央宝藏城 ★** | `60` | `NEUTRAL` | `+25%` | 中立 `14/14/14` | 黑曜 `3/3/3` · 白银 `3/3/3` | `node_north_fort`, `node_south_ferry`, `node_east_fort` |
| `node_east_fort` | **东侧据点** | `30` | `NEUTRAL` | `+25%` | 中立 `6/6/6` | 白银 `2/0/2` | `node_center_vault`, `node_south_ferry`, `node_east_outpost` |
| `node_east_outpost` | **东境前哨** | `20` | `ARGENT` | `+25%` | 白银 `12/10/8` | — | `node_south_ferry`, `node_east_fort`, `node_east_base` |
| `node_east_base` | **白银大本营** | `15` | `ARGENT` | `+25%` | 白银 `18/14/12` | — | `node_east_outpost` |

### 补给线连通性铁律 (`SupplyConnectedNodes` & `DeployableNodes`)
玩家仅可向满足以下任一条件的城池派兵：
1. 从本方大本营（`node_west_base` 或 `node_east_base`）经由本方已占领节点连通的城池（驻防）；
2. 与上述已连通补给网络直接相邻 `1` 条边的敌方或中立城池（前线攻坚）。

---

## 2. 每日军备预算、三兵种克制与战术/企业作业包支援

### 2.1 零金币军备制造与每日派兵预算 (`100 Pts/Day`)
三类基础军备箱（`craft_infantry_kit`、`craft_archer_kit`、`craft_cavalry_kit`）均采用**纯实物零金币配方 (`GoldCostBasis = 0`)**，保证新服零金币阶段即可顺畅开启商会战争（工匠被动享 `+25%` 军备产出加成）。每位领主每个战争日拥有 **100 点行军预算 (`DailyWarBudgetCap = 100`)**：

| 兵种 | 消耗军备道具 | 单团预算占用 | 单团基础战力 (`BasePowerMilli`) | 克制关系 |
| :--- | :--- | :---: | :---: | :--- |
| **步兵团 (`Infantry`)** | `1 × 重步兵军备 (infantry_kit)` | `1 点` | `1,000` (`1.000`) | 克制弓兵 (`1.15x`)，被骑兵克制 (`0.90x`) |
| **弓兵团 (`Archer`)** | `1 × 长弓兵军备 (archer_kit)` | `1 点` | `1,000` (`1.000`) | 克制骑兵 (`1.15x`)，被步兵克制 (`0.90x`) |
| **骑兵团 (`Cavalry`)** | `1 × 铁骑兵军备 (cavalry_kit)` | `1 点` | `1,000` (`1.000`) | 克制步兵 (`1.15x`)，被弓兵克制 (`0.90x`) |

### 2.2 据点战术耗材与企业作业包工程支援 (`UseConsumable`)
已在某节点部署至少 `1` 团兵力的公会成员，每轮可代表本方阵营向该节点投送以下战术/工程支援（按 `节点 + 阵营 + 物品` 每轮各限激活 1 次，20:00 结算后清除）：
- **火控校准包 (`fire_control_pack`)**：本轮己方不利克制系数向 `1.00` 减半修正（`0.90 -> 0.95`）。
- **战地救护包 (`field_medkit`)**：本轮己方战损率 `-5` 个百分点（最低 `0%`）。
- **守城结界 (`defense_ward`)**：仅限当前己方占领城池使用，本轮城防加成 `+8` 个百分点。
- **重载作业包 (`heavy_workpack` · 公司终端产物)**：构筑重装攻坚工事，本轮己方在该节点的有效攻防战力 **`+12%`**，并立即奖励投送者公会经验 `+40 XP`、个人贡献 `+35`、活动积分 `+12`。
- **精密作业包 (`precision_workpack` · 公司终端产物)**：建立精密后勤调度，本轮己方全兵种克制系数 **`+0.05` (`+500 bps`)** 且战损率 **`-5` 个百分点**（可与救护包叠加），同时奖励公会经验 `+40 XP`、个人贡献 `+35`、活动积分 `+12`。

### 2.3 城池战力修正公式
设一方在某城池投入的步、弓、骑数量分别为 $S_I, S_A, S_C$，对手三兵种占比为 $w'_I, w'_A, w'_C$：
1. **克制与城防基础战力** $P_{\text{base}}$：按克制矩阵（叠加 `fire_control_pack` 与 `precision_workpack` 修正）加权后，守方乘以 $(100 + \text{DefenseBonusPct})\%$。
2. **公会战旗与重载工事乘数**：
   $$P_{\text{effective}} = \left\lfloor \left\lfloor P_{\text{base}} \times \frac{100 + R_{\text{rally}}}{100} \right\rfloor \times \frac{100 + B_{\text{heavy}}}{100} \right\rfloor$$
   其中 $R_{\text{rally}} = 10 + 3 \cdot \text{Lv}_{\max}$（当存在本方公会集结该节点且有成员驻军时），$B_{\text{heavy}} \in \{0, 12\}$。

---

## 3. 每日 20:00 权威结算、公平平局与按比例军饷分配 (`SettleWarDay`)

每日 20:00 Asia/Shanghai（12:00 UTC）形成唯一结算周期。截止后的首个普通状态/业务事务或管理员触发在同一事务内完成到期结算；管理员不能提前结算或重复发奖。系统对所有城池执行原子结算：
1. **城池易手与中立平局判定**：
   - 已归属一方的城池：进攻方有效战力严格大于守军有效战力（$P_{\text{atk}} > P_{\text{def}}$）方可夺城；相等时守方依托城防守住节点。
   - 中立城池（`NEUTRAL`）：仅当某一方有效进攻战力**严格高于另一方且严格大于中立守军有效战力**时夺取城池；若黑曜与白银进攻战力完全持平（$P_{\text{obs}} = P_{\text{arg}}$），双方陷入拉锯，节点保持 `NEUTRAL` 中立归属（消除阵营先后偏置）。
2. **军备硬性战损（核心工业消耗池）**：
   - **胜方驻军**：基础损毁 **`20%`**（可被 `field_medkit` 与 `precision_workpack` 分别降低 `5` 个百分点）。
   - **败方驻军**：基础损毁 **`40%`**（同上可减免）。
3. **活动点数与国库按比例军饷分配（消除字母序饥饿）**：
   - 仅本期实际投入军备、已选职业且属于有效公会的领主获得结算奖励：
     - **活动点数**：当日战略分高者获胜方基础分 `75`、低者获败方基础分 `45`、**当日双方战略分持平 (`obsDelta == argDelta`) 时双方同获平局基础分 `60`**；另加个人投入分 `3 × 投入军备数` 与所属公会战旗分 `5 × 公会等级`。
     - **财政军饷 (`Stipend`)**：名义应发军饷为 $W_i = (80 + 4 \times \text{Deployed}_i) \text{ Gold}$，**仅从财政国库 $M_{\text{treasury}}$ 存量拨付，绝不新铸币**。当国库余额 $T \ge \sum W_i$ 时全额发放；当 $0 < T < \sum W_i$ 时，采用 `math/big` 精确整数按比例分配 $\text{Paid}_i = \lfloor T \times W_i / \sum W \rfloor$（Basis 精度），彻底消除按账号字母序先到先得导致的后排领主零军饷饥饿问题，余下不足 1 人的极小整数尾差留在国库中，严格保证货币供应恒等式守恒。
   - 每 7 个战争日构成一个完整战役周 (`D1 ~ D7`)，累计战略总分高者加冕当周霸主商会。

`LastWarPeriod` 持久记录已结算周期，重复调用不改变战损、奖励或 D 日序号。长期无请求时仅结算最近到期周期，不批量补发无人参与的历史津贴。升级旧存档首次建立当前周期基线，不追发缺乏证据的历史奖励。结算后清空本期部署记录、节点临时支援与个人预算；已出兵的玩家在本期结束前不能更换公会或阵营。
