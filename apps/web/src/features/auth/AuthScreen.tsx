import { useMemo, useState } from "react";
import { api } from "@drop2empire/api-client";
import { Moon, Sun } from "lucide-react";
import { ICON } from "../../icons";
import type { ThemeMode } from "../../theme";
import type { ServerUpdate } from "../../serverState";

type AuthMode = "login" | "register";

interface AuthScreenProps {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  errorBanner: string | null;
  setErrorBanner: (msg: string | null) => void;
  runAction: (fn: () => Promise<ServerUpdate>, successMsg?: string) => Promise<void>;
}

export function AuthScreen({
  theme,
  setTheme,
  errorBanner,
  setErrorBanner,
  runAction,
}: AuthScreenProps) {
  const initialInviteCode = useMemo(() => {
    if (typeof window === "undefined") return "";
    return (
      new URLSearchParams(window.location.search).get("invite")?.trim() ?? ""
    );
  }, []);
  const [authMode, setAuthMode] = useState<AuthMode>(() =>
    initialInviteCode ? "register" : "login",
  );
  const [authHandle, setAuthHandle] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authInviteCode, setAuthInviteCode] = useState(initialInviteCode);

  return (
    <div className="auth-shell">
      <div className="corner-utility-bar">
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
      </div>

      <section className="auth-card" aria-label="登录或注册">
        <div className="brand-cluster">
          <div className="brand-emblem">D2E</div>
          <div className="brand-titles">
            <div className="brand-main">
              <span>滴水成城</span>
              <span className="brand-sub">DROP TO EMPIRE</span>
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

        <div className="side-switch" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={authMode === "login"}
            className={`tab-btn ${authMode === "login" ? "active" : ""}`}
            onClick={() => {
              setAuthMode("login");
              setErrorBanner(null);
            }}
          >
            登录
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={authMode === "register"}
            className={`tab-btn ${authMode === "register" ? "active" : ""}`}
            onClick={() => {
              setAuthMode("register");
              setErrorBanner(null);
            }}
          >
            注册
          </button>
        </div>

        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!authHandle.trim() || !authPassword) return;
            if (authMode === "register" && !authInviteCode.trim()) return;
            void runAction(() =>
              authMode === "register"
                ? api.registerAccount({
                    handle: authHandle.trim(),
                    password: authPassword,
                    inviteCode: authInviteCode.trim(),
                  })
                : api.loginAccount({
                    handle: authHandle.trim(),
                    password: authPassword,
                  }),
            );
          }}
        >
          <label>
            <span>账号</span>
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
          {authMode === "register" && (
            <label>
              <span>邀请码</span>
              <input
                type="text"
                required
                className="mono-num"
                placeholder="d2e-inv-xxxx-xxxx-xxxx"
                value={authInviteCode}
                onChange={(e) => setAuthInviteCode(e.target.value)}
              />
            </label>
          )}
          <button type="submit" className="btn-water-strike btn-block">
            {authMode === "register" ? "注册并进入" : "进入"}
          </button>
        </form>
      </section>
    </div>
  );
}
