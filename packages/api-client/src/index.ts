import {
  IDL_ROUTES,
  type EconomyActionReq,
  type MonetaryPolicyReq,
  type IntroduceCompanyReq,
  type AllocateWorkersReq,
  type Benchmark30mResp,
  type ChooseProfessionReq,
  type ControlSimulationReq,
  type CraftItemReq,
  type DashboardStateResp,
  type DeployWarTroopsReq,
  type GatherWaterReq,
  type InstallEquipmentReq,
  type LoginAccountReq,
  type LogoutAccountResp,
  type OpenSeasonChestReq,
  type PlaceMarketOrderReq,
  type RecruitResidentReq,
  type RedeemSeasonChestReq,
  type RegisterAccountReq,
  type SaveAllocationPresetReq,
  type SwitchAccountReq,
  type SwitchGuildReq,
  type GuildActionReq,
  type ToggleEdictReq,
  type DispatchExpeditionReq,
  type TradeCaravanReq,
  type EquipCosmeticReq,
  type LearnRaidBlueprintReq,
  type ManageRaidGearReq,
  type DraftRaidBuffReq,
  type RaidActionReq,
  type RaidUpdateResp,
  type FinishRaidReq,
  type RolloverSeasonReq,
  type PublishNoticeReq,
  type UnlockBlueprintReq,
  type ResearchTechnologyReq,
  type ConstructBuildingReq,
} from "./generated";

export * from "./generated";

const SESSION_STORAGE_KEY = "d2e-session-token";

export type CommandSyncOutcome =
  | { kind: "executed" }
  | { kind: "conflict"; code: string; message: string }
  | { kind: "uncertain"; message: string };

const commandSyncOutcomes = new WeakMap<object, CommandSyncOutcome>();

export interface ResponseTiming {
  startedAtMs: number;
  receivedAtMs: number;
}

const responseTimings = new WeakMap<object, ResponseTiming>();

function markCommandSyncOutcome<T extends object>(
  resp: T,
  outcome: CommandSyncOutcome,
): T {
  commandSyncOutcomes.set(resp, outcome);
  return resp;
}

export function getCommandSyncOutcome(resp: unknown): CommandSyncOutcome {
  if (resp && typeof resp === "object") {
    return commandSyncOutcomes.get(resp) ?? { kind: "executed" };
  }
  return { kind: "executed" };
}

export function getResponseTiming(resp: unknown): ResponseTiming | null {
  if (resp && typeof resp === "object") {
    return responseTimings.get(resp) ?? null;
  }
  return null;
}

