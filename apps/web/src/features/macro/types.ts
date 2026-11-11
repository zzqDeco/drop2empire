import type { DashboardStateResp } from "@drop2empire/api-client";

export type WorldZoneKey = "settlement" | "scout" | "market" | "war" | "lord";

export interface SceneProps {
  state: DashboardStateResp;
  busy?: boolean;
  runAction: (
    fn: () => Promise<DashboardStateResp>,
    successMsg?: string,
  ) => Promise<void>;
}
