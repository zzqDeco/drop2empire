import { api } from "@drop2empire/api-client";
import { Box, Sparkles } from "lucide-react";
import { ICON } from "../../icons";
import { ProceduralRelicSVG } from "../../ProceduralRelicSVG";
import type { SceneProps } from "./types";

/**
 * Scene V (Lower Panel): Season Chest Console & Procedural UV-Etched Collectibles Gallery
 */
export function SeasonRelicVaultPanel({ state, runAction }: SceneProps) {
  const { player, resources } = state;
  const chestCount = Math.floor(
    (resources.find((r) => r.key === "season_chest")?.amountMilli ?? 0) / 1000,
  );

  return (
    <section className="lower-workspace" aria-label="墨械典藏宝箱与程序化藏品">
      <div className="tab-body">
        <div className="chest-console">
          <div className="chest-console-info">
            <h3>
              <Box size={ICON.sm} />
              <span>
                {state.currentSeason?.title ?? "S1 · 黑曜苏醒"} ·
                墨械唯一编号蚀刻秘宝
              </span>
            </h3>
            <p>
              消耗 100 战争活动积分可兑换 1 个赛季宝箱。开启后铸造具有全服唯一递增序列号与传世墨金蚀刻纹样的秘宝藏品（跨赛季永久保留）。
            </p>
          </div>
          <div className="chest-console-actions">
            <button
              type="button"
              className="btn-outline mono-num"
              data-pop="+1 赛季宝箱"
              disabled={player.activityPoints < 100}
              onClick={() =>
                void runAction(() => api.redeemSeasonChest({ count: 1 }))
              }
            >
              兑换宝箱 (-100 积分)
            </button>
            <button
              type="button"
              className="btn-primary mono-num"
              data-pop="✦ 开启秘宝"
              disabled={chestCount < 1}
              onClick={() =>
                void runAction(() =>
                  api.openSeasonChest({ clientSeedHint: Date.now() }),
                )
              }
            >
              <Sparkles size={ICON.sm} />
              <span>开箱 ({chestCount})</span>
            </button>
          </div>
        </div>

        {state.collectibles.length === 0 ? (
          <div className="empty-stage-hint">
            尚未铸造赛季蚀刻藏品。参与公会捐献或每晚 20:00 战区会战获取活动积分即可兑换开箱！
          </div>
        ) : (
          <div className="collectibles-grid">
            {state.collectibles.map((item) => (
              <article key={item.itemId} className="collectible-card">
                <ProceduralRelicSVG item={item} />
                <div className="collectible-meta">
                  <div className="collectible-title-row">
                    <strong>{item.name}</strong>
                    <span
                      className={`rarity-badge rarity-${item.rarityTier.toLowerCase()}`}
                    >
                      {item.rarityTier}
                    </span>
                  </div>
                  <div className="special-tag-row">{item.specialTag}</div>
                  <dl className="collectible-kv mono-num">
                    <div>
                      <dt>编号</dt>
                      <dd>#{item.serialNumber}</dd>
                    </div>
                    <div>
                      <dt>纹理</dt>
                      <dd>
                        {item.textureName} · {item.paletteName}
                      </dd>
                    </div>
                    <div>
                      <dt>种子</dt>
                      <dd>{item.patternSeed}</dd>
                    </div>
                  </dl>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