function generateIdempotencyKey(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 10)}`;
}

function withIdempotencyHeader(init: RequestInit, key: string): RequestInit {
  const headers = new Headers(init.headers);
  if (!headers.has("X-Idempotency-Key")) {
    headers.set("X-Idempotency-Key", key);
  }
  return { ...init, headers };
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const part = encodeURIComponent;
function routePath(
  route: { clientPath: string },
  params?: Record<string, string>,
): string {
  if (!params) return route.clientPath;
  return route.clientPath.replace(/:([a-zA-Z0-9_]+)/g, (_, key: string) =>
    part(params[key] ?? ""),
  );
}

export class EmpireClient {
  #sessionListeners = new Set<
    (token: string | null, source: "local" | "storage") => void
  >();
  #storageBound = false;

  #ensureStorageListener() {
    if (
      this.#storageBound ||
      typeof window === "undefined" ||
      typeof window.addEventListener !== "function"
    ) {
      return;
    }
    this.#storageBound = true;
    window.addEventListener("storage", (event: StorageEvent) => {
      if (event.key !== null && event.key !== SESSION_STORAGE_KEY) return;
      const next = this.getSessionToken();
      for (const listener of this.#sessionListeners) {
        listener(next, "storage");
      }
    });
  }

  subscribeSession(
    listener: (token: string | null, source: "local" | "storage") => void,
  ): () => void {
    this.#ensureStorageListener();
    this.#sessionListeners.add(listener);
    return () => {
      this.#sessionListeners.delete(listener);
    };
  }

  getSessionToken(): string | null {
    try {
      return window.localStorage.getItem(SESSION_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  setSessionToken(token: string | null) {
    const prev = this.getSessionToken();
    try {
      if (token) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors in private mode
    }
    if (prev !== token) {
      for (const listener of this.#sessionListeners) {
        listener(token, "local");
      }
    }
  }

  async #request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    const token = this.getSessionToken();
    if (token) {
      headers.set("X-Session-Token", token);
    }
    if (options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    const startedAtMs = Date.now();
    const response = await fetch(`/api/v1${path}`, {
      ...options,
      headers,
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new ApiError(
        response.status,
        data.error?.code ?? "request_failed",
        data.error?.message ?? `请求失败 (${response.status})`,
      );
    }
    const parsed = (await response.json()) as T;
    const receivedAtMs = Date.now();
    if (parsed && typeof parsed === "object") {
      responseTimings.set(parsed as object, { startedAtMs, receivedAtMs });
    }
    return parsed;
  }

  getDashboard = () =>
    this.#request<DashboardStateResp>(IDL_ROUTES.GetDashboard.clientPath);

  registerAccount = async (req: RegisterAccountReq) => {
    const resp = await this.#request<DashboardStateResp>(
      IDL_ROUTES.RegisterAccount.clientPath,
      {
        method: IDL_ROUTES.RegisterAccount.method,
        body: JSON.stringify(req),
      },
    );
    if (resp.sessionToken) {
      this.setSessionToken(resp.sessionToken);
    }
    return resp;
  };

  loginAccount = async (req: LoginAccountReq) => {
    const resp = await this.#request<DashboardStateResp>(
      IDL_ROUTES.LoginAccount.clientPath,
      {
        method: IDL_ROUTES.LoginAccount.method,
        body: JSON.stringify(req),
      },
    );
    if (resp.sessionToken) {
      this.setSessionToken(resp.sessionToken);
    }
    return resp;
  };

  logoutAccount = async () => {
    try {
      return await this.#request<LogoutAccountResp>(
        IDL_ROUTES.LogoutAccount.clientPath,
        {
          method: IDL_ROUTES.LogoutAccount.method,
          body: JSON.stringify({}),
        },
      );
    } finally {
      this.setSessionToken(null);
    }
  };

  switchAccount = (req: SwitchAccountReq) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.SwitchAccount.clientPath, {
      method: IDL_ROUTES.SwitchAccount.method,
      body: JSON.stringify(req),
    });

  async #mutateRequest(path: string, init: RequestInit): Promise<DashboardStateResp> {
    const token = this.getSessionToken();
    const scopedInit = withIdempotencyHeader(init, generateIdempotencyKey());
    try {
      try {
        return await this.#request<DashboardStateResp>(path, scopedInit);
      } catch (error) {
        if (!(error instanceof TypeError) || this.getSessionToken() !== token) throw error;
        // Exact-once server deduplication on X-Idempotency-Key makes a single transport retry safe.
        return await this.#request<DashboardStateResp>(path, scopedInit);
      }
    } catch (error) {
      if (this.getSessionToken() === token && error instanceof TypeError) {
        const synced = await this.getDashboard();
        return markCommandSyncOutcome(synced, {
          kind: "uncertain",
          message: "网络响应中断，操作结果不确定，已同步最新状态，请核对后再操作",
        });
      }
      throw error;
    }
  }

  gatherWater = (req: GatherWaterReq = {}) =>
    this.#request<DashboardStateResp>(
      IDL_ROUTES.GatherWater.clientPath,
      withIdempotencyHeader(
        {
          method: IDL_ROUTES.GatherWater.method,
          body: JSON.stringify(req),
        },
        generateIdempotencyKey(),
      ),
    );

  recruitResident = (req: RecruitResidentReq = {}) =>
    this.#mutateRequest(IDL_ROUTES.RecruitResident.clientPath, {
      method: IDL_ROUTES.RecruitResident.method,
      body: JSON.stringify(req),
    });

  allocateWorkers = (req: AllocateWorkersReq) =>
    this.#mutateRequest(IDL_ROUTES.AllocateWorkers.clientPath, {
      method: IDL_ROUTES.AllocateWorkers.method,
      body: JSON.stringify(req),
    });

  saveAllocationPreset = (req: SaveAllocationPresetReq) =>
    this.#mutateRequest(IDL_ROUTES.SaveAllocationPreset.clientPath, {
      method: IDL_ROUTES.SaveAllocationPreset.method,
      body: JSON.stringify(req),
    });

  async #settlementRequest(path: string, init: RequestInit): Promise<DashboardStateResp> {
    const token = this.getSessionToken();
    const scopedInit = withIdempotencyHeader(init, generateIdempotencyKey());
    let retriedAfterTransportError = false;
    try {
      try { return await this.#request<DashboardStateResp>(path, scopedInit); }
      catch (error) {
        if (!(error instanceof TypeError) || this.getSessionToken() !== token) throw error;
        retriedAfterTransportError = true;
        return await this.#request<DashboardStateResp>(path, scopedInit);
      }
    } catch (error) {
      if (this.getSessionToken() === token) {
        if (error instanceof ApiError && error.code === "settlement_sequence_conflict") {
          const synced = await this.getDashboard();
          return markCommandSyncOutcome(
            synced,
            retriedAfterTransportError
              ? {
                  kind: "uncertain",
                  message: "网络重试期间页面状态已推进，操作结果不确定，已同步最新状态，请核对后再操作",
                }
              : {
                  kind: "conflict",
                  code: error.code,
                  message: `${error.message || "页面状态已变化"}（原操作未执行，已同步最新状态，请确认后重试）`,
                },
          );
        }
        if (error instanceof TypeError) {
          const synced = await this.getDashboard();
          return markCommandSyncOutcome(synced, {
            kind: "uncertain",
            message: "网络响应中断，操作结果不确定，已同步最新状态，请核对后再操作",
          });
        }
      }
      throw error;
    }
  }

  economyAction = (req: EconomyActionReq) => this.#settlementRequest(IDL_ROUTES.EconomyAction.clientPath, { method: IDL_ROUTES.EconomyAction.method, body: JSON.stringify(req) });
  monetaryPolicy = (req: MonetaryPolicyReq) => this.#mutateRequest(IDL_ROUTES.MonetaryPolicy.clientPath, { method: IDL_ROUTES.MonetaryPolicy.method, body: JSON.stringify(req) });
  introduceCompany = (req: IntroduceCompanyReq) => this.#mutateRequest(IDL_ROUTES.IntroduceCompany.clientPath, { method: IDL_ROUTES.IntroduceCompany.method, body: JSON.stringify(req) });

  researchTechnology = (req: ResearchTechnologyReq) =>
    this.#settlementRequest(IDL_ROUTES.ResearchTechnology.clientPath, {
      method: IDL_ROUTES.ResearchTechnology.method, body: JSON.stringify(req),
    });

  constructBuilding = (req: ConstructBuildingReq) =>
    this.#settlementRequest(IDL_ROUTES.ConstructBuilding.clientPath, {
      method: IDL_ROUTES.ConstructBuilding.method, body: JSON.stringify(req),
    });

  unlockBlueprint = (req: UnlockBlueprintReq) =>
    this.#mutateRequest(IDL_ROUTES.UnlockBlueprint.clientPath, {
      method: IDL_ROUTES.UnlockBlueprint.method,
      body: JSON.stringify(req),
    });

  toggleEdict = (req: ToggleEdictReq) =>
    this.#mutateRequest(IDL_ROUTES.ToggleEdict.clientPath, {
      method: IDL_ROUTES.ToggleEdict.method,
      body: JSON.stringify(req),
    });

  dispatchExpedition = (req: DispatchExpeditionReq) =>
    this.#mutateRequest(IDL_ROUTES.DispatchExpedition.clientPath, {
      method: IDL_ROUTES.DispatchExpedition.method,
      body: JSON.stringify(req),
    });

  claimExpedition = () =>
    this.#mutateRequest(IDL_ROUTES.ClaimExpedition.clientPath, {
      method: IDL_ROUTES.ClaimExpedition.method,
      body: JSON.stringify({}),
    });

  tradeCaravan = (req: TradeCaravanReq) =>
    this.#mutateRequest(IDL_ROUTES.TradeCaravan.clientPath, {
      method: IDL_ROUTES.TradeCaravan.method,
      body: JSON.stringify(req),
    });

  equipCosmetic = (req: EquipCosmeticReq) =>
    this.#mutateRequest(IDL_ROUTES.EquipCosmetic.clientPath, {
      method: IDL_ROUTES.EquipCosmetic.method,
      body: JSON.stringify(req),
    });

  learnRaidBlueprint = (req: LearnRaidBlueprintReq) =>
    this.#mutateRequest(IDL_ROUTES.LearnRaidBlueprint.clientPath, {
      method: IDL_ROUTES.LearnRaidBlueprint.method,
      body: JSON.stringify(req),
    });

  manageRaidGear = (req: ManageRaidGearReq) =>
    this.#mutateRequest(IDL_ROUTES.ManageRaidGear.clientPath, {
      method: IDL_ROUTES.ManageRaidGear.method,
      body: JSON.stringify(req),
    });

  draftRaidBuff = (req: DraftRaidBuffReq) =>
    this.#mutateRequest(IDL_ROUTES.DraftRaidBuff.clientPath, {
      method: IDL_ROUTES.DraftRaidBuff.method,
      body: JSON.stringify(req),
    });

  startRaid = () =>
    this.#mutateRequest(IDL_ROUTES.StartRaid.clientPath, {
      method: IDL_ROUTES.StartRaid.method,
      body: JSON.stringify({}),
    });

  async #raidRequest(path: string, init: RequestInit): Promise<RaidUpdateResp | DashboardStateResp> {
    const token = this.getSessionToken();
    const scopedInit = withIdempotencyHeader(init, generateIdempotencyKey());
    let update: RaidUpdateResp;
    let retriedAfterTransportError = false;
    try {
      try {
        update = await this.#request<RaidUpdateResp>(path, scopedInit);
      } catch (error) {
        if (!(error instanceof TypeError) || this.getSessionToken() !== token) throw error;
        retriedAfterTransportError = true;
        update = await this.#request<RaidUpdateResp>(path, scopedInit);
      }
    } catch (error) {
      if (this.getSessionToken() === token) {
        if (
          error instanceof ApiError &&
          ["raid_sequence_conflict", "stale_raid"].includes(error.code)
        ) {
          const synced = await this.getDashboard();
          return markCommandSyncOutcome(
            synced,
            retriedAfterTransportError
              ? {
                  kind: "uncertain",
                  message: "网络重试期间远征状态已推进，远征指令结果不确定，已同步最新状态",
                }
              : {
                  kind: "conflict",
                  code: error.code,
                  message: `${error.message || "远征状态已变化"}（原指令未执行，已同步最新状态，请确认后重试）`,
                },
          );
        }
        if (error instanceof TypeError) {
          const synced = await this.getDashboard();
          return markCommandSyncOutcome(synced, {
            kind: "uncertain",
            message: "网络响应中断，远征指令结果不确定，已同步最新状态",
          });
        }
      }
      throw error;
    }
    // Refresh settlement inventory once at the terminal transition, never per step.
    if (!update.raidLoadout.activeSession && this.getSessionToken() === token) {
      try {
        return await this.getDashboard();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) throw error;
        // The finish already committed. Keep that receipt even if the refresh
        // fails; normal settlement polling will recover the rest of the state.
        return update;
      }
    }
    return update;
  }

  raidAction = (req: RaidActionReq) =>
    this.#raidRequest(IDL_ROUTES.RaidAction.clientPath, {
      method: IDL_ROUTES.RaidAction.method,
      body: JSON.stringify(req),
    });

  finishRaid = (req: FinishRaidReq) =>
    this.#raidRequest(IDL_ROUTES.FinishRaid.clientPath, {
      method: IDL_ROUTES.FinishRaid.method,
      body: JSON.stringify(req),
    });

  chooseProfession = (req: ChooseProfessionReq) =>
    this.#mutateRequest(IDL_ROUTES.ChooseProfession.clientPath, {
      method: IDL_ROUTES.ChooseProfession.method,
      body: JSON.stringify(req),
    });

  craftItem = (req: CraftItemReq) =>
    this.#mutateRequest(IDL_ROUTES.CraftItem.clientPath, {
      method: IDL_ROUTES.CraftItem.method,
      body: JSON.stringify(req),
    });

  installEquipment = (req: InstallEquipmentReq) =>
    this.#mutateRequest(IDL_ROUTES.InstallEquipment.clientPath, {
      method: IDL_ROUTES.InstallEquipment.method,
      body: JSON.stringify(req),
    });

  placeMarketOrder = (req: PlaceMarketOrderReq) =>
    this.#mutateRequest(IDL_ROUTES.PlaceMarketOrder.clientPath, {
      method: IDL_ROUTES.PlaceMarketOrder.method,
      body: JSON.stringify(req),
    });

  cancelMarketOrder = (id: string) =>
    this.#mutateRequest(routePath(IDL_ROUTES.CancelMarketOrder, { id }), {
      method: IDL_ROUTES.CancelMarketOrder.method,
      body: JSON.stringify({}),
    });

  switchGuild = (req: SwitchGuildReq) =>
    this.#mutateRequest(IDL_ROUTES.SwitchGuild.clientPath, {
      method: IDL_ROUTES.SwitchGuild.method,
      body: JSON.stringify(req),
    });

  guildAction = (req: GuildActionReq) =>
    this.#mutateRequest(IDL_ROUTES.GuildAction.clientPath, {
      method: IDL_ROUTES.GuildAction.method,
      body: JSON.stringify(req),
    });

  deployWarTroops = (req: DeployWarTroopsReq) =>
    this.#mutateRequest(IDL_ROUTES.DeployWarTroops.clientPath, {
      method: IDL_ROUTES.DeployWarTroops.method,
      body: JSON.stringify(req),
    });

  triggerWarSettlement = () =>
    this.#mutateRequest(IDL_ROUTES.TriggerWarSettlement.clientPath, {
      method: IDL_ROUTES.TriggerWarSettlement.method,
      body: JSON.stringify({}),
    });

  redeemSeasonChest = (req: RedeemSeasonChestReq) =>
    this.#mutateRequest(IDL_ROUTES.RedeemSeasonChest.clientPath, {
      method: IDL_ROUTES.RedeemSeasonChest.method,
      body: JSON.stringify(req),
    });

  openSeasonChest = (req: OpenSeasonChestReq = {}) =>
    this.#mutateRequest(IDL_ROUTES.OpenSeasonChest.clientPath, {
      method: IDL_ROUTES.OpenSeasonChest.method,
      body: JSON.stringify(req),
    });

  controlSimulation = (req: ControlSimulationReq) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.ControlSimulation.clientPath, {
      method: IDL_ROUTES.ControlSimulation.method,
      body: JSON.stringify(req),
    });

  runBenchmark30m = () =>
    this.#request<Benchmark30mResp>(IDL_ROUTES.RunBenchmark30m.clientPath, {
      method: IDL_ROUTES.RunBenchmark30m.method,
      body: JSON.stringify({}),
    });

  createInvite = () =>
    this.#request<DashboardStateResp>(IDL_ROUTES.CreateInvite.clientPath, {
      method: IDL_ROUTES.CreateInvite.method,
      body: JSON.stringify({}),
    });

  revokeInvite = (id: string) =>
    this.#request<DashboardStateResp>(
      routePath(IDL_ROUTES.RevokeInvite, { id }),
      {
        method: IDL_ROUTES.RevokeInvite.method,
        body: JSON.stringify({}),
      },
    );

  rolloverSeason = (req: RolloverSeasonReq = {}) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.RolloverSeason.clientPath, {
      method: IDL_ROUTES.RolloverSeason.method,
      body: JSON.stringify(req),
    });

  publishNotice = (req: PublishNoticeReq) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.PublishNotice.clientPath, {
      method: IDL_ROUTES.PublishNotice.method,
      body: JSON.stringify(req),
    });
}

export const api = new EmpireClient();
