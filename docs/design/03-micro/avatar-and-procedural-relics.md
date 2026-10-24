# 微观设计 III：领主纸墨蚀刻动态立绘与程序化藏品 (Blueprint & Ink Animated Lord Avatar & Procedural Relics)

> **层级定位**：`03-micro`（微观设计层 · 纸墨工程制图角色动态渲染架构与程序化藏品生成算法）  
> **职责边界**：定义领主个人纸墨蚀刻动态形象 (`LordAvatarSVG`) 的八层工程制图 SVG 动画系统、三场景投射（顶栏迷你徽章、领主衣橱工程图版、2D 搜打撤肉鸽地图实机棋子），以及战争活动点数铸造的 CS 式唯一编号 UV 蚀刻藏品 (`ProceduralRelicSVG`)。  
> **代码映射**：[`apps/web/src/LordAvatarSVG.tsx`](../../../apps/web/src/LordAvatarSVG.tsx)、[`apps/web/src/WastelandRaidPanel.tsx`](../../../apps/web/src/WastelandRaidPanel.tsx)、[`apps/web/src/ProceduralRelicSVG.tsx`](../../../apps/web/src/ProceduralRelicSVG.tsx)

---

## 1. 领主纸墨工程蚀刻动态立绘架构 (`LordAvatarSVG`)

为确保角色形象与全站 **Blueprint & Ink（纸墨工程制图 / 钢笔排线蚀刻风）** 视觉体系（[`apps/web/src/tokens.css`](../../../apps/web/src/tokens.css) 与 [`apps/web/src/ProceduralRelicSVG.tsx`](../../../apps/web/src/ProceduralRelicSVG.tsx)）严丝合缝，系统摒弃传统高饱和扁平卡通色块，采用**达芬奇手稿 / 墨械自动机（Clockwork Automaton）钢笔蚀刻立绘风格**：

- **自适应主题色板（CSS Tokens 驱动）**：直接绑定 `var(--text-strong)`（焦墨主线）、`var(--surface)` / `var(--surface-sunken)`（宣纸与沉降底纸）、`var(--seal-accent)`（朱砂印泥点缀）、`var(--warning-text)`（鎏金黄铜齿轮）与 `var(--success-text)`（氧化铜绿液冷管路），在「纸墨日间」与「曜石夜间」双主题下自动无损切换。
- **三档钢笔排线纹理 (`<pattern>`)**：内置 `42°` 单向钢笔排线 (`#lordInkHatch`)、双角度正交建筑阴影排线 (`#lordCrossHatch`) 与 `-35°` 朱砂印泥排线 (`#lordSealHatch`)，赋予披风褶皱、肩甲切面与面甲阴影纯粹的版画质感。
- **八层工程骨骼与动态机关叠加**（支持 `"profile" 124px`、`"token" 44px`、`"mini" 34px`）：

```text
[Layer 8: 机关随从层 Companion]  ──► 折纸发条蛙 / 达芬奇齿轮鸮 / 星轨朱砂机巧龙 (发条旋钮与悬浮游弋)
[Layer 7: 右持圣物层 Held Relic] ──► 星盘罗经仪 / 八角铜绿炼金灯 / 陀螺仪雷霆杖 (指针摆动与双环自转)
[Layer 6: 左持武器层 Weapon]     ──► 刻度燧石戟 / 机械滑轮弩 / 泰坦液压攻城锤 (钢笔排线刃面)
[Layer 5: 头部冠冕层 Headgear]   ──► 测绘三角羽帽 / 十字准星双镜 / 擒纵轮蒸汽冠 / 黑曜浮空方尖冠
[Layer 4: 棱面瓷墨面甲 Visage]   ──► 六棱测绘面甲 + 机械快门眨眼目镜 + 高领排线阴影
[Layer 3: 胸甲与肩甲层 Cuirass]  ──► 铆钉板甲 / 黑曜六角虫壳甲 / 铜绿双表水压甲 + 胸口计时核心
[Layer 2: 机械胫甲与战靴 Greaves]──► 膝部圆规铆钉关节 + 小腿黄铜扭簧 (弹簧靴) / 朱砂翼片 (赫尔墨斯靴)
[Layer 1: 背部装置与星盘 Halo]   ──► 沙暴排线大氅 / 达芬奇液冷翼 / 六羽星盘翼 + 360° 自转星盘刻度环
[Layer 0: 工程制图图框 Plate]    ──► (仅 Profile 模式) 双线制图外框、正交准星、游标角标、「FIG.01·LORD」钢印与朱砂方印
```

### 三大显形场景
1. **顶栏迷你徽章 (`size="mini"`)**：在页面顶部 `topbar` 品牌区实时展示玩家当前穿戴的纸墨蚀刻小人。
2. **领主衣橱工程图版 (`size="profile"`)**：展示完整的 `124×124` 工程制图图版（含 `FIG.01·LORD` 编号与朱砂方印）及 12 款赛季限定外观 (`cos_*`) 换装台。
3. **2D 荒原搜打撤地图实机棋子 (`size="token"`, `isMoving`)**：在 2D 多区块传送门荒原网格上直接渲染领主蚀刻棋子，移动时触发高频步伐起伏与阴影缩放。

---

## 2. CS 式唯一序列号与随机 UV 采样藏品 (`ProceduralRelicSVG`)

除荒原掉落的可交易穿戴式角色外观 (`cos_*`) 外，玩家参与每晚 20:00 商会领土战争获得 `80 战争活动积分` 后，可铸造具有**全球唯一递增 `item_id` 与确定性随机 UV 纹理参数**的【墨械典藏圣物】：

| 字段名 (`CollectibleItemDTO`) | 类型 | 生成规则与视觉映射 |
| :--- | :--- | :--- |
| `itemId` | `string` | 全服唯一递增序列号（如 `S1-#000042`） |
| `rarity` | `string` | 四档概率检定：`Common (60%)`、`Rare (28%)`、`Epic (10%)`、`Legendary (2%)` |
| `patternSeed` | `int32` | `[1, 999]` 随机图案种子（其中 `#777`、`#888`、`#999` 为特殊黄金对称模板） |
| `uvOffsetX` / `uvOffsetY` | `double` | `[0.000, 1.000]` 纹理采样偏移坐标，决定精密齿轮与星轨在器物表面的切割位置 |
| `uvScale` / `uvRotation` | `double` | `[0.75, 1.65]` 缩放比与 `[0°, 360°]` 旋转角，保证全服没有任何两件藏品纹理完全相同 |
| `paletteId` | `int32` | 古典纸墨、朱砂印泥、氧化铜绿与鎏金黑曜配色方案 |
