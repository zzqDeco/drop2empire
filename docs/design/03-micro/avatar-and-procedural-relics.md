# 微观设计 III：领主纸墨蚀刻动态立绘与程序化藏品 (Blueprint & Ink Animated Lord Avatar & Procedural Relics)

> **层级定位**：`03-micro`（微观设计层 · 纸墨工程制图角色动态渲染架构与程序化藏品生成算法）  
> **职责边界**：定义领主个人纸墨蚀刻动态形象 (`LordAvatarSVG`) 的八层工程制图 SVG 动画系统、荒原怪物手绘敌方图元 (`RaidTileSpriteSVG`)、三场景投射（顶栏迷你徽章、领主衣橱工程图版、2D 搜打撤肉鸽地图实机棋子），以及战争活动点数铸造的 CS 式唯一编号 UV 蚀刻藏品 (`ProceduralRelicSVG`)。  
> **代码映射**：[`apps/web/src/LordAvatarSVG.tsx`](../../../apps/web/src/LordAvatarSVG.tsx)、[`apps/web/src/RaidSpritesSVG.tsx`](../../../apps/web/src/RaidSpritesSVG.tsx)、[`apps/web/src/features/raid/LordProfileWardrobeBar.tsx`](../../../apps/web/src/features/raid/LordProfileWardrobeBar.tsx)、[`apps/web/src/ProceduralRelicSVG.tsx`](../../../apps/web/src/ProceduralRelicSVG.tsx)

---

## 1. 领主纸墨手绘 2.5 头身动态探险家立绘架构 (`LordAvatarSVG`)

为确保角色形象兼具灵动生命力与全站 **Blueprint & Ink（纸墨工程制图风）** 视觉体系（[`apps/web/src/tokens.css`](../../../apps/web/src/tokens.css)、[`apps/web/src/theme/svgPalettes.ts`](../../../apps/web/src/theme/svgPalettes.ts) 与 [`apps/web/src/ProceduralRelicSVG.tsx`](../../../apps/web/src/ProceduralRelicSVG.tsx)）的统一质感，`LordAvatarSVG` 采用 **2.5 头身纸墨手绘灵动探险家（Hand-Inked Chibi Explorer）** 美术架构：

- **非反相独立墨线色板 + 双主题背光适配**：角色本体的松烟墨勾线、暖肤色、靛青猎装、朱砂围巾、黄铜配件与紫曜微光描边统一定义于 [`apps/web/src/theme/svgPalettes.ts`](../../../apps/web/src/theme/svgPalettes.ts)（`LORD_ILLUSTRATION_PALETTE` 与 `RAID_CREATURE_PALETTE`），切至暗色主题时绝不出现“皮肤白描边 / 白靴反相”；外围工程制图画框绑定 CSS 语义 Token，并在角色身后叠加暖宣纸径向背光晕（`radialGradient`）保障暗色底板轮廓清晰度。
- **真四向侧身与背影转体（`down` / `right` / `left` / `up`）**：
  - `down`（正面立姿）：灵动高光瞳孔、错落碎发呆毛、飘逸朱砂围巾与 A 字探险猎装；
  - `right` / `left`（真 3/4 侧身行军）：独立绘制侧转脸廓、单侧耳廓、向后扬起的风吹碎发与围巾飘带、前后错步战靴及前探持武姿态；
  - `up`（真背面立姿）：完整层次后发发梢、背部围巾结带与大氅剪裁。
- **八层穿戴与动态机关叠加**（支持 `"stage" 168px`、`"profile" 128px`、`"token" 48px`、`"mini" 36px`）：

