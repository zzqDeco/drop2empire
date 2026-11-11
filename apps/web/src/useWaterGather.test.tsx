// @vitest-environment jsdom
import { act, useCallback, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, type DashboardStateResp } from "@drop2empire/api-client";
import { computeLiveWaterMetrics } from "./domain/settlementSelectors";
import { useWaterGather } from "./hooks/useWaterGather";
import { mergeServerUpdate, type ServerUpdate } from "./serverState";

interface DeferredResponse {
  promise: Promise<Response>;
  resolveJson: (body: unknown, status?: number) => void;
  rejectNetwork: (err: Error) => void;
}

function createDeferredResponse(): DeferredResponse {
  let resolvePromise!: (value: Response) => void;
  let rejectPromise!: (reason?: unknown) => void;
  const promise = new Promise<Response>((res, rej) => {
    resolvePromise = res;
    rejectPromise = rej;
  });
  return {
    promise,
    resolveJson: (body: unknown, status = 200) => {
      resolvePromise(
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      );
    },
    rejectNetwork: (err: Error) => {
      rejectPromise(err);
    },
  };
}

function makeDashboardState(opts: {
  revision: number;
  waterMilli: number;
  totalManualClicks: number;
  handle?: string;
  seasonId?: string;
  sessionToken?: string;
}): DashboardStateResp {
  const {
    revision,
    waterMilli,
    totalManualClicks,
    handle = "alice",
    seasonId = "s1",
    sessionToken = "tok-alice",
  } = opts;
  return {
    revision,
    sessionToken,
    currentSeason: {
      seasonId,
    },
    player: {
      handle,
      populationTotal: 0,
      profession: "none",
      totalManualClicks,
    },
    resources: [
      {
        key: "water",
        name: "净水",
        tier: "basic",
        unlocked: true,
        amountMilli: waterMilli,
        frozenMilli: 0,
        capacityMilli: 300_000,
        grossRatePerSecMilli: 0,
        drainRatePerSecMilli: 0,
        netRatePerSecMilli: 0,
        description: "",
      },
    ],
    blueprints: [],
    raidLoadout: {},
    settlement: {
      commandSeq: 1,
      housingCapacity: 4,
      technologies: [],
      buildings: [],
    },
  } as unknown as DashboardStateResp;
}

interface Snapshot {
  inFlightClicks: number;
  liveWaterMilli: number;
  totalClicks: number;
  errorBanner: string | null;
  revision: number;
  handle: string;
}

interface HarnessControls {
  clickGather: () => void;
  applyExternalState: (next: DashboardStateResp, nextBoundToken?: string | null) => void;
}

