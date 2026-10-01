import { cacheLife } from "next/cache";
import { parseForecast, type Forecast } from "./forecast-parse.ts";

export type { Forecast } from "./forecast-parse.ts";

// Open-Meteo: keyless, free for non-commercial use, attribution required (shown in the footer).
const URL_BASE = "https://api.open-meteo.com/v1/forecast";

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
  return parseForecast(await res.json());
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
