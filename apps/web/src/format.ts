export function formatResource(milli: number, decimals = 1): string {
  const val = milli / 1000;
  return val.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatRate(milliPerSec: number): string {
  const val = milliPerSec / 1000;
  const sign = val >= 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}/s`;
}

export function formatGold(basis: number, decimals = 2): string {
  const val = basis / 10000;
  return val.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatETA(seconds: number): string {
  if (seconds === 0) return "已就绪";
  if (seconds < 0) return "需分配产出";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) {
    return `${m}m ${String(s).padStart(2, "0")}s`;
  }
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${String(rm).padStart(2, "0")}m`;
}

export function formatClockMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
