# 微观设计 III：领主常驻动态卡通形象与程序化蚀刻藏品 (Micro Animated Lord Avatar & Procedural Relics)

> **层级定位**：`03-micro`（微观设计层 · 角色动态渲染架构与程序化藏品生成算法）  
> **职责边界**：定义领主个人卡通动态形象 (`LordAvatarSVG`) 的四部位分层 SVG 动画系统、双场景投射（主界面常驻 Profile 衣橱栏 + 2D 搜打撤肉鸽地图实机移动棋子），以及战争活动点数铸造的 CS 式唯一编号 UV 蚀刻藏品 (`ProceduralRelicSVG`)。  
> **代码映射**：[`apps/web/src/LordAvatarSVG.tsx`](../../../apps/web/src/LordAvatarSVG.tsx)、[`apps/web/src/WastelandRaidPanel.tsx`](../../../apps/web/src/WastelandRaidPanel.tsx)、[`apps/web/src/ProceduralRelicSVG.tsx`](../../../apps/web/src/ProceduralRelicSVG.tsx)

---

## 1. 领主常驻动态卡通形象架构 (`LordAvatarSVG`)

为让玩家在荒原摸出或在市场淘到的稀有外观具备极致的视觉正反馈，系统设计了基于纯矢量分层动画的 **`LordAvatarSVG` 动态角色渲染引擎**，支持三档自适应尺寸 (`"profile" 112px`、`"token" 44px`、`"mini" 32px`) 与六层骨骼/特效叠加：

```text
[Layer 6: 悬浮跟宠层 Companion]  ──► 凝水小精灵 / 发条猫头鹰 / 以太星尘幼龙 (上下环绕浮动与粒子吐息)
[Layer 5: 手持圣物层 Held Relic] ──► 寻水灵枝 / 永明以太提灯 / 泰坦雷霆权杖 (电弧闪烁与光晕呼吸)
[Layer 4: 局外武器与战靴层 Gear] ──► 燧石短矛 / 连发手弩 / 泰坦裂地重锤 + 麻布靴 / 弹簧靴 / 羽靴
[Layer 3: 头部冠冕层 Headgear]   ──► 拾荒斗笠 / 蒸汽护目镜 / 黑曜永耀皇冠 (金焰脉冲与眨眼动画)
[Layer 2: 躯干与护甲层 Armor]    ──► 荒原皮甲 / 沙虫壳胸甲 / 水压动力重甲 (随呼吸上下起伏)
[Layer 1: 背部披风与光环 Mantle] ──► 远行客披风 / 齿轮羽翼 / 星界流光幻翼 + 传世金色星芒粒子光环
```

### 三大常驻与实机显形场景
1. **顶栏迷你徽章 (`size="mini"`)**：在页面最上方 `topbar` 品牌栏旁实时显示玩家当前穿戴的动态小人。
2. **主界面常驻【领主形象与赛季衣橱】横幅 (`LordProfileWardrobeBar`, `size="profile"`)**：
   - 紧贴纪元叙事条下方常驻展示 `112×112` 高精度动态领主形象、当前局外整备战力/生命/移速冷却读数，以及四部位外观切换器。
   - 展开【衣橱与藏品图鉴】即可查看当季全部 12 款限定外观的拥有数量、市场参考价与一键穿戴/卸下按钮。
3. **2D 荒原搜打撤地图实机棋子 (`size="token"`, `isMoving`)**：
   - 当玩家进入 2D 多区块荒原地图时，网格上的玩家坐标格**直接渲染该动态卡通形象**（而非普通圆点或文字）。
   - 按下 `W A S D` 或点击移动时，`isMoving` 状态激活动态疾跑倾斜与披风高频摆动特效，让「攒外观」的乐趣在每一局走位摸金中直观兑现。

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
| `paletteId` | `int32` | 6 套古典纸墨与鎏金配色方案 |