describe("useWaterGather optimistic click reconciliation & session isolation", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.clear();
    api.setSessionToken("tok-alice");
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function mountHarness(opts?: {
    initialState?: DashboardStateResp;
    initialBoundToken?: string | null;
    useSessionContext?: boolean;
    onSessionMismatch?: () => void;
  }) {
    const initialState =
      opts?.initialState ??
      makeDashboardState({
        revision: 10,
        waterMilli: 0,
        totalManualClicks: 0,
      });
    const useSessionContext = opts?.useSessionContext ?? true;
    const initialBoundToken =
      opts?.initialBoundToken === undefined
        ? "tok-alice"
        : opts.initialBoundToken;

    const history: Snapshot[] = [];
    let latest!: Snapshot;
    let controls!: HarnessControls;

    function TestHarness() {
      const [dashboard, setDashboard] = useState<DashboardStateResp>(initialState);
      const [boundToken, setBoundToken] = useState<string | null>(
        initialBoundToken,
      );
      const [errorBanner, setErrorBanner] = useState<string | null>(null);

      const applyServerState = useCallback((next: ServerUpdate) => {
        setDashboard((prev) => mergeServerUpdate(prev, next) ?? prev);
      }, []);

      const { inFlightClicks, handleGatherWater } = useWaterGather(
        false,
        applyServerState,
        setErrorBanner,
        useSessionContext
          ? {
              boundSessionToken: boundToken,
              playerHandle: dashboard.player.handle,
              seasonId: dashboard.currentSeason.seasonId,
              authoritativeClicks: dashboard.player.totalManualClicks,
              onSessionMismatch: opts?.onSessionMismatch,
            }
          : undefined,
      );

      const metrics = computeLiveWaterMetrics(
        dashboard,
        false,
        inFlightClicks,
        0,
      );

      const snap: Snapshot = {
        inFlightClicks,
        liveWaterMilli: metrics.liveWaterMilli,
        totalClicks: metrics.totalClicks,
        errorBanner,
        revision: dashboard.revision,
        handle: dashboard.player.handle,
      };
      latest = snap;
      history.push(snap);

      controls = {
        clickGather: handleGatherWater,
        applyExternalState: (
          next: DashboardStateResp,
          nextBoundToken?: string | null,
        ) => {
          if (nextBoundToken !== undefined) {
            setBoundToken(nextBoundToken);
          }
          setDashboard(next);
        },
      };

      return (
        <div>
          <button
            type="button"
            data-testid="gather-water-btn"
            onClick={handleGatherWater}
          >
            打水
          </button>
          <span data-testid="water-readout">{metrics.liveWaterMilli}</span>
        </div>
      );
    }

    await act(async () => {
      root.render(<TestHarness />);
    });

    return {
      get latest() {
        return latest;
      },
      history,
      controls,
    };
  }

  it("reconciles out-of-order HTTP responses without spiking to 3000 or dropping", async () => {
    const req1 = createDeferredResponse();
    const req2 = createDeferredResponse();
    fetchMock
      .mockReturnValueOnce(req1.promise)
      .mockReturnValueOnce(req2.promise);

    const harness = await mountHarness();
    expect(harness.latest.liveWaterMilli).toBe(0);
    expect(harness.latest.inFlightClicks).toBe(0);

    // Send 2 rapid clicks from water=0, totalManualClicks=0
    await act(async () => {
      harness.controls.clickGather();
      harness.controls.clickGather();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/v1/empire/production/gather-water",
    );
    expect(harness.latest.inFlightClicks).toBe(2);
    expect(harness.latest.liveWaterMilli).toBe(2000);
    expect(harness.latest.totalClicks).toBe(2);

    // Click #2 resolves FIRST with revision=12, water=2000, totalManualClicks=2
    const waterReached2000Index = harness.history.length;
    await act(async () => {
      req2.resolveJson(
        makeDashboardState({
          revision: 12,
          waterMilli: 2000,
          totalManualClicks: 2,
        }),
      );
      await req2.promise;
    });

    expect(harness.latest.inFlightClicks).toBe(0);
    expect(harness.latest.liveWaterMilli).toBe(2000);
    expect(harness.latest.totalClicks).toBe(2);
    expect(harness.latest.revision).toBe(12);

    // Click #1 resolves LATE with stale revision=11, water=1000, totalManualClicks=1
    await act(async () => {
      req1.resolveJson(
        makeDashboardState({
          revision: 11,
          waterMilli: 1000,
          totalManualClicks: 1,
        }),
      );
      await req1.promise;
    });

    expect(harness.latest.inFlightClicks).toBe(0);
    expect(harness.latest.liveWaterMilli).toBe(2000);
    expect(harness.latest.totalClicks).toBe(2);
    expect(harness.latest.revision).toBe(12);

    // Verify zero intermediate jump (> 2000) or drop (< 2000 once 2000 was reached)
    expect(Math.max(...harness.history.map((h) => h.liveWaterMilli))).toBe(2000);
    for (const snap of harness.history.slice(waterReached2000Index)) {
      expect(snap.liveWaterMilli).toBe(2000);
    }
  });

  it("reconciles interleaved dashboard polling while clicks remain in flight", async () => {
    const req1 = createDeferredResponse();
    const req2 = createDeferredResponse();
    fetchMock
      .mockReturnValueOnce(req1.promise)
      .mockReturnValueOnce(req2.promise);

    const harness = await mountHarness();

    await act(async () => {
      harness.controls.clickGather();
      harness.controls.clickGather();
    });
    expect(harness.latest.inFlightClicks).toBe(2);
    expect(harness.latest.liveWaterMilli).toBe(2000);

    // Poll arrives reflecting the first committed click (water=1000, totalManualClicks=1)
    await act(async () => {
      harness.controls.applyExternalState(
        makeDashboardState({
          revision: 11,
          waterMilli: 1000,
          totalManualClicks: 1,
        }),
      );
    });

    expect(harness.latest.inFlightClicks).toBe(1);
    expect(harness.latest.liveWaterMilli).toBe(2000);
    expect(harness.latest.totalClicks).toBe(2);

    // Remaining responses settle cleanly
    await act(async () => {
      req1.resolveJson(
        makeDashboardState({
          revision: 11,
          waterMilli: 1000,
          totalManualClicks: 1,
        }),
      );
      req2.resolveJson(
        makeDashboardState({
          revision: 12,
          waterMilli: 2000,
          totalManualClicks: 2,
        }),
      );
      await Promise.all([req1.promise, req2.promise]);
    });

    expect(harness.latest.inFlightClicks).toBe(0);
    expect(harness.latest.liveWaterMilli).toBe(2000);
    expect(harness.latest.totalClicks).toBe(2);
  });

  it("reconciles partial failures accurately under failure-first ordering", async () => {
    const req1 = createDeferredResponse();
    const req2 = createDeferredResponse();
    fetchMock
      .mockReturnValueOnce(req1.promise)
      .mockReturnValueOnce(req2.promise);

    const harness = await mountHarness();

    await act(async () => {
      harness.controls.clickGather();
      harness.controls.clickGather();
    });
    expect(harness.latest.inFlightClicks).toBe(2);
    expect(harness.latest.liveWaterMilli).toBe(2000);

    // Click #1 fails first with server error
    await act(async () => {
      req1.resolveJson(
        { error: { code: "rate_limited", message: "请求过于频繁" } },
        429,
      );
      await req1.promise;
    });

    expect(harness.latest.inFlightClicks).toBe(1);
    expect(harness.latest.liveWaterMilli).toBe(1000);
    expect(harness.latest.errorBanner).toBe("请求过于频繁");

    // Click #2 succeeds with totalManualClicks=1, water=1000
    await act(async () => {
      req2.resolveJson(
        makeDashboardState({
          revision: 11,
          waterMilli: 1000,
          totalManualClicks: 1,
        }),
      );
      await req2.promise;
    });

    expect(harness.latest.inFlightClicks).toBe(0);
    expect(harness.latest.liveWaterMilli).toBe(1000);
    expect(harness.latest.totalClicks).toBe(1);
  });

  it("reconciles partial failures accurately under success-first ordering", async () => {
    const req1 = createDeferredResponse();
    const req2 = createDeferredResponse();
    fetchMock
      .mockReturnValueOnce(req1.promise)
      .mockReturnValueOnce(req2.promise);

    const harness = await mountHarness();

    await act(async () => {
      harness.controls.clickGather();
      harness.controls.clickGather();
    });
    expect(harness.latest.inFlightClicks).toBe(2);
    expect(harness.latest.liveWaterMilli).toBe(2000);

    // Click #2 succeeds FIRST with totalManualClicks=1, water=1000
    await act(async () => {
      req2.resolveJson(
        makeDashboardState({
          revision: 11,
          waterMilli: 1000,
          totalManualClicks: 1,
        }),
      );
      await req2.promise;
    });

    // Click #1 has not yet settled, so 1 optimistic click remains pending
    expect(harness.latest.inFlightClicks).toBe(1);
    expect(harness.latest.liveWaterMilli).toBe(2000);

    // Click #1 rejects with network error -> reconciles down to authoritative 1000
    await act(async () => {
      req1.rejectNetwork(new TypeError("Network disconnected"));
      await req1.promise.catch(() => undefined);
    });

    expect(harness.latest.inFlightClicks).toBe(0);
    expect(harness.latest.liveWaterMilli).toBe(1000);
    expect(harness.latest.totalClicks).toBe(1);
    expect(harness.latest.errorBanner).toBe("Network disconnected");
  });

  it("blocks gatherWater on localStorage session mismatch and isolates pending clicks across account switches", async () => {
    const onSessionMismatch = vi.fn();
    const harness = await mountHarness({ onSessionMismatch });

    // 1. Mutate localStorage session token before clicking -> blocks HTTP call & fires onSessionMismatch
    api.setSessionToken("tok-other-tab");
    await act(async () => {
      harness.controls.clickGather();
    });

    expect(onSessionMismatch).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(harness.latest.inFlightClicks).toBe(0);
    expect(harness.latest.liveWaterMilli).toBe(0);

    // 2. Restore Alice's token and dispatch 2 in-flight clicks
    api.setSessionToken("tok-alice");
    const aliceReq1 = createDeferredResponse();
    const aliceReq2 = createDeferredResponse();
    fetchMock
      .mockReturnValueOnce(aliceReq1.promise)
      .mockReturnValueOnce(aliceReq2.promise);

    await act(async () => {
      harness.controls.clickGather();
      harness.controls.clickGather();
    });
    expect(harness.latest.inFlightClicks).toBe(2);
    expect(harness.latest.liveWaterMilli).toBe(2000);

    // 3. Switch active session & playerHandle to Bob while Alice's clicks are still pending
    api.setSessionToken("tok-bob");
    await act(async () => {
      harness.controls.applyExternalState(
        makeDashboardState({
          revision: 4,
          waterMilli: 5000,
          totalManualClicks: 5,
          handle: "bob",
          sessionToken: "tok-bob",
        }),
        "tok-bob",
      );
    });

    // Pending optimistic clicks from Alice never leak into Bob's readout
    expect(harness.latest.handle).toBe("bob");
    expect(harness.latest.inFlightClicks).toBe(0);
    expect(harness.latest.liveWaterMilli).toBe(5000);
    expect(harness.latest.totalClicks).toBe(5);

    // 4. Stale settlement/rejection of Alice's requests does not overwrite Bob's state or banner
    await act(async () => {
      aliceReq1.resolveJson(
        makeDashboardState({
          revision: 99,
          waterMilli: 88_000,
          totalManualClicks: 88,
          handle: "alice",
          sessionToken: "tok-alice",
        }),
      );
      aliceReq2.rejectNetwork(new Error("Stale Alice failure"));
      await Promise.allSettled([aliceReq1.promise, aliceReq2.promise]);
    });

    expect(harness.latest.handle).toBe("bob");
    expect(harness.latest.inFlightClicks).toBe(0);
    expect(harness.latest.liveWaterMilli).toBe(5000);
    expect(harness.latest.errorBanner).toBeNull();
  });

  it("resets burst cleanly after downward authoritative click reset and preserves 3-arg fallback", async () => {
    const req1 = createDeferredResponse();
    const req2 = createDeferredResponse();
    fetchMock
      .mockReturnValueOnce(req1.promise)
      .mockReturnValueOnce(req2.promise);

    const harness = await mountHarness({
      initialState: makeDashboardState({
        revision: 20,
        waterMilli: 5000,
        totalManualClicks: 5,
      }),
    });

    await act(async () => {
      harness.controls.clickGather();
    });
    expect(harness.latest.inFlightClicks).toBe(1);
    expect(harness.latest.liveWaterMilli).toBe(6000);

    // Admin resets progress to 0 clicks while req1 is still in flight
    await act(async () => {
      harness.controls.applyExternalState(
        makeDashboardState({
          revision: 21,
          waterMilli: 0,
          totalManualClicks: 0,
        }),
      );
    });
    expect(harness.latest.inFlightClicks).toBe(0);
    expect(harness.latest.liveWaterMilli).toBe(0);

    // Subsequent click establishes a fresh baseline at 0
    await act(async () => {
      harness.controls.clickGather();
    });
    expect(harness.latest.inFlightClicks).toBe(1);
    expect(harness.latest.liveWaterMilli).toBe(1000);

    await act(async () => {
      req1.rejectNetwork(new Error("aborted"));
      req2.resolveJson(
        makeDashboardState({
          revision: 22,
          waterMilli: 1000,
          totalManualClicks: 1,
        }),
      );
      await Promise.allSettled([req1.promise, req2.promise]);
    });
    expect(harness.latest.inFlightClicks).toBe(0);
    expect(harness.latest.liveWaterMilli).toBe(1000);

    // Verify legacy 3-argument invocation remains backwards-compatible
    const legacyReq = createDeferredResponse();
    fetchMock.mockReturnValueOnce(legacyReq.promise);
    const legacyHarness = await mountHarness({ useSessionContext: false });
    await act(async () => {
      legacyHarness.controls.clickGather();
    });
    expect(legacyHarness.latest.inFlightClicks).toBe(1);
    expect(legacyHarness.latest.liveWaterMilli).toBe(1000);
    await act(async () => {
      legacyReq.resolveJson(
        makeDashboardState({
          revision: 11,
          waterMilli: 1000,
          totalManualClicks: 1,
        }),
      );
      await legacyReq.promise;
    });
    expect(legacyHarness.latest.inFlightClicks).toBe(0);
    expect(legacyHarness.latest.liveWaterMilli).toBe(1000);
  });
});
