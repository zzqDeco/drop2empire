import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmpireClient, getCommandSyncOutcome } from "@drop2empire/api-client";

describe("construction command recovery", () => {
  const fetchMock = vi.fn<typeof fetch>();
  let client: EmpireClient;
  const command = { code: "lumber_camp", quantity: 1, commandSeq: 2 };
  const dashboard = {
    revision: 3,
    player: { handle: "builder" },
    settlement: { commandSeq: 2 },
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });

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
    client.setSessionToken("builder-session");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("retries the identical building quantity and sequence after a lost reply", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("lost"));
    fetchMock.mockResolvedValueOnce(json(dashboard));
    const res = await client.constructBuilding(command);
    expect(res).toEqual(dashboard);
    expect(getCommandSyncOutcome(res)).toEqual({ kind: "executed" });
    expect(fetchMock.mock.calls[0][1]?.body).toBe(
      fetchMock.mock.calls[1][1]?.body,
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toEqual(
      command,
    );
  });

  it("resynchronizes stale tabs without charging a new command and marks conflict outcome (#16)", async () => {
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: "settlement_sequence_conflict", message: "stale" } }, 422),
    );
    fetchMock.mockResolvedValueOnce(json(dashboard));
    const res = await client.constructBuilding(command);
    expect(res).toEqual(dashboard);
    expect(getCommandSyncOutcome(res)).toMatchObject({
      kind: "conflict",
      code: "settlement_sequence_conflict",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/empire/state");
  });

  it("does not repeat a purchase after switching accounts", async () => {
    fetchMock.mockImplementationOnce(async () => {
      client.setSessionToken("other");
      throw new TypeError("lost");
    });
    await expect(client.constructBuilding(command)).rejects.toBeInstanceOf(
      TypeError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reconciles an uncertain research result and marks uncertain outcome (#16)", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("lost"));
    fetchMock.mockRejectedValueOnce(new TypeError("lost retry"));
    fetchMock.mockResolvedValueOnce(json(dashboard));
    const res = await client.researchTechnology({
      code: "woodworking",
      commandSeq: 1,
    });
    expect(getCommandSyncOutcome(res)).toMatchObject({ kind: "uncertain" });
    expect(fetchMock.mock.calls[0][1]?.body).toBe(
      fetchMock.mock.calls[1][1]?.body,
    );
    expect(fetchMock.mock.calls[2][0]).toBe("/api/v1/empire/state");
  });

  it("marks uncertain instead of conflict when transport retry encounters sequence conflict", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("lost first reply"));
    fetchMock.mockResolvedValueOnce(
      json(
        { error: { code: "settlement_sequence_conflict", message: "stale" } },
        422,
      ),
    );
    fetchMock.mockResolvedValueOnce(json(dashboard));
    const res = await client.constructBuilding(command);
    expect(res).toEqual(dashboard);
    expect(getCommandSyncOutcome(res)).toMatchObject({ kind: "uncertain" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
