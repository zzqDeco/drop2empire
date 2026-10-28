import { useState } from "react";
import { api, type DashboardStateResp } from "@drop2empire/api-client";
import { Award, Sparkles } from "lucide-react";
import { ICON } from "../../icons";
import { type FacingDirection, LordAvatarSVG } from "../../LordAvatarSVG";
import { RaidItemIconSVG } from "../../RaidSpritesSVG";
import type { ServerUpdate } from "../../serverState";

/**
 * Integrated Personal Lord Profile & Wardrobe Card (Used on Main Settlement Screen & Relic Vault).
 */
export function LordProfileWardrobeBar({
  state,
  runAction,
  defaultExpanded = false,
}: {
  state: DashboardStateResp;
  busy?: boolean;
  defaultExpanded?: boolean;
  runAction: (
    fn: () => Promise<ServerUpdate>,
    msg?: string,
  ) => Promise<void>;
}) {
  const [showWardrobe, setShowWardrobe] = useState(defaultExpanded);
  const [previewFacing, setPreviewFacing] = useState<FacingDirection>("down");
  const { player, equippedCosmetics, cosmetics, raidLoadout } = state;
  const ownedCosCount = cosmetics.filter((c) => c.ownedCount > 0).length;

  return (
    <section className="panel" aria-label="领主个人档案与体素衣橱">
      <div className="panel-header">
        <div className="panel-title">
          <Award size={ICON.sm} />
          <h2>领主档案 · {player.handle}</h2>
        </div>
        <span className="tag-badge">
          {player.profession !== "none" ? player.professionName : "拓荒领主"}
        </span>
      </div>

      <div className="lord-main-profile-card">
        <div className="lord-voxel-showcase">
          <LordAvatarSVG
            cosmetics={equippedCosmetics}
            weaponKey={raidLoadout.weaponKey}
            armorKey={raidLoadout.armorKey}
            bootsKey={raidLoadout.bootsKey}
            size="profile"
            facing={previewFacing}
          />
          <div className="voxel-turn-controls">
            {(
              [
                ["down", "正面"],
                ["right", "右侧"],
                ["up", "背面"],
                ["left", "左侧"],
              ] as const
            ).map(([dir, label]) => (
              <button
                key={dir}
                type="button"
                className={`btn-chip ${previewFacing === dir ? "active" : ""}`}
                onClick={() => setPreviewFacing(dir)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="lord-profile-details">
          <div className="water-label">
            领主真身披挂 · 荒原出征与主城同辉
          </div>
          <div className="water-rate mono-num">
            S1 外观典藏：{ownedCosCount}/{cosmetics.length} · 唯一秘宝：
            {state.collectibles.length} 件
          </div>
          <div className="bp-costs lord-profile-costs">
            <span className="cost-chip mono-num">
              生命 {raidLoadout.totalMaxHp}
            </span>
            <span className="cost-chip mono-num">
              攻击 {raidLoadout.totalAtk}
            </span>
            <span className="cost-chip mono-num">
              护甲 {raidLoadout.totalDef}
            </span>
            <span className="cost-chip mono-num">
              安全箱 {raidLoadout.safeSlotCount}格
            </span>
          </div>
          <div className="lord-profile-wardrobe-actions">
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => setShowWardrobe((v) => !v)}
            >
              <Sparkles size={ICON.xs} />
              <span>
                {showWardrobe
                  ? "收起赛季外观衣橱"
                  : `更换赛季外观 (${ownedCosCount}/${cosmetics.length})`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {showWardrobe && (
        <div
          className={defaultExpanded ? "blueprint-list" : "modal-backdrop"}
          role={defaultExpanded ? undefined : "dialog"}
          aria-modal={defaultExpanded ? undefined : "true"}
          aria-label="领主赛季外观衣橱"
        >
          <div className={defaultExpanded ? "blueprint-list" : "modal-sheet"}>
            {!defaultExpanded && (
              <div className="modal-header">
                <div>
                  <h2>领主衣橱 · S1 赛季限定外观披挂</h2>
                  <p>
                    穿戴后将在主城个人档案、斥候整备厅与荒原 2D 裂隙战场中实时显形（已解锁{" "}
                    {ownedCosCount} / {cosmetics.length} 件）
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setShowWardrobe(false)}
                >
                  完成穿戴
                </button>
              </div>
            )}
            <div className="blueprint-list">
              {cosmetics.map((cos) => (
                <article
                  key={cos.itemKey}
                  className={`bp-card ${cos.equipped ? "bp-ready" : ""}`}
                >
                  <div className="bp-top">
                    <div className="raid-inline-item-row">
                      <RaidItemIconSVG itemKey={cos.itemKey} size={ICON.xl} />
                      <div>
                        <strong>{cos.name}</strong>
                        <span
                          className={`rarity-badge rarity-${cos.rarity.toLowerCase()}`}
                        >
                          {cos.rarity}
                        </span>
                      </div>
                    </div>
                    <span className="tag-badge mono-num">
                      持有 {cos.ownedCount}
                    </span>
                  </div>
                  <p className="bp-desc">
                    {cos.seasonTag} · {cos.visualEffect}
                  </p>
                  <div className="bp-footer">
                    <span className="cost-chip">{cos.slot}</span>
                    <button
                      type="button"
                      className={
                        cos.equipped
                          ? "btn-outline btn-sm"
                          : "btn-primary btn-sm"
                      }
                      data-pop={cos.equipped ? "卸下外观" : `✦ 穿戴 ${cos.name}`}
                      disabled={cos.ownedCount <= 0 && !cos.equipped}
                      onClick={() =>
                        void runAction(() =>
                          api.equipCosmetic({
                            slot: cos.slot,
                            itemKey: cos.equipped ? "" : cos.itemKey,
                          }),
                        )
                      }
                    >
                      {cos.equipped
                        ? "卸下"
                        : cos.ownedCount > 0
                          ? "穿戴"
                          : "荒原秘宝库掉落 / 市场求购"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
