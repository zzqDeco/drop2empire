import type {
  DashboardStateResp,
  EquippedCosmeticsDTO,
  RaidSettlementReportDTO,
} from "@drop2empire/api-client";
import { Award, Compass } from "lucide-react";
import { ICON } from "../../icons";
import { LordAvatarSVG } from "../../LordAvatarSVG";
import { RaidItemIconSVG } from "../../RaidSpritesSVG";

type RaidLoadoutDTO = DashboardStateResp["raidLoadout"];

interface RaidSettlementModalProps {
  settlementReport: RaidSettlementReportDTO;
  equippedCosmetics: EquippedCosmeticsDTO;
  raidLoadout: RaidLoadoutDTO;
  onDismiss: () => void;
}

export function RaidSettlementModal({
  settlementReport,
  equippedCosmetics,
  raidLoadout,
  onDismiss,
}: RaidSettlementModalProps) {
  const isExtracted = settlementReport.status === "EXTRACTED";

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="荒原远征结算卷轴"
    >
      <div className="modal-sheet raid-settlement-scroll">
        <div className="raid-settlement-header">
          <div className="raid-settlement-title-group">
            <span className="tag-badge">荒原远征战报 · 墨械枢密院核验</span>
            <h2>
              {isExtracted
                ? "凯旋归城 · 裂隙信标撤离成功"
                : "迷失荒原 · 沙暴吞噬未能撤离"}
            </h2>
            <p>
              {isExtracted
                ? "斥候小队携随身背囊与安全保险箱全部战利品安全返回领主主城。"
                : "随身背囊与穿戴的武器、护甲、战靴已在沙暴中损毁，仅本赛季安全保险箱物资完好带回。"}
            </p>
          </div>
          <div
            className={`raid-cinnabar-seal ${isExtracted ? "seal-victory" : "seal-mia"}`}
          >
            <span>{isExtracted ? "凯旋归城" : "荒原迷失"}</span>
            <small className="mono-num">
              {isExtracted ? "EXTRACTED" : "M.I.A."}
            </small>
          </div>
        </div>

        <div className="tab-body split-2col">
          <div className="subpanel">
            <div className="subpanel-head">
              <h3>
                <Compass size={ICON.sm} />
                <span>领主体素立绘与远征统计</span>
              </h3>
            </div>
            <div className="raid-settlement-hero">
              <LordAvatarSVG
                cosmetics={equippedCosmetics}
                weaponKey={raidLoadout.weaponKey}
                armorKey={raidLoadout.armorKey}
                bootsKey={raidLoadout.bootsKey}
                size="stage"
                facing="down"
              />
              <div className="ledger-audit-box mono-num">
                <div className="ledger-row">
                  <span>踏足裂隙区块</span>
                  <strong>{settlementReport.zonesVisited} 处</strong>
                </div>
                <div className="ledger-row">
                  <span>破译开启宝箱</span>
                  <strong>{settlementReport.chestsOpened} 个</strong>
                </div>
                <div className="ledger-row">
                  <span>讨伐深渊首领</span>
                  <strong>{settlementReport.bossesKilled} 尊</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="subpanel">
            <div className="subpanel-head">
              <h3>
                <Award size={ICON.sm} />
                <span>战利品入库清册</span>
              </h3>
            </div>
            <div className="tab-body">
              <h4>
                安全保险箱带回 ({settlementReport.safeBoxItems.length} 件 ·
                绝不掉落)
              </h4>
              <div className="loot-slot-grid">
                {settlementReport.safeBoxItems.length === 0 ? (
                  <span className="muted-note">安全保险箱未存放物品</span>
                ) : (
                  settlementReport.safeBoxItems.map((item) => (
                    <div key={item.id} className="loot-item-tile">
                      <RaidItemIconSVG itemKey={item.key} size={ICON.xl} />
                      <div>
                        <strong>{item.name}</strong>
                        <span
                          className={`rarity-badge rarity-${item.rarity.toLowerCase()}`}
                        >
                          {item.rarity}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <hr className="ink-divider" />

              <h4>
                随身背囊带出 ({settlementReport.backpackItems.length} 件)
              </h4>
              <div className="loot-slot-grid">
                {settlementReport.backpackItems.length === 0 ? (
                  <span className="muted-note">
                    {isExtracted
                      ? "随身背囊未携带额外战利品"
                      : "随身背囊物资已在荒原迷失中损毁"}
                  </span>
                ) : (
                  settlementReport.backpackItems.map((item) => (
                    <div key={item.id} className="loot-item-tile">
                      <RaidItemIconSVG itemKey={item.key} size={ICON.xl} />
                      <div>
                        <strong>{item.name}</strong>
                        <span
                          className={`rarity-badge rarity-${item.rarity.toLowerCase()}`}
                        >
                          {item.rarity}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="raid-settlement-cta">
                <button
                  type="button"
                  className="btn-primary btn-block"
                  onClick={onDismiss}
                >
                  收拢战利品 · 返回斥候大本营
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
