import type { Status } from "./status.ts";

export type Counts = Record<Status, number>;

// Worst first. A stale gauge ranks above a confirmed-normal one: not knowing is worse than knowing it is fine.
export const SEVERITY_ORDER: Status[] = ["critical", "watch", "stale", "normal"];
export const severityRank = (s: Status): number => SEVERITY_ORDER.length - SEVERITY_ORDER.indexOf(s);

export function countStatuses(statuses: Status[]): Counts {
  const c: Counts = { critical: 0, watch: 0, stale: 0, normal: 0 };
  for (const s of statuses) c[s]++;
  return c;
}

export const total = (c: Counts) => c.critical + c.watch + c.stale + c.normal;

// The icon follows the headline: critical, else watch, else stale only if nothing was confirmed, else normal.
export function worstOf(c: Counts): Status {
  if (c.critical > 0) return "critical";
  if (c.watch > 0) return "watch";
  return c.stale === total(c) && total(c) > 0 ? "stale" : "normal";
}

// "kind" is what the sentence says; the wording lives in i18n. "All normal" is only ever claimed for stations
// we could confirm, and never when every station is stale.
export type Headline = { kind: "critical" | "watch" | "allStale" | "allNormal"; critical: number; watch: number };

export function headlineOf(c: Counts): Headline | null {
  if (total(c) === 0) return null;
  const base = { critical: c.critical, watch: c.watch };
  if (c.critical > 0) return { kind: "critical", ...base };
  if (c.watch > 0) return { kind: "watch", ...base };
  if (c.stale === total(c)) return { kind: "allStale", ...base };
  return { kind: "allNormal", ...base };
}
