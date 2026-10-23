# 滴水成城 · Drop to Empire (D2E)

> **从手动打出第一滴水，到管理人口与生产、选择专属职业、参与全球玩家现货市场，最终投入每晚 20:00 结算的商会城池战争，争夺唯一序列号与随机 UV 采样的程序化赛季藏品。**

本项目为《滴水成城》（[`docs/gdd-v1.md`](docs/gdd-v1.md)）V1.0 全栈 Web 实现，采用与 `teamie` 一致的契约先行（Thrift IDL 代码生成）、Go Hertz + PostgreSQL 4 层六边形 Clean DDD 架构，以及 **Blueprint & Ink（纸墨工程制图风 + 严格等宽数字 + Token 自动化门禁）** 前端体系。

---

## 核心特性（覆盖 GDD M1 + M2 + M3 全闭环）

1. **M1 · 第一阶段：0–30 分钟文明起点与宝藏三部件**
   - **信息渐进披露**：第 0 秒仅展示「手动打水」与水源读数；累计 10 滴水开放居民招募（首位居民自动上岗打水 `+2.00/s`）；随人口解锁「斧头蓝图」「木制引水轮」「采石技术」「石刃联动锯台」「基础工坊」。
   - **消除第 9–30 分钟挂机空窗期**：在工坊至「神秘的宝藏」之间引入「导水阀芯」「承压木框」「铭文石板」三件套制造目标，每 3–5 分钟提供一次显著的产能倍率正反馈。
   - **内置 30 分钟数值模拟器**：一键对比 GDD 4.4 原始基准策略（`29:51`）与 V1 三部件均衡策略、激进动态调仓策略的各节点达成时间。
2. **M2 · 第二阶段：四职业终身抉择、跨职业设备槽与全球现货交易所**
   - **四职业分工**：**科学家**（自动抽水机）、**炼金术士**（赫尔墨斯催化剂）、**魔法师**（星界附魔卷轴）、**工匠**（泰坦精锻工具组）。
   - **跨职业工坊插槽**：玩家无法直接制造其他职业的独占制品，但可在交易所向对应职业采购并加装至自身工坊插槽以叠加单人效率。
   - **现货限价订单簿与宏观货币恒等式**：支持 `BID / ASK` 限价挂单、资产冻结与撤单、价格-时间优先原子撮合、`1.00%` 交易税（`0.50%` 永久销毁 + `0.50%` 归入中央公共财政），实时校验 `M_已发行 = M_玩家持有 + M_订单冻结 + M_做市储备 + M_公共财政`。
3. **M3 · 第三阶段：七日商会图结构战争与 CS 式程序化外观收藏品**
   - **图结构补给线与三兵种克制**：8 节点 10 边拓扑地图（曜石大本营 ↔ 西境前哨 ↔ 北侧据点 / 南侧渡口 ↔ 中央宝藏城 ★ ↔ 东境前哨 ↔ 白银大本营），严格校验补给线连通性、每日个人 100 点军备预算上限、城池统一 `+25%` 防御加成、步/弓/骑加权克制矩阵（`1.15x / 1.00x / 0.90x`）与胜方 `20%` / 败方 `40%` 军备战损。
   - **程序化赛季藏品**：使用战争获得的活动点数兑换「S1·墨械典藏宝箱」，开箱按 `pattern_seed`、`uv_offset_x/y`、`uv_scale`、`uv_rotation`、`palette_id` 与稀有度（60/28/10/2%）铸造具有全球唯一 `item_id` 的工程蚀刻风格藏品。

---

## 仓库结构

| 路径 | 说明 |
| :--- | :--- |
| [`contracts/`](contracts) | 统一 Thrift IDL (`contracts/game/http_empire.thrift`) 与自动生成的 Go 契约模块 (`contracts/gen/game`) |
| [`pkg/`](pkg) | 共享 Go 基础技术机制 (`postgres`, `httpx`, `observability`) |
| [`services/game/`](services/game) | 4 层 Clean DDD 游戏权威服务 (`cmd/`, `internal/{domain,app,adapter,infra}` + `arch_test.go`) |
| [`packages/api-client/`](packages/api-client) | Thrift 自动生成的 TypeScript SDK 与 `EmpireClient` |
| [`apps/web/`](apps/web) | React 19 / TypeScript / Vite 单屏 Dashboard 应用（含 `tokens.css` 与 `design-tokens.test.ts`） |
| [`tools/`](tools) | 确定性 Thrift-to-Go HTTP 路由生成器与 Thrift-to-TS SDK 生成器 |
| [`ops/`](ops) | 代码生成 (`codegen.sh`) 与 Clean DDD 架构门禁 (`check-architecture.sh`) |

---

## 快速启动与验证

```sh
# 1. 架构门禁与全量测试（Go 后端 + PostgreSQL + 前端 Lint/Vitest/Build）
make check-arch
make test

# 2. 启动后端权威服务（默认监听 127.0.0.1:8080，自动连接本地 PostgreSQL drop2empire 库）
make dev-backend

# 3. 启动前端开发服务器（默认监听 http://localhost:5180）
make dev-web
```
