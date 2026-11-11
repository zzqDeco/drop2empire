import { EconomyAdmin } from "./EconomyAdmin";
import { useEffect, useState } from "react";
import {
  api,
  type Benchmark30mResp,
  type DashboardStateResp,
} from "@drop2empire/api-client";
import {
  Activity,
  Award,
  FastForward,
  LogOut,
  Moon,
  Play,
  Plus,
  RefreshCw,
  Scale,
  Sparkles,
  Sun,
  Swords,
  UserCheck,
  Users,
} from "lucide-react";
import { ICON } from "./icons";
import { type ThemeMode } from "./theme";
import { formatClockMMSS, formatGold } from "./format";
import { ConfirmActionModal, ModalShell } from "./components/ModalShell";
import { resolvePublicPlayerOrigin } from "./domain/settlementSelectors";
import type { ServerUpdate } from "./serverState";

const PUBLIC_ORIGIN_STORAGE_KEY = "d2e_public_origin";

function getInitialPublicOriginInput(): string {
  const envOrigin = (import.meta.env.VITE_PUBLIC_ORIGIN ?? "").trim();
  if (typeof window !== "undefined") {
    try {
      const saved = window.localStorage
        .getItem(PUBLIC_ORIGIN_STORAGE_KEY)
        ?.trim();
      if (saved) return saved;
    } catch {
      // Ignore localStorage access errors
    }
    if (envOrigin) return envOrigin;
    return resolvePublicPlayerOrigin("", window.location);
  }
  return envOrigin;
}

