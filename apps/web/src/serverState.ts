import type {
  DashboardStateResp,
  RaidSessionDTO,
  RaidUpdateResp,
} from "@drop2empire/api-client";

export type ServerUpdate = DashboardStateResp | RaidUpdateResp;

interface PartitionRevisions {
  dashboardRevision: number;
  raidRevision: number;
}

const stateRevisions = new WeakMap<DashboardStateResp, PartitionRevisions>();

export function getPartitionRevisions(
  state: DashboardStateResp,
): PartitionRevisions {
  return (
    stateRevisions.get(state) ?? {
      dashboardRevision: state.revision,
      raidRevision: state.revision,
    }
  );
}

function withPartitionRevisions(
  state: DashboardStateResp,
  dashboardRevision: number,
  raidRevision: number,
): DashboardStateResp {
  stateRevisions.set(state, { dashboardRevision, raidRevision });
  return state;
}

function mergeRaidZones(
  previous: RaidSessionDTO | undefined,
  incoming: RaidSessionDTO | undefined,
): RaidSessionDTO | undefined {
  if (!incoming) return undefined;
  const zones = new Map(
    (previous?.raidId === incoming.raidId ? previous.zones : []).map((zone) => [
      zone.id,
      zone,
    ]),
  );
  incoming.zones.forEach((zone) => zones.set(zone.id, zone));
  return {
    ...incoming,
    zones: [...zones.values()].sort((a, b) => a.id - b.id),
  };
}

export function belongsToSession(
  update: ServerUpdate,
  startedToken: string | null,
  currentToken: string | null,
): boolean {
  return (
    startedToken === currentToken ||
    ("player" in update &&
      !!update.sessionToken &&
      update.sessionToken === currentToken)
  );
}

export function mergeServerUpdate(
  current: DashboardStateResp | null,
  update: ServerUpdate,
): DashboardStateResp | null {
  if ("player" in update) {
    if (!current || current.player.handle !== update.player.handle) {
      return withPartitionRevisions(update, update.revision, update.revision);
    }
    const { dashboardRevision: curDashRev, raidRevision: curRaidRev } =
      getPartitionRevisions(current);

    if (update.revision < curDashRev) {
      return current;
    }

    // Delayed full snapshot that is newer than our non-raid snapshot,
    // while raidLoadout already advanced via a newer RaidUpdateResp delta.
    if (update.revision < curRaidRev) {
      if (update.revision === curDashRev) {
        return current;
      }
      const merged: DashboardStateResp = {
        ...update,
        revision: curRaidRev,
        raidLoadout: current.raidLoadout,
      };
      return withPartitionRevisions(merged, update.revision, curRaidRev);
    }

    const prevSess = current.raidLoadout.activeSession;
    const nextSess = update.raidLoadout.activeSession;
    if (prevSess && nextSess && prevSess.raidId === nextSess.raidId) {
      const merged: DashboardStateResp = {
        ...update,
        raidLoadout: {
          ...update.raidLoadout,
          activeSession: mergeRaidZones(prevSess, nextSess),
        },
      };
      return withPartitionRevisions(merged, update.revision, update.revision);
    }
    return withPartitionRevisions(update, update.revision, update.revision);
  }

  if (!current || current.player.handle !== update.playerHandle) {
    return current;
  }
  const { dashboardRevision: curDashRev, raidRevision: curRaidRev } =
    getPartitionRevisions(current);
  if (update.revision < curRaidRev) {
    return current;
  }

  const incoming = update.raidLoadout.activeSession;
  const previous = current.raidLoadout.activeSession;
  const nextState: DashboardStateResp = {
    ...current,
    revision: update.revision,
    raidLoadout: {
      ...update.raidLoadout,
      activeSession: mergeRaidZones(previous, incoming),
    },
  };
  return withPartitionRevisions(nextState, curDashRev, update.revision);
}

export interface ClientSessionSnapshot {
  state: DashboardStateResp;
  sessionToken: string | null;
  dashboardRevision: number;
  raidRevision: number;
  lastSyncAtMs: number;
  raidSyncedAtMs: number;
  needsDashboardCatchup: boolean;
}

export function applySnapshotUpdate(
  current: ClientSessionSnapshot | null,
  update: ServerUpdate,
  sessionToken: string | null,
  nowMs: number = Date.now(),
): ClientSessionSnapshot | null {
  if (!current || current.sessionToken !== sessionToken) {
    if (!("player" in update)) {
      return null;
    }
    const state = withPartitionRevisions(
      update,
      update.revision,
      update.revision,
    );
    return {
      state,
      sessionToken,
      dashboardRevision: update.revision,
      raidRevision: update.revision,
      lastSyncAtMs: nowMs,
      raidSyncedAtMs: nowMs,
      needsDashboardCatchup: false,
    };
  }

  const nextState = mergeServerUpdate(current.state, update);
  if (!nextState || nextState === current.state) {
    return current;
  }

  const { dashboardRevision, raidRevision } = getPartitionRevisions(nextState);
  const handleChanged =
    "player" in update && current.state.player.handle !== update.player.handle;
  const dashboardAccepted =
    "player" in update &&
    (handleChanged || update.revision >= current.dashboardRevision);
  const raidAccepted = handleChanged || update.revision >= current.raidRevision;

  const needsDashboardCatchup =
    raidRevision > dashboardRevision + 1 ||
    (!nextState.raidLoadout.activeSession && raidRevision > dashboardRevision);

  return {
    state: nextState,
    sessionToken,
    dashboardRevision,
    raidRevision,
    lastSyncAtMs: dashboardAccepted ? nowMs : current.lastSyncAtMs,
    raidSyncedAtMs: raidAccepted ? nowMs : current.raidSyncedAtMs,
    needsDashboardCatchup,
  };
}

export function advanceChannelingProgress<
  T extends { startedAt: number; durationMs: number; progressPct: number },
>(cur: T | null, nowMs: number, commandPending: boolean): T | null {
  if (!cur) return null;
  const elapsed = nowMs - cur.startedAt;
  if (elapsed >= cur.durationMs && !commandPending) {
    return { ...cur, progressPct: 100 };
  }
  return {
    ...cur,
    progressPct: Math.min(99, Math.floor((elapsed / cur.durationMs) * 100)),
  };
}
