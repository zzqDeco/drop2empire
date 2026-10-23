# 《滴水成城》(Drop to Empire · D2E) 架构与策划文档总纲

本目录采用与 `teamie` 一致的**工程契约先行 + 四维正交游戏策划分层**管理体系。任何代码、Thrift 协议、数值或赛季内容的变更，必须同步更新对应分层的文档。

---

## 1. 策划案四维分层边界定义 (4D Game Design Taxonomy)

为彻底杜绝「把整体愿景、宏观经济、微观数值和当季限定内容混写在一份长文档」导致的维护混乱，所有游戏策划案严格按 **「整体 vs 赛季」×「宏观 vs 微观」** 划分为四个独立模块层：

| 分层目录 | 维度名称 | 作用尺度 | 跨赛季生命周期 | 归属内容范围 | 严禁混入的内容 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **[`design/01-overall/`](design/01-overall/)** | **整体设计**<br>*(Overall Framework)* | 全局顶层 | **跨赛季永恒不变** | 核心设计支柱、零剧透渐进披露铁律、九章史诗叙事脉络、玩家三阶段生命周期 (`Phase 1/2/3`)、四大子系统单向/双向耦合总图 | 具体岗位的每秒产出数值、单件装备属性、单赛季限定外观名录 |
| **[`design/02-macro/`](design/02-macro/)** | **宏观设计**<br>*(Macro Economy & War)* | 全服多玩家 | **跨赛季恒定法则** | 宏观货币存量恒等式 $M(t)$、货币水龙头/水池矩阵、CLOB 限价订单簿撮合算法、四大终身职业宏观分工互锁、双商会 7 日图拓扑领土战与 20:00 权威结算 | 单人打水连击反馈、2D 肉鸽网格单步移动毫秒数、单赛季宝箱掉率 |
| **[`design/03-micro/`](design/03-micro/)** | **微观设计**<br>*(Micro Systems & Mechanics)* | 单人 / 单局 | **核心机制恒定** | 单人聚落八大物资、饮水维持费与断水惩罚、上下游转化公式、仓储上限与 10:1 虹吸冲矿、17 级基建蓝图、政令与游商、**荒原 2D 多区块传送门搜打撤核心机制（实时倒计时、移速频率冷却、五档读条、安全箱保底、一次性蓝图研习/销毁、54 张行前增益卡）**、领主常驻动态形象渲染架构 | 全服货币发行账本、当季绝版外观的具体掉率与指导价 |
| **[`design/04-seasons/`](design/04-seasons/)** | **赛季设计**<br>*(Seasonal Content)* | 单赛季周期 | **每赛季独立更替** | 跨赛季「重置项 vs 永久保留项」严格边界、本赛季蓝图与安全保险箱生命周期、**当季（如 S1「黑曜苏醒」）专属的 12 款限定可交易动态外观表 (`cos_*`)、16 项局外整备军械库与 10 种一次性蓝图 (`bp_*`) 掉率及指导价** | 跨赛季通用的底层撮合引擎或 4 层 Clean DDD 代码规范 |

---

## 2. 完整文档索引 (Documentation Sitemap)

### A. 工程架构与接口契约 (`architecture/` & `contracts/`)
- [`architecture/overview.md`](architecture/overview.md) — 系统运行拓扑、公网玩家端 (`:8443`) 与 SSH 隧道管理台 (`127.0.0.1:18480`) 物理隔离、邀请码准入、权威时钟与货币守恒保证
- [`architecture/ddd-idl.md`](architecture/ddd-idl.md) — 4-Layer Hexagonal Clean DDD 依赖边界、Thrift IDL 代码生成管线 (`./ops/codegen.sh`) 与定点数精度 (`Milli` / `Basis`)
- [`contracts/http-v1.md`](contracts/http-v1.md) — `contracts/game/http_empire.thrift` 全量 HTTP REST 路由契约（鉴权、聚落、荒原肉鸽、衣橱、工坊、市场、战争、内网管理台）

### B. 01 · 整体设计层 (`design/01-overall/`)
- [`design/01-overall/vision-and-pillars.md`](design/01-overall/vision-and-pillars.md) — 核心愿景、四大永恒设计支柱、序章 3-Slot 固定锚点交互与九章史诗叙事脉络
- [`design/01-overall/lifecycle-and-loops.md`](design/01-overall/lifecycle-and-loops.md) — 玩家生命周期三阶段 (`Phase 1/2/3`) 与四大子系统全局耦合拓扑图

### C. 02 · 宏观设计层 (`design/02-macro/`)
- [`design/02-macro/monetary-and-clob-market.md`](design/02-macro/monetary-and-clob-market.md) — 宏观货币存量恒等式 $M(t)$、水龙头与销毁税矩阵、CLOB 价格-时间优先撮合算法
- [`design/02-macro/profession-and-economy-boundary.md`](design/02-macro/profession-and-economy-boundary.md) — 四大终身职业生产力分工、跨职业 4 槽设备架互锁、主城与荒原肉鸽单向经济隔离边界
- [`design/02-macro/chamber-war-macro.md`](design/02-macro/chamber-war-macro.md) — 黑曜 vs 白银双商会 8 节点图拓扑领土战争、补给线校验、三兵种克制矩阵与每日 20:00 权威结算

### D. 03 · 微观设计层 (`design/03-micro/`)
- [`design/03-micro/settlement-production-and-edicts.md`](design/03-micro/settlement-production-and-edicts.md) — 聚落八大物资、伴生副产物、饮水维持费、上下游转化岗位、仓储阶梯与 10:1 虹吸冲矿、17 级蓝图树、4 大政令与游商易物契约
- [`design/03-micro/wasteland-2d-extraction-roguelite.md`](design/03-micro/wasteland-2d-extraction-roguelite.md) — 荒原 2D 多区块传送门搜打撤肉鸽机制、实时沙暴倒计时、移速频率限制、五档宝箱读条、安全保险箱保底、一次性蓝图研习/销毁与 54 种行前增益卡轮抽池
- [`design/03-micro/avatar-and-procedural-relics.md`](design/03-micro/avatar-and-procedural-relics.md) — 领主常驻动态卡通形象 (`LordAvatarSVG` 在 Profile 衣橱与 2D 地图实机棋子的双场景渲染) 与 CS 式唯一编号 UV 蚀刻藏品

### E. 04 · 赛季设计层 (`design/04-seasons/`)
- [`design/04-seasons/season-framework.md`](design/04-seasons/season-framework.md) — 赛季更替通用框架：跨赛季重置项 vs 永久保留项边界、一次性蓝图与安全保险箱当季生命周期、绝版外观流通规则
- [`design/04-seasons/s1-obsidian-awakening.md`](design/04-seasons/s1-obsidian-awakening.md) — **【S1 赛季：黑曜苏醒】专属策划案**：S1 主题、12 款 S1 限定可交易动态外观掉率与指导价表、16 项 S1 局外整备军械与 10 种一次性蓝图完整参数表