export function AdminConsoleView({
  state,
  busy,
  theme,
  setTheme,
  errorBanner,
  noticeBanner,
  setErrorBanner,
  setNoticeBanner,
  runAction,
  handleLogout,
}: {
  state: DashboardStateResp | null;
  busy: boolean;
  theme: ThemeMode;
  setTheme: (m: ThemeMode) => void;
  errorBanner: string | null;
  noticeBanner: string | null;
  setErrorBanner: (msg: string | null) => void;
  setNoticeBanner: (msg: string | null) => void;
  runAction: (
    fn: () => Promise<ServerUpdate>,
    successMsg?: string,
    scope?: string,
  ) => Promise<void>;
  handleLogout: () => Promise<void>;
}) {
  const [authHandle, setAuthHandle] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [customHandleInput, setCustomHandleInput] = useState("");
  const [nextSeasonTitle, setNextSeasonTitle] = useState("");
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeEffectiveIn, setNoticeEffectiveIn] = useState("即时生效");
  const [noticeSummary, setNoticeSummary] = useState("");
  const [noticeShiftsText, setNoticeShiftsText] = useState("");
  const [benchmarkData, setBenchmarkData] = useState<Benchmark30mResp | null>(
    null,
  );
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmRolloverOpen, setConfirmRolloverOpen] = useState(false);
  const [publicOriginInput, setPublicOriginInput] = useState<string>(() =>
    getInitialPublicOriginInput(),
  );

  useEffect(() => {
    if (!state) return;
    setCustomHandleInput((cur) => {
      if (!cur || !state.availableHandles.includes(cur)) {
        return state.player.handle;
      }
      return cur;
    });
  }, [state]);

  if (!state || !state.player.isAdmin) {
    return (
      <div className="auth-shell">
        <section className="auth-card" aria-label="管理员登录">
          <div className="brand-cluster">
            <div className="brand-emblem">GM</div>
            <div className="brand-titles">
              <div className="brand-main">
                <span>后台登录</span>
              </div>
            </div>
          </div>

          {errorBanner && (
            <div className="status-banner status-danger" role="alert">
              <span>{errorBanner}</span>
              <button
                type="button"
                className="banner-close"
                onClick={() => setErrorBanner(null)}
              >
                ×
              </button>
            </div>
          )}

          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!authHandle.trim() || !authPassword) return;
              void runAction(() =>
                api.loginAccount({
                  handle: authHandle.trim(),
                  password: authPassword,
                }),
              );
            }}
          >
            <label>
              <span>管理员账号</span>
              <input
                type="text"
                required
                value={authHandle}
                onChange={(e) => setAuthHandle(e.target.value)}
              />
            </label>
            <label>
              <span>密码</span>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="btn-primary btn-block"
              disabled={busy}
            >
              登录后台
            </button>
          </form>
        </section>
      </div>
    );
  }

  const targetAccount = customHandleInput.trim() || state.player.handle;
  const currentSeasonCode = `S${state.currentSeason?.seasonNumber ?? 1}`;
  const publicPlayerOrigin = resolvePublicPlayerOrigin(
    publicOriginInput,
    typeof window !== "undefined" ? window.location : undefined,
  );

  const copyToClipboard = (text: string, msg: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).then(
        () => setNoticeBanner(msg),
        () => setNoticeBanner(`请手动复制：${text}`),
      );
    } else {
      setNoticeBanner(`请手动复制：${text}`);
    }
  };

  const handleOpenBenchmark = async () => {
    setErrorBanner(null);
    try {
      const res = await api.runBenchmark30m();
      setBenchmarkData(res);
      setShowBenchmarkModal(true);
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : "模拟失败");
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-cluster">
          <div className="brand-emblem">GM</div>
          <div className="brand-titles">
            <div className="brand-main">
              <span>管理后台</span>
              <span className="brand-sub">ADMIN</span>
            </div>
          </div>
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="btn-icon"
            aria-label="切换主题"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? (
              <Moon size={ICON.sm} />
            ) : (
              <Sun size={ICON.sm} />
            )}
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() => void handleLogout()}
          >
            <LogOut size={ICON.xs} />
            <span>退出</span>
          </button>
        </div>
      </header>

      {(errorBanner || noticeBanner) && (
        <div
          className={`status-banner ${errorBanner ? "status-danger" : "status-info"}`}
          role="status"
        >
          <span>{errorBanner || noticeBanner}</span>
          <button
            type="button"
            className="banner-close"
            onClick={() => {
              setErrorBanner(null);
              setNoticeBanner(null);
            }}
          >
            ×
          </button>
        </div>
      )}

      <main className="admin-console-wrap">
        <EconomyAdmin state={state} busy={busy} runAction={runAction} />
        <section className="admin-toolbar" aria-label="沙盒控制">
          <div className="workspace-quick-ops">
            <div className="account-switcher">
              <Users size={ICON.xs} />
              <select
                aria-label="目标账号"
                value={targetAccount}
                onChange={(e) => setCustomHandleInput(e.target.value)}
              >
                {state.availableHandles.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <form
              className="new-account-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!targetAccount) return;
                void runAction(() =>
                  api.switchAccount({ handle: targetAccount }),
                );
              }}
            >
              <input
                type="text"
                placeholder="账号名..."
                value={customHandleInput}
                onChange={(e) => setCustomHandleInput(e.target.value)}
              />
              <button type="submit" className="btn-outline">
                切换
              </button>
            </form>

            <div className="speed-group" role="group" aria-label="倍速">
              {[1, 10, 60, 300].map((mult) => (
                <button
                  key={mult}
                  type="button"
                  className={`btn-chip mono-num ${state.player.speedMultiplier === mult ? "active" : ""}`}
                  onClick={() =>
                    void runAction(() =>
                      api.controlSimulation({
                        action: "set_speed",
                        speedMultiplier: mult,
                        targetHandle: targetAccount,
                      }),
                    )
                  }
                >
                  {mult}x
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn-outline"
              onClick={() =>
                void runAction(() =>
                  api.controlSimulation({
                    action: "fast_forward",
                    advanceSeconds: 60,
                    targetHandle: targetAccount,
                  }),
                )
              }
            >
              <FastForward size={ICON.xs} />
              <span className="mono-num">
                +60s ({formatClockMMSS(state.player.simulatedElapsedSeconds)})
              </span>
            </button>

            <button
              type="button"
              className="btn-outline"
              onClick={() =>
                void runAction(() =>
                  api.controlSimulation({
                    action: "unlock_treasure_ready",
                    targetHandle: targetAccount,
                  }),
                )
              }
            >
              <Sparkles size={ICON.xs} />
              <span>直达宝藏</span>
            </button>

            <button
              type="button"
              className="btn-outline"
              onClick={() => setConfirmResetOpen(true)}
            >
              <RefreshCw size={ICON.xs} />
              <span>重置账号</span>
            </button>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={() => void handleOpenBenchmark()}
          >
            <Activity size={ICON.xs} />
            <span>30m 数值模拟</span>
          </button>
        </section>

        <section className="subpanel" aria-label="邀请码管理">
          <div className="subpanel-head">
            <h3>
              <UserCheck size={ICON.sm} />
              <span>注册邀请码（一码一用 · 7 天有效）</span>
            </h3>
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={busy}
              onClick={() =>
                void runAction(
                  () => api.createInvite(),
                  "已生成新邀请码（仅明文展示一次，可使用右侧快捷复制）",
                )
              }
            >
              <Plus size={ICON.xs} />
              <span>生成邀请码</span>
            </button>
          </div>

          {state.createdInviteCode && (
            <div className="status-banner status-info">
              <span>
                新生成邀请码：
                <strong className="mono-num"> {state.createdInviteCode}</strong>
              </span>
              <div className="invite-link-controls">
                <input
                  type="url"
                  className="mono-num"
                  aria-label="玩家公网入口地址"
                  placeholder="https://公网域名或IP:8443"
                  value={publicOriginInput}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPublicOriginInput(next);
                    try {
                      if (next.trim()) {
                        window.localStorage.setItem(
                          PUBLIC_ORIGIN_STORAGE_KEY,
                          next.trim(),
                        );
                      } else {
                        window.localStorage.removeItem(
                          PUBLIC_ORIGIN_STORAGE_KEY,
                        );
                      }
                    } catch {
                      // Ignore storage quota / privacy mode errors
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() =>
                    copyToClipboard(
                      state.createdInviteCode!,
                      "已复制邀请码至剪贴板",
                    )
                  }
                >
                  复制邀请码
                </button>
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  disabled={!publicPlayerOrigin}
                  title={
                    publicPlayerOrigin
                      ? `${publicPlayerOrigin}/?invite=${encodeURIComponent(state.createdInviteCode)}`
                      : "请先填写非回环的玩家公网入口地址（如 https://120.25.210.202:8443）"
                  }
                  onClick={() => {
                    if (!publicPlayerOrigin) return;
                    copyToClipboard(
                      `${publicPlayerOrigin}/?invite=${encodeURIComponent(state.createdInviteCode!)}`,
                      "已复制专属邀请注册链接",
                    );
                  }}
                >
                  复制注册链接
                </button>
              </div>
            </div>
          )}

          <div className="table-scroll">
            <table className="ink-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>掩码</th>
                  <th>状态</th>
                  <th>使用者</th>
                  <th>过期时间</th>
                  <th className="num-col">操作</th>
                </tr>
              </thead>
              <tbody>
                {(state.invites ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      暂无邀请码，点击右上角生成
                    </td>
                  </tr>
                ) : (
                  (state.invites ?? []).map((inv) => {
                    const isUsed = Boolean(inv.usedAt);
                    const isRevoked = Boolean(inv.revokedAt);
                    return (
                      <tr key={inv.id}>
                        <td className="mono-num">{inv.id}</td>
                        <td className="mono-num">{inv.codePreview}</td>
                        <td>
                          <span
                            className={`tag-badge ${
                              isUsed
                                ? "tag-success"
                                : isRevoked
                                  ? "tag-warning"
                                  : ""
                            }`}
                          >
                            {isUsed
                              ? "已使用"
                              : isRevoked
                                ? "已吊销"
                                : "可使用"}
                          </span>
                        </td>
                        <td className="mono-num">{inv.usedBy ?? "-"}</td>
                        <td className="mono-num">
                          {inv.expiresAt.slice(0, 10)}
                        </td>
                        <td className="num-col">
                          {!isUsed && !isRevoked ? (
                            <button
                              type="button"
                              className="btn-outline btn-sm"
                              disabled={busy}
                              onClick={() =>
                                void runAction(() => api.revokeInvite(inv.id))
                              }
                            >
                              吊销
                            </button>
                          ) : (
                            <span className="mono-num">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="split-3col">
          <section className="subpanel" aria-label="货币审计">
            <div className="subpanel-head">
              <h3>
                <Scale size={ICON.sm} />
                <span>货币存量 M(t)</span>
              </h3>
            </div>
            <div className="ledger-audit-box mono-num">
              <div className="ledger-row">
                <span>净发行量</span>
                <strong>
                  {formatGold(state.macroLedger.totalIssuedBasis, 4)} G
                </strong>
              </div>
              <div className="ledger-row">
                <span>玩家持有</span>
                <span>{formatGold(state.macroLedger.playerHeldBasis, 4)} G</span>
              </div>
              <div className="ledger-row">
                <span>玩家挂单托管</span>
                <span>{formatGold(state.macroLedger.escrowFrozenBasis, 4)} G</span>
              </div>
              <div className="ledger-row">
                <span>NPC 账户</span>
                <span>{formatGold(state.macroLedger.npcHeldBasis, 4)} G</span>
              </div>
              <div className="ledger-row">
                <span>财政余额</span>
                <span>{formatGold(state.macroLedger.treasuryHeldBasis, 4)} G</span>
              </div>
              <div className="ledger-row">
                <span>联盟准备金</span>
                <span>{formatGold(state.economy.reserveBasis, 4)} G</span>
              </div>
              <div className="ledger-row">
                <span>公共采购（含托管）</span>
                <span>{formatGold(state.economy.publicCashBasis, 4)} G</span>
              </div>
              <div className="ledger-row">
                <span>公司资金（含托管）</span>
                <span>{formatGold(state.economy.corporateCashBasis, 4)} G</span>
              </div>
              <div className="ledger-row">
                <span>IPO 认购托管</span>
                <span>{formatGold(state.economy.ipoEscrowBasis, 4)} G</span>
              </div>
              <hr className="ink-divider" />
              <div className="ledger-row">
                <span>联盟累计注销</span>
                <strong className="cost-lack">
                  {formatGold(state.economy.cancelledBasis, 4)} G
                </strong>
              </div>
            </div>
          </section>

          <section className="subpanel" aria-label="战争结算">
            <div className="subpanel-head">
              <h3>
                <Swords size={ICON.sm} />
                <span>商会战争结算</span>
              </h3>
            </div>
            <div className="ledger-audit-box">
              <div className="ledger-row mono-num">
                <span>当前进度</span>
                <strong>D{state.war.currentDay} / 7</strong>
              </div>
              <div className="ledger-row mono-num">
                <span>黑曜 : 白银</span>
                <strong>
                  {state.war.obsidianTotalScore} : {state.war.argentTotalScore}
                </strong>
              </div>
              <div className="settle-trigger-box">
                <button
                  type="button"
                  className="btn-water-strike btn-block"
                  disabled={busy}
                  onClick={() =>
                    void runAction(() => api.triggerWarSettlement())
                  }
                >
                  <Play size={ICON.sm} />
                  <span>执行 20:00 结算</span>
                </button>
              </div>
            </div>
          </section>

          <section className="subpanel" aria-label="赛季轮换">
            <div className="subpanel-head">
              <h3>
                <Award size={ICON.sm} />
                <span>赛季纪元轮换</span>
              </h3>
            </div>
            <div className="ledger-audit-box">
              <div className="ledger-row mono-num">
                <span>当前赛季</span>
                <strong>
                  {currentSeasonCode} ·{" "}
                  {state.currentSeason?.title ?? state.war.seasonName}
                </strong>
              </div>
              <form
                className="new-account-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  setConfirmRolloverOpen(true);
                }}
              >
                <input
                  type="text"
                  placeholder="新赛季标题 (选填)..."
                  value={nextSeasonTitle}
                  onChange={(e) => setNextSeasonTitle(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn-primary btn-sm"
                  disabled={busy}
                >
                  开启新赛季
                </button>
              </form>
            </div>
          </section>
        </div>

        <section className="subpanel" aria-label="帝国公告发布">
          <div className="subpanel-head">
            <h3>
              <Sparkles size={ICON.sm} />
              <span>帝国公告与赛季动向发布（控制全服公告节奏）</span>
            </h3>
            <span className="tag-badge mono-num">
              已发布 {state.seasonNotices.length} 条
            </span>
          </div>

          <div className="split-2col">
            <form
              className="order-ticket admin-notice-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!noticeTitle.trim() || !noticeSummary.trim()) return;
                const shifts = noticeShiftsText
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean);
                void runAction(
                  () =>
                    api.publishNotice({
                      title: noticeTitle.trim(),
                      effectiveIn: noticeEffectiveIn.trim() || "即时生效",
                      summary: noticeSummary.trim(),
                      demandShifts: shifts,
                    }),
                  "已向全服发布新帝国公告",
                );
                setNoticeTitle("");
                setNoticeSummary("");
                setNoticeShiftsText("");
              }}
            >
              <div className="form-row-2">
                <label>
                  <span>公告标题</span>
                  <input
                    type="text"
                    placeholder="如：S1 中期战备动员令..."
                    value={noticeTitle}
                    onChange={(e) => setNoticeTitle(e.target.value)}
                  />
                </label>
                <label>
                  <span>生效周期标签</span>
                  <input
                    type="text"
                    placeholder="如：即时生效 / D4 开启"
                    value={noticeEffectiveIn}
                    onChange={(e) => setNoticeEffectiveIn(e.target.value)}
                  />
                </label>
              </div>
              <label>
                <span>公告正文摘要</span>
                <input
                  type="text"
                  placeholder="阐述当前赛季演进节奏、宏观经济或战区动向..."
                  value={noticeSummary}
                  onChange={(e) => setNoticeSummary(e.target.value)}
                />
              </label>
              <label>
                <span>物价与需求变动条目（每行一条，选填）</span>
                <textarea
                  rows={3}
                  placeholder={
                    "如：骑兵军备箱需求上升 +25%\n精铁锭商会收购价上调 +10%"
                  }
                  value={noticeShiftsText}
                  onChange={(e) => setNoticeShiftsText(e.target.value)}
                />
              </label>
              <button
                type="submit"
                className="btn-primary btn-block"
                disabled={busy || !noticeTitle.trim() || !noticeSummary.trim()}
              >
                发布全服帝国公告
              </button>
            </form>

            <div className="notice-stack">
              {state.seasonNotices.map((sn) => (
                <article key={sn.seasonId} className="season-notice-card">
                  <div className="bp-top">
                    <strong>{sn.title}</strong>
                    <span className="tag-badge">{sn.effectiveIn}</span>
                  </div>
                  <p>{sn.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      {showBenchmarkModal && benchmarkData && (
        <ModalShell
          ariaLabel="30m 数值模拟"
          onClose={() => setShowBenchmarkModal(false)}
        >
          <div className="modal-header">
            <div>
              <h2>30m 数值模拟</h2>
              <p>{benchmarkData.note}</p>
            </div>
            <button
              type="button"
              className="btn-outline"
              onClick={() => setShowBenchmarkModal(false)}
            >
              关闭
            </button>
          </div>
          <div className="benchmark-grid">
            {benchmarkData.runs.map((run) => (
              <div key={run.strategyCode} className="benchmark-col">
                <div className="benchmark-col-head">
                  <h3>{run.strategyName}</h3>
                  <span className="tag-badge tag-warning mono-num">
                    {run.formattedTotal}
                  </span>
                </div>
                <p className="bp-desc">{run.description}</p>
                <table className="ink-table">
                  <thead>
                    <tr>
                      <th>节点</th>
                      <th className="num-col">时间</th>
                      <th className="num-col">人口</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.milestones.map((m) => (
                      <tr key={m.code}>
                        <td>
                          <strong>{m.name}</strong>
                        </td>
                        <td className="num-col mono-num">{m.formattedTime}</td>
                        <td className="num-col mono-num">{m.population}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </ModalShell>
      )}

      {confirmResetOpen && (
        <ConfirmActionModal
          title={`确认重置目标玩家「${targetAccount}」？`}
          subtitle="将清空该账号本赛季聚落建筑、物资库存、职业与活跃远征状态"
          severity="danger"
          consequences={[
            `目标账号「${targetAccount}」将退回人口 0 的干涸荒原起点。`,
            "跨赛季永久藏品与已绑定账号身份保留，本季常规进度全部清零。",
          ]}
          requireMatchText={targetAccount}
          requireMatchHint={`请输入目标账号名「${targetAccount}」以确认重置：`}
          confirmLabel={`确认重置 ${targetAccount}`}
          busy={busy}
          onCancel={() => setConfirmResetOpen(false)}
          onConfirm={() => {
            setConfirmResetOpen(false);
            void runAction(
              () =>
                api.controlSimulation({
                  action: "reset_player",
                  targetHandle: targetAccount,
                }),
              `已重置账号「${targetAccount}」本季状态`,
            );
          }}
        />
      )}

      {confirmRolloverOpen && (
        <ConfirmActionModal
          title="确认触发全服跨赛季纪元轮换结算？"
          subtitle={`即将结算当前赛季 ${currentSeasonCode} 并开启下一纪元${nextSeasonTitle.trim() ? `「${nextSeasonTitle.trim()}」` : ""}`}
          severity="danger"
          consequences={[
            "全服所有玩家的聚落人口、建筑、常规物资、职业与市场挂单将执行跨赛季重置。",
            "中央央行货币账本与八城战区积分将按新赛季初始基准重建。",
            "全服玩家的赛季限定外观（cos_*）与唯一编号秘宝藏品将 100% 永久保留。",
          ]}
          requireMatchText={currentSeasonCode}
          requireMatchHint={`请输入当前赛季代号「${currentSeasonCode}」以确认轮换：`}
          confirmLabel="确认执行全服跨赛季轮换"
          busy={busy}
          onCancel={() => setConfirmRolloverOpen(false)}
          onConfirm={() => {
            const titleArg = nextSeasonTitle.trim() || undefined;
            setConfirmRolloverOpen(false);
            setNextSeasonTitle("");
            void runAction(
              () => api.rolloverSeason({ nextTitle: titleArg }),
              "已完成跨赛季结算！聚落与宏观经济已重置，赛季限定外观与藏品永久保留。",
            );
          }}
        />
      )}
    </div>
  );
}

export default AdminConsoleView;
