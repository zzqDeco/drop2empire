import {
  getResponseTiming,
  type DashboardStateResp,
  type RaidSessionDTO,
  type RaidUpdateResp,
  type ResponseTiming,
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

function isStaleRaidSession(
  previous: RaidSessionDTO | undefined,
  incoming: RaidSessionDTO | undefined,
): boolean {
  if (!previous || !incoming || previous.raidId !== incoming.raidId) {
    return false;
  }
  if (incoming.lastCommandSeq < previous.lastCommandSeq) {
    return true;
  }
  if (
    incoming.lastCommandSeq === previous.lastCommandSeq &&
    previous.serverNowUnixMs !== undefined &&
    incoming.serverNowUnixMs !== undefined &&
    incoming.serverNowUnixMs < previous.serverNowUnixMs
  ) {
    return true;
  }
  return false;
}

function mergeRaidZones(
  previous: RaidSessionDTO | undefined,
  incoming: RaidSessionDTO | undefined,
): RaidSessionDTO | undefined {
  if (!incoming) return undefined;
  if (isStaleRaidSession(previous, incoming)) {
    return previous;
  }
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
  clockOffsetMs: number | null;
  clockOffsetRttMs: number;
  raidExpiresAtClientMs: number | null;
  needsDashboardCatchup: boolean;
}

function calibrateClockOffset(
  prevOffsetMs: number | null,
  prevRttMs: number,
  serverNowUnixMs: number | undefined,
  timing: ResponseTiming | null,
  fallbackNowMs: number,
): { clockOffsetMs: number | null; clockOffsetRttMs: number } {
  if (serverNowUnixMs === undefined || serverNowUnixMs <= 0) {
    return { clockOffsetMs: prevOffsetMs, clockOffsetRttMs: prevRttMs };
  }
  const rttMs = timing
    ? Math.max(0, timing.receivedAtMs - timing.startedAtMs)
    : Number.POSITIVE_INFINITY;
  const clientAnchorMs = timing
    ? (timing.startedAtMs + timing.receivedAtMs) / 2
    : fallbackNowMs;
  const sampleOffsetMs = serverNowUnixMs - clientAnchorMs;
  if (prevOffsetMs === null) {
    return {
      clockOffsetMs: sampleOffsetMs,
      clockOffsetRttMs: rttMs,
    };
  }
  if (
    Number.isFinite(rttMs) &&
    (rttMs <= prevRttMs + 250 || rttMs <= 2000)
  ) {
    return {
      clockOffsetMs: sampleOffsetMs,
      clockOffsetRttMs: Math.min(prevRttMs, rttMs),
    };
  }
  return { clockOffsetMs: prevOffsetMs, clockOffsetRttMs: prevRttMs };
}

function deriveRaidExpiresAtClientMs(
  session: RaidSessionDTO | undefined,
  clockOffsetMs: number | null,
): number | null {
  if (
    !session ||
    session.expiresAtUnixMs === undefined ||
    session.expiresAtUnixMs <= 0 ||
    clockOffsetMs === null
  ) {
    return null;
  }
  return Math.round(session.expiresAtUnixMs - clockOffsetMs);
}

export function applySnapshotUpdate(
  current: ClientSessionSnapshot | null,
  update: ServerUpdate,
  sessionToken: string | null,
  nowMs: number = Date.now(),
  timingOverride?: ResponseTiming | null,
): ClientSessionSnapshot | null {
  const timing =
    timingOverride !== undefined ? timingOverride : getResponseTiming(update);
  const updateServerNowMs =
    update.serverNowUnixMs ?? update.raidLoadout.activeSession?.serverNowUnixMs;
  const anchorMs = timing
    ? Math.round((timing.startedAtMs + timing.receivedAtMs) / 2)
    : nowMs;

  if (!current || current.sessionToken !== sessionToken) {
    if (!("player" in update)) {
      return null;
    }
    const state = withPartitionRevisions(
      update,
      update.revision,
      update.revision,
    );
    const { clockOffsetMs, clockOffsetRttMs } = calibrateClockOffset(
      null,
      Number.POSITIVE_INFINITY,
      updateServerNowMs,
      timing,
      nowMs,
    );
    return {
      state,
      sessionToken,
      dashboardRevision: update.revision,
      raidRevision: update.revision,
      lastSyncAtMs: nowMs,
      raidSyncedAtMs: anchorMs,
      clockOffsetMs,
      clockOffsetRttMs,
      raidExpiresAtClientMs: deriveRaidExpiresAtClientMs(
        state.raidLoadout.activeSession,
        clockOffsetMs,
      ),
      needsDashboardCatchup: false,
    };
  }

  const { clockOffsetMs, clockOffsetRttMs } = calibrateClockOffset(
    current.clockOffsetMs,
    current.clockOffsetRttMs,
    updateServerNowMs,
    timing,
    nowMs,
  );

  const nextState = mergeServerUpdate(current.state, update);
  if (!nextState || nextState === current.state) {
    if (clockOffsetMs !== current.clockOffsetMs) {
      return {
        ...current,
        clockOffsetMs,
        clockOffsetRttMs,
        raidExpiresAtClientMs: deriveRaidExpiresAtClientMs(
          current.state.raidLoadout.activeSession,
          clockOffsetMs,
        ),
      };
    }
    return current;
  }

  const { dashboardRevision, raidRevision } = getPartitionRevisions(nextState);
  const handleChanged =
    "player" in update && current.state.player.handle !== update.player.handle;
  const dashboardAccepted =
    "player" in update &&
    (handleChanged || update.revision >= current.dashboardRevision);
  const raidSessionReplaced =
    nextState.raidLoadout.activeSession !==
    current.state.raidLoadout.activeSession;
  const raidAccepted =
    handleChanged ||
    (update.revision >= current.raidRevision &&
      (raidSessionReplaced || !nextState.raidLoadout.activeSession));

  const needsDashboardCatchup =
    raidRevision > dashboardRevision + 1 ||
    (!nextState.raidLoadout.activeSession && raidRevision > dashboardRevision);

  return {
    state: nextState,
    sessionToken,
    dashboardRevision,
    raidRevision,
    lastSyncAtMs: dashboardAccepted ? nowMs : current.lastSyncAtMs,
    raidSyncedAtMs: raidAccepted ? anchorMs : current.raidSyncedAtMs,
    clockOffsetMs,
    clockOffsetRttMs,
    raidExpiresAtClientMs: deriveRaidExpiresAtClientMs(
      nextState.raidLoadout.activeSession,
      clockOffsetMs,
    ),
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
