import { useState } from "react";
import { api, type CollectibleItemDTO } from "@drop2empire/api-client";
import { Award, Box, Sparkles } from "lucide-react";
import { ICON } from "../../icons";
import { ProceduralRelicSVG } from "../../ProceduralRelicSVG";
import { ModalShell } from "../../components/ModalShell";
import type { SceneProps } from "./types";

/**
 * Scene V (Lower Panel): Season Chest Console & Procedural UV-Etched Collectibles Gallery
 */
export function SeasonRelicVaultPanel({
  state,
  busy = false,
  runAction,
}: SceneProps) {
  const [revealedRelic, setRevealedRelic] = useState<CollectibleItemDTO | null>(
    null,
  );
  const [vaultScope, setVaultScope] = useState<"mine" | "all">("mine");
  const { player, resources } = state;
  const chestCount = Math.floor(
    (resources.find((r) => r.key === "season_chest")?.amountMilli ?? 0) / 1000,
  );
  const myCollectibles = state.collectibles.filter(
    (c) => c.ownerName === player.handle,
  );
  const visibleCollectibles =
    vaultScope === "mine" ? myCollectibles : state.collectibles;

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
              消耗 100 战争活动积分可兑换 1 个赛季宝箱。开启后铸造具有全服唯一递增序列号与传世墨金蚀刻纹样的秘宝藏品（跨赛季永久保留，支持区分本人拥有与全服馆藏）。
            </p>
          </div>
          <div className="chest-console-actions">
            <button
              type="button"
              className="btn-outline mono-num"
              data-pop="+1 赛季宝箱"
              disabled={busy || player.activityPoints < 100}
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
              disabled={busy || chestCount < 1}
              onClick={() => {
                const existingOwnIds = new Set(
                  myCollectibles.map((c) => c.itemId),
                );
                void runAction(async () => {
                  const resp = await api.openSeasonChest({
                    clientSeedHint: Date.now(),
                  });
                  const ownCollectibles = resp.collectibles.filter(
                    (c) => c.ownerName === resp.player.handle,
                  );
                  const minted =
                    ownCollectibles.find(
                      (c) => !existingOwnIds.has(c.itemId),
                    ) ??
                    ownCollectibles[0] ??
                    null;
                  if (minted) {
                    setVaultScope("mine");
                    setRevealedRelic(minted);
                  }
                  return resp;
                });
              }}
            >
              <Sparkles size={ICON.sm} />
              <span>开箱 ({chestCount})</span>
            </button>
          </div>
        </div>

        <div className="quick-alloc-bar">
          <button
            type="button"
            className={`btn-chip mono-num ${vaultScope === "mine" ? "active" : ""}`}
            onClick={() => setVaultScope("mine")}
          >
            我的秘宝 ({myCollectibles.length})
          </button>
          <button
            type="button"
            className={`btn-chip mono-num ${vaultScope === "all" ? "active" : ""}`}
            onClick={() => setVaultScope("all")}
          >
            全服馆藏 ({state.collectibles.length})
          </button>
        </div>

        {visibleCollectibles.length === 0 ? (
          <div className="empty-stage-hint">
            {vaultScope === "mine" && state.collectibles.length > 0
              ? `你尚未铸造个人赛季秘宝（当前全服已公开陈列 ${state.collectibles.length} 件，可切换“全服馆藏”鉴赏）。参与公会捐献或每晚 20:00 战区会战获取活动积分即可兑换开箱！`
              : "尚未铸造赛季蚀刻藏品。参与公会捐献或每晚 20:00 战区会战获取活动积分即可兑换开箱！"}
          </div>
        ) : (
          <div className="collectibles-grid">
            {visibleCollectibles.map((item) => {
              const isMine = item.ownerName === player.handle;
              const exactSeed = item.patternSeedText ?? String(item.patternSeed);
              return (
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
                        <dt>持有人</dt>
                        <dd>
                          {item.ownerName}
                          {isMine ? "（我的）" : ""}
                        </dd>
                      </div>
                      <div>
                        <dt>纹理</dt>
                        <dd>
                          {item.textureName} · {item.paletteName}
                        </dd>
                      </div>
                      <div>
                        <dt>种子</dt>
                        <dd>{exactSeed}</dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => setRevealedRelic(item)}
                    >
                      检视蚀刻铭文
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {revealedRelic && (
        <ModalShell
          ariaLabel="传世秘宝铸造揭晓"
          sheetClassName="modal-sheet relic-reveal-sheet"
          onClose={() => setRevealedRelic(null)}
        >
          <div className="modal-header">
            <div>
              <span className="tag-badge tag-warning mono-num">
                <Award size={ICON.xs} />
                <span>全服唯一序列号 #{revealedRelic.serialNumber}</span>
              </span>
              <h2>传世秘宝铸造揭晓 · {revealedRelic.name}</h2>
              <p>
                {revealedRelic.seasonId} 永久跨季契约认证 · 持有人{" "}
                {revealedRelic.ownerName} · 铸造时刻 {revealedRelic.mintedAt}
              </p>
            </div>
            <span
              className={`rarity-badge rarity-${revealedRelic.rarityTier.toLowerCase()}`}
            >
              {revealedRelic.rarityTier}
            </span>
          </div>

          <div className="relic-reveal-body">
            <div className="relic-reveal-stage">
              <ProceduralRelicSVG item={revealedRelic} />
            </div>
            <div className="ledger-audit-box mono-num">
              <div className="ledger-row">
                <span>归属持有人</span>
                <strong>
                  {revealedRelic.ownerName}
                  {revealedRelic.ownerName === player.handle ? "（本人拥有）" : ""}
                </strong>
              </div>
              <div className="ledger-row">
                <span>蚀刻词条</span>
                <strong className="special-tag-row">
                  {revealedRelic.specialTag}
                </strong>
              </div>
              <div className="ledger-row">
                <span>程序化纹理 / 色谱</span>
                <span>
                  {revealedRelic.textureName} · {revealedRelic.paletteName}
                </span>
              </div>
              <div className="ledger-row">
                <span>几何纹样种子</span>
                <strong>
                  {revealedRelic.patternSeedText ??
                    String(revealedRelic.patternSeed)}
                </strong>
              </div>
              <button
                type="button"
                className="btn-primary btn-block"
                onClick={() => setRevealedRelic(null)}
              >
                {revealedRelic.ownerName === player.handle
                  ? "收入我的秘宝陈列馆"
                  : "关闭全服馆藏检视"}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </section>
  );
}
