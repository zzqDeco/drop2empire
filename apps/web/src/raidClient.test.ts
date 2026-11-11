import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmpireClient, getCommandSyncOutcome } from "@drop2empire/api-client";

const command = {
  raidId: "raid-a",
  commandSeq: 1,
  action: "move",
  dx: 1,
  dy: 0,
};
const active = {
  playerHandle: "alice",
  revision: 2,
  raidLoadout: { activeSession: { raidId: "raid-a", lastCommandSeq: 1 } },
};
const dashboard = {
  player: { handle: "alice" },
  revision: 2,
  raidLoadout: active.raidLoadout,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("raid command network recovery", () => {
  let client: EmpireClient;
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    const storage = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });
    vi.stubGlobal("fetch", fetchMock);
    client = new EmpireClient();
    client.setSessionToken("test-session");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("retries a lost reply with the identical command and avoids dashboard polling", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("lost reply"));
    fetchMock.mockResolvedValueOnce(json(active));
    const res = await client.raidAction(command);
    expect(res).toEqual(active);
    expect(getCommandSyncOutcome(res)).toEqual({ kind: "executed" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]?.body).toBe(
      fetchMock.mock.calls[1][1]?.body,
    );
  });

  it("resynchronizes after both command replies are lost and marks uncertain outcome", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("lost reply"));
    fetchMock.mockRejectedValueOnce(new TypeError("lost retry reply"));
    fetchMock.mockResolvedValueOnce(json(dashboard));
    const res = await client.raidAction(command);
    expect(res).toEqual(dashboard);
    expect(getCommandSyncOutcome(res)).toMatchObject({ kind: "uncertain" });
    expect(fetchMock.mock.calls[2][0]).toBe("/api/v1/empire/state");
  });

  it("resynchronizes a stale sequence without submitting a different command again and marks conflict", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: "raid_sequence_conflict" } }, 422),
    );
    fetchMock.mockResolvedValueOnce(json(dashboard));
    const res = await client.raidAction(command);
    expect(res).toEqual(dashboard);
    expect(getCommandSyncOutcome(res)).toMatchObject({
      kind: "conflict",
      code: "raid_sequence_conflict",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/empire/state");
  });

  it("marks uncertain instead of conflict when transport retry encounters raid_sequence_conflict", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("lost reply"));
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: "raid_sequence_conflict" } }, 422),
    );
    fetchMock.mockResolvedValueOnce(json(dashboard));
    const res = await client.raidAction(command);
    expect(res).toEqual(dashboard);
    expect(getCommandSyncOutcome(res)).toMatchObject({ kind: "uncertain" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("keeps a committed finish receipt when the inventory refresh fails", async () => {
    const finished = { ...active, raidLoadout: {} };
    fetchMock.mockResolvedValueOnce(json(finished));
    fetchMock.mockResolvedValueOnce(json({}, 503));
    const res = await client.finishRaid({
      raidId: "raid-a",
      commandSeq: 1,
      status: "MIA",
    });
    expect(res).toEqual(finished);
    expect(getCommandSyncOutcome(res)).toEqual({ kind: "executed" });
  });

  it("does not retry a command using a replacement login session", async () => {
    fetchMock.mockImplementationOnce(async () => {
      client.setSessionToken("other-session");
      throw new TypeError("lost reply");
    });
    await expect(client.raidAction(command)).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
