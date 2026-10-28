import type { DashboardStateResp } from "@drop2empire/api-client";
import type { ServerUpdate } from "./serverState";
import { useRaidController, type LootDrop } from "./hooks/useRaidController";
import { RaidSettlementModal } from "./features/raid/RaidSettlementModal";
import { RaidBattlefieldViewport } from "./features/raid/RaidBattlefieldViewport";
import { RaidArmoryDraftView } from "./features/raid/RaidArmoryDraftView";

export type { LootDrop };
export { LordProfileWardrobeBar } from "./features/raid/LordProfileWardrobeBar";

interface WastelandRaidPanelProps {
  state: DashboardStateResp;
  busy?: boolean;
  runAction: (
    fn: () => Promise<ServerUpdate>,
    msg?: string,
  ) => Promise<void>;
}

export function WastelandRaidPanel({
  state,
  runAction,
}: WastelandRaidPanelProps) {
  const ctrl = useRaidController(state, runAction);

  if (ctrl.settlementReport) {
    return (
      <RaidSettlementModal
        settlementReport={ctrl.settlementReport}
        equippedCosmetics={state.equippedCosmetics}
        raidLoadout={state.raidLoadout}
        onDismiss={() => ctrl.setDismissedSettlementRaidId(ctrl.reportKey)}
      />
    );
  }

  if (ctrl.inRaid && ctrl.currentZone) {
    return (
      <RaidBattlefieldViewport
        state={state}
        currentZone={ctrl.currentZone}
        ctrl={ctrl}
        runAction={runAction}
      />
    );
  }

  return (
    <RaidArmoryDraftView state={state} ctrl={ctrl} runAction={runAction} />
  );
}
