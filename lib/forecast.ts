import { cacheLife } from "next/cache";

// Open-Meteo: keyless, free for non-commercial use, attribution required (shown in the footer).
const URL_BASE = "https://api.open-meteo.com/v1/forecast";

export type Forecast = {
  hours: { t: string; mm: number; prob: number | null }[]; // t = "YYYY-MM-DD HH:mm" Thai time, 7 days
  days: { d: string; mm: number }[]; // d = "YYYY-MM-DD"
};

const nums = (x: unknown): (number | null)[] | null =>
  Array.isArray(x) ? x.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null)) : null;
const strs = (x: unknown): string[] | null =>
  Array.isArray(x) && x.every((v) => typeof v === "string") ? (x as string[]) : null;
const obj = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

// Throws on failure so errors are never cached; loadForecast turns that into null.
async function fetchForecast(lat: number, lon: number): Promise<Forecast> {
  "use cache: remote";
  cacheLife({ stale: 600, revalidate: 1800, expire: 7200 });
  const qs = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: "precipitation,precipitation_probability",
    daily: "precipitation_sum",
    forecast_days: "7",
    timezone: "Asia/Bangkok",
  });
  const res = await fetch(`${URL_BASE}?${qs}`, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`Open-Meteo: HTTP ${res.status}`);
  const j = obj(await res.json());
  const h = obj(j?.hourly);
  const d = obj(j?.daily);
  const ht = strs(h?.time);
  const hp = nums(h?.precipitation);
  const hq = nums(h?.precipitation_probability);
  const dt = strs(d?.time);
  const dp = nums(d?.precipitation_sum);
  if (!ht || !hp || !dt || !dp || ht.length !== hp.length || dt.length !== dp.length) throw new Error("Open-Meteo: bad shape");
  return {
    // A missing hour is unknown, not dry: drop it instead of coercing to 0 mm.
    hours: ht.flatMap((t, i) => (hp[i] == null ? [] : [{ t: t.replace("T", " "), mm: hp[i]!, prob: hq?.[i] ?? null }])),
    days: dt.flatMap((day, i) => (dp[i] == null ? [] : [{ d: day, mm: dp[i]! }])),
  };
}

export async function loadForecast(lat: number, lon: number): Promise<Forecast | null> {
  // Coordinates come from our own station list, rounded so the cache key stays small.
  try {
    return await fetchForecast(Math.round(lat * 100) / 100, Math.round(lon * 100) / 100);
  } catch (e) {
    console.error("forecast fetch failed", e);
    return null;
  }
}
