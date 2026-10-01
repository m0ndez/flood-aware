export type Status = "normal" | "watch" | "critical" | "stale";

export const STALE_MS = 3 * 3600_000;
export const NEAR_BANK_PCT = 95;
// ponytail: fixed 5 cm dead band for "steady"; per-station tuning if gauges prove noisier.
export const TREND_EPS_M = 0.05;
const DAY_MS = 24 * 3600_000;
const MIN_SPAN_MS = 40 * 3600_000; // a thin previous window would bias the mean by tide phase

// ThaiWater timestamps are local Thai time (ICT, UTC+7) without an offset.
export function parseIct(datetime: string): number {
  return Date.parse(`${datetime.replace(" ", "T")}:00+07:00`);
}

// Future timestamps happen upstream (RID row stamped 23:00 at 10:30), so they count as stale.
export function isStale(datetime: string, now: number): boolean {
  const t = parseIct(datetime);
  return Number.isNaN(t) || t > now || now - t > STALE_MS;
}

// ThaiWater situation_level: 1-3 normal, 4 high, 5 over bank.
export function statusOf(level: number, datetime: string, now: number): Status {
  if (isStale(datetime, now)) return "stale";
  if (level >= 5) return "critical";
  if (level === 4) return "watch";
  return "normal";
}

export type Trend = "rising" | "falling" | "steady";

// Pak Kret is tidal (about 0.6 m swing a day), so a short delta just reads the tide.
// Compare the mean of the last 24 h with the mean of the 24 h before it instead.
// ponytail: 24 h is not a whole number of tidal cycles (24.8 h); the residual is well under the dead band.
export function trendOf(series: { t: string; v: number }[]): Trend | null {
  const last = series.at(-1);
  if (!last) return null;
  const end = parseIct(last.t);
  if (end - parseIct(series[0].t) < MIN_SPAN_MS) return null;
  const cur: number[] = [];
  const prev: number[] = [];
  for (const p of series) {
    const age = end - parseIct(p.t);
    if (age < DAY_MS) cur.push(p.v);
    else if (age < 2 * DAY_MS) prev.push(p.v);
  }
  if (cur.length === 0 || prev.length === 0) return null;
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const d = mean(cur) - mean(prev);
  return d > TREND_EPS_M ? "rising" : d < -TREND_EPS_M ? "falling" : "steady";
}

// Colour is never the only signal: every status also has its own shape (16x16 path) and a text label.
export const STATUS_STYLE: Record<Status, { color: string; d: string }> = {
  normal: { color: "#15803d", d: "M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1z" },
  watch: { color: "#b45309", d: "M8 1 15 14H1z" },
  critical: { color: "#b91c1c", d: "M8 1l7 7-7 7-7-7z" },
  stale: {
    color: "#6b7280",
    d: "M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 3.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z",
  },
};
