import {
  IDL_ROUTES,
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
} from "./generated";

export * from "./generated";

const SESSION_STORAGE_KEY = "d2e-session-token";

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
  getSessionToken(): string | null {
    try {
      return window.localStorage.getItem(SESSION_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  setSessionToken(token: string | null) {
    try {
      if (token) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors in private mode
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
    return (await response.json()) as T;
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

  gatherWater = (req: GatherWaterReq = {}) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.GatherWater.clientPath, {
      method: IDL_ROUTES.GatherWater.method,
      body: JSON.stringify(req),
    });

  recruitResident = (req: RecruitResidentReq = {}) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.RecruitResident.clientPath, {
      method: IDL_ROUTES.RecruitResident.method,
      body: JSON.stringify(req),
    });

  allocateWorkers = (req: AllocateWorkersReq) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.AllocateWorkers.clientPath, {
      method: IDL_ROUTES.AllocateWorkers.method,
      body: JSON.stringify(req),
    });

  saveAllocationPreset = (req: SaveAllocationPresetReq) =>
    this.#request<DashboardStateResp>(
      IDL_ROUTES.SaveAllocationPreset.clientPath,
      {
        method: IDL_ROUTES.SaveAllocationPreset.method,
        body: JSON.stringify(req),
      },
    );

  unlockBlueprint = (req: UnlockBlueprintReq) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.UnlockBlueprint.clientPath, {
      method: IDL_ROUTES.UnlockBlueprint.method,
      body: JSON.stringify(req),
    });

  toggleEdict = (req: ToggleEdictReq) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.ToggleEdict.clientPath, {
      method: IDL_ROUTES.ToggleEdict.method,
      body: JSON.stringify(req),
    });

  dispatchExpedition = (req: DispatchExpeditionReq) =>
    this.#request<DashboardStateResp>(
      IDL_ROUTES.DispatchExpedition.clientPath,
      {
        method: IDL_ROUTES.DispatchExpedition.method,
        body: JSON.stringify(req),
      },
    );

  claimExpedition = () =>
    this.#request<DashboardStateResp>(IDL_ROUTES.ClaimExpedition.clientPath, {
      method: IDL_ROUTES.ClaimExpedition.method,
      body: JSON.stringify({}),
    });

  tradeCaravan = (req: TradeCaravanReq) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.TradeCaravan.clientPath, {
      method: IDL_ROUTES.TradeCaravan.method,
      body: JSON.stringify(req),
    });

  equipCosmetic = (req: EquipCosmeticReq) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.EquipCosmetic.clientPath, {
      method: IDL_ROUTES.EquipCosmetic.method,
      body: JSON.stringify(req),
    });

  learnRaidBlueprint = (req: LearnRaidBlueprintReq) =>
    this.#request<DashboardStateResp>(
      IDL_ROUTES.LearnRaidBlueprint.clientPath,
      {
        method: IDL_ROUTES.LearnRaidBlueprint.method,
        body: JSON.stringify(req),
      },
    );

  manageRaidGear = (req: ManageRaidGearReq) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.ManageRaidGear.clientPath, {
      method: IDL_ROUTES.ManageRaidGear.method,
      body: JSON.stringify(req),
    });

  draftRaidBuff = (req: DraftRaidBuffReq) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.DraftRaidBuff.clientPath, {
      method: IDL_ROUTES.DraftRaidBuff.method,
      body: JSON.stringify(req),
    });

  startRaid = () =>
    this.#request<DashboardStateResp>(IDL_ROUTES.StartRaid.clientPath, {
      method: IDL_ROUTES.StartRaid.method,
      body: JSON.stringify({}),
    });

  async #raidRequest(path: string, init: RequestInit): Promise<RaidUpdateResp | DashboardStateResp> {
    const token = this.getSessionToken();
    let update: RaidUpdateResp;
    try {
      try {
        update = await this.#request<RaidUpdateResp>(path, init);
      } catch (error) {
        if (!(error instanceof TypeError) || this.getSessionToken() !== token) throw error;
        update = await this.#request<RaidUpdateResp>(path, init);
      }
    } catch (error) {
      const needsResync = error instanceof TypeError ||
        (error instanceof ApiError && ["raid_sequence_conflict", "stale_raid"].includes(error.code));
      if (needsResync && this.getSessionToken() === token) return this.getDashboard();
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
    this.#request<DashboardStateResp>(IDL_ROUTES.ChooseProfession.clientPath, {
      method: IDL_ROUTES.ChooseProfession.method,
      body: JSON.stringify(req),
    });

  craftItem = (req: CraftItemReq) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.CraftItem.clientPath, {
      method: IDL_ROUTES.CraftItem.method,
      body: JSON.stringify(req),
    });

  installEquipment = (req: InstallEquipmentReq) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.InstallEquipment.clientPath, {
      method: IDL_ROUTES.InstallEquipment.method,
      body: JSON.stringify(req),
    });

  placeMarketOrder = (req: PlaceMarketOrderReq) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.PlaceMarketOrder.clientPath, {
      method: IDL_ROUTES.PlaceMarketOrder.method,
      body: JSON.stringify(req),
    });

  cancelMarketOrder = (id: string) =>
    this.#request<DashboardStateResp>(
      routePath(IDL_ROUTES.CancelMarketOrder, { id }),
      {
        method: IDL_ROUTES.CancelMarketOrder.method,
        body: JSON.stringify({}),
      },
    );

  switchGuild = (req: SwitchGuildReq) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.SwitchGuild.clientPath, {
      method: IDL_ROUTES.SwitchGuild.method,
      body: JSON.stringify(req),
    });

  guildAction = (req: GuildActionReq) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.GuildAction.clientPath, {
      method: IDL_ROUTES.GuildAction.method,
      body: JSON.stringify(req),
    });

  deployWarTroops = (req: DeployWarTroopsReq) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.DeployWarTroops.clientPath, {
      method: IDL_ROUTES.DeployWarTroops.method,
      body: JSON.stringify(req),
    });

  triggerWarSettlement = () =>
    this.#request<DashboardStateResp>(
      IDL_ROUTES.TriggerWarSettlement.clientPath,
      {
        method: IDL_ROUTES.TriggerWarSettlement.method,
        body: JSON.stringify({}),
      },
    );

  redeemSeasonChest = (req: RedeemSeasonChestReq) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.RedeemSeasonChest.clientPath, {
      method: IDL_ROUTES.RedeemSeasonChest.method,
      body: JSON.stringify(req),
    });

  openSeasonChest = (req: OpenSeasonChestReq = {}) =>
    this.#request<DashboardStateResp>(IDL_ROUTES.OpenSeasonChest.clientPath, {
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
