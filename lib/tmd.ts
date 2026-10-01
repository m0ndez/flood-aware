import { cacheLife } from "next/cache";
import { collectWarnings, decodeTmd, parseOutlook, type OutlookDay } from "./tmd-parse.ts";
import type { Warning } from "./warnings.ts";

export type { OutlookDay } from "./tmd-parse.ts";

// Thai Meteorological Department open API. Credit "data.tmd.go.th" and never imply TMD endorsement.
// Defaults to TMD's published shared demo credentials; set TMD_UID / TMD_UKEY (server-only) for your own.
const BASE = "https://data.tmd.go.th/api";
let warnedDemo = false;
const qs = () => {
  if (!process.env.TMD_UID && !warnedDemo) {
    warnedDemo = true; // once per instance: if TMD revokes the shared demo key the strip says "could not check", so leave a trace
    console.warn("TMD_UID/TMD_UKEY not set: using TMD's shared demo credentials");
  }
  return `uid=${encodeURIComponent(process.env.TMD_UID || "api")}&ukey=${encodeURIComponent(process.env.TMD_UKEY || "api12345")}&format=json`;
};

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}/${path}`, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`TMD ${path}: HTTP ${res.status}`);
  return JSON.parse(decodeTmd(await res.arrayBuffer(), res.headers.get("content-type") ?? ""));
}

// Use v2: v1 times out.
async function fetchOutlook(provinceTh: string): Promise<OutlookDay[]> {
  "use cache: remote";
  cacheLife({ stale: 900, revalidate: 3600, expire: 21600 });
  const days = parseOutlook(await getJson(`WeatherForecast7Days/v2/?${qs()}`), provinceTh);
  if (days.length === 0) throw new Error(`TMD outlook: ${provinceTh} not found`);
  return days;
}

async function fetchWarnings(): Promise<Warning[]> {
  "use cache: remote";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  // v2 is the current feed and must succeed; v1 is best-effort (it has been slow and mostly stale).
  const [v2, v1] = await Promise.allSettled([getJson(`WeatherWarningNews/v2/?${qs()}`), getJson(`WeatherWarningNews/v1/?${qs()}`)]);
  if (v2.status === "rejected") throw v2.reason;
  const v2obj = v2.value && typeof v2.value === "object" ? (v2.value as Record<string, unknown>) : {};
  const out = collectWarnings(v2obj.Warnings);
  if (v1.status === "fulfilled" && v1.value && typeof v1.value === "object") collectWarnings((v1.value as Record<string, unknown>).WarningNews, out);
  return out;
}

export async function loadOutlook(provinceTh: string): Promise<OutlookDay[] | null> {
  try {
    return await fetchOutlook(provinceTh);
  } catch (e) {
    console.error("TMD outlook fetch failed", e);
    return null;
  }
}

// null = could not check; the UI must say so instead of implying "no warnings".
export async function loadWarnings(): Promise<Warning[] | null> {
  try {
    return await fetchWarnings();
  } catch (e) {
    console.error("TMD warnings fetch failed", e);
    return null;
  }
}
