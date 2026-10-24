import type { DashboardStateResp, RaidUpdateResp } from "@drop2empire/api-client";

export type ServerUpdate = DashboardStateResp | RaidUpdateResp;

export function belongsToSession(update: ServerUpdate, startedToken: string | null, currentToken: string | null): boolean {
  return startedToken === currentToken || ("player" in update && !!update.sessionToken && update.sessionToken === currentToken);
}

export function mergeServerUpdate(
  current: DashboardStateResp | null,
  update: ServerUpdate,
): DashboardStateResp | null {
  if ("player" in update) {
    if (current?.player.handle === update.player.handle && current.revision > update.revision) return current;
    return update;
  }
  if (!current || current.player.handle !== update.playerHandle || current.revision > update.revision) return current;
  const incoming = update.raidLoadout.activeSession;
  const previous = current.raidLoadout.activeSession;
  const zones = new Map((previous?.raidId === incoming?.raidId ? previous?.zones : [])?.map(zone => [zone.id, zone]));
  incoming?.zones.forEach(zone => zones.set(zone.id, zone));
  return {
    ...current,
    revision: update.revision,
    raidLoadout: {
      ...update.raidLoadout,
      activeSession: incoming ? { ...incoming, zones: [...zones.values()].sort((a, b) => a.id - b.id) } : undefined,
    },
  };
}