```text
[Layer 8: 机关随从层 Companion]  ──► 汲水发条木蛙 / 炼金机械猫头鹰 / 星界以太幼龙 (独立安全悬浮轨道，零遮挡武器)
[Layer 7: 头部冠冕层 Headgear]   ──► 额前圆框黄铜防风护目镜 / 墨械蒸汽齿轮冠 / 曜石星辉浮空王冠
[Layer 6: 面部与碎发层 Visage]   ──► 2.5 头身手绘圆润颌线、双层高光眼瞳与错落斜刘海/呆毛
[Layer 5: 右手副持圣物 HeldRelic]──► 寻脉青铜罗盘 / 赫尔墨斯荧光提灯 / 双环陀螺仪泰坦雷鸣权杖
[Layer 4: 左手主战武器 Weapon]   ──► 削尖硬木矛 / 燧石短猎弓 / 墨械连发手弩 / 银刃泰坦裂地重锤
[Layer 3: 猎装与胸甲层 Cuirass]  ──► 靛青领主猎装 / 粗麻防沙衣 / 硬化木片甲 / 沙虫壳胸甲 / 水压动力重甲 + 朱砂围巾
[Layer 2: 战靴层 Boots]          ──► 猎人皮靴 / 草编轻便履 / 厚底鹿皮靴 / 黄铜弹簧战靴 / 赫尔墨斯风行羽靴
[Layer 1: 背部大氅与羽翼 Mantle] ──► 探险短披肩 / 沙行旅人斗篷 / 达芬奇水翼背甲 / 星界流光羽翼
[Layer 0: 工程制图图框 Plate]    ──► 双线制图外框、游标角标、暖宣纸径向背光与透视石台底座
```

### 三大显形场景与荒原敌方生物图元
1. **顶栏迷你徽章 (`size="mini"`)**：在页面顶部 `topbar` 品牌区实时展示玩家当前穿戴的纸墨手绘探险家小人。
2. **领主衣橱工程图版 (`size="profile"` / `"stage"`)**：展示完整的双线工程制图图版及 12 款赛季限定外观 (`cos_*`) 换装台。
3. **2D 荒原搜打撤地图实机棋子与手绘敌方三怪 (`size="token"`, `RaidTileSpriteSVG`)**：在 2D 多区块传送门荒原网格上渲染领主四向行军棋子，并与同色系手绘敌方图元——**荒原蒙面劫掠者**（弯刀与尖刺护肩）、**S 型盘踞岩甲沙虫**（四颚口器与腹甲节片）、**黑曜机巧巨像 Boss**（浮空碎岩拳套、自转黄铜星盘环与熔炉核心）形成高辨识度剪影对比。

---

## 2. CS 式唯一序列号与随机 UV 采样藏品 (`ProceduralRelicSVG`)

除荒原掉落的可交易穿戴式角色外观 (`cos_*`) 外，玩家参与每晚 20:00 商会领土战争积累 `100 战争活动积分` (`ChestRedeemCostPoints = 100`) 后，可兑换并开启【S1·墨械宝箱】以铸造具有**全球唯一递增 `item_id` 与确定性随机 UV 纹理参数**的【墨械典藏圣物】：

| 字段名 (`CollectibleItemDTO`) | 类型 | 生成规则与视觉映射 |
| :--- | :--- | :--- |
| `itemId` | `string` | 全服唯一递增序列号（如 `S1-#000042`） |
| `rarity` | `string` | 四档概率检定：`Common (60%)`、`Rare (28%)`、`Epic (10%)`、`Legendary (2%)` |
| `patternSeed` | `int32` | `[1, 999]` 随机图案种子（其中 `#777`、`#888`、`#999` 为特殊黄金对称模板） |
| `uvOffsetX` / `uvOffsetY` | `double` | `[0.000, 1.000]` 纹理采样偏移坐标，决定精密齿轮与星轨在器物表面的切割位置 |
| `uvScale` / `uvRotation` | `double` | `[0.75, 1.65]` 缩放比与 `[0°, 360°]` 旋转角，保证全服没有任何两件藏品纹理完全相同 |
| `paletteId` | `int32` | 古典纸墨、朱砂印泥、氧化铜绿与鎏金黑曜配色方案 |
