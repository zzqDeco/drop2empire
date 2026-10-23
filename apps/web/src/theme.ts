export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "d2e_theme_mode";

export function getInitialTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return "light";
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document !== "undefined") {
    if (mode === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
}
