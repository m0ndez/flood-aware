import { cacheLife } from "next/cache";
import { parseRoads, type RoadReport } from "./roads-parse.ts";

export type { RoadReport } from "./roads-parse.ts";

// Longdo/iTIC traffic events: undocumented public JSON (CORS *, max-age=60, no auth), ~500 KB nationwide.
// Credit "Longdo Traffic / iTIC" wherever it is shown. Reports are crowd-sourced and unverified.
const FEED_URL = "https://event.longdo.com/feed/json";
const UA = "Mozilla/5.0 (compatible; FloodAwareBot/1.0; +https://github.com/m0ndez/flood-aware)";

async function fetchRoads(): Promise<RoadReport[]> {
  "use cache: remote";
  cacheLife({ stale: 120, revalidate: 300, expire: 1800 });
  const res = await fetch(FEED_URL, { signal: AbortSignal.timeout(8_000), headers: { "user-agent": UA, accept: "application/json" } });
  if (!res.ok) throw new Error(`longdo events: HTTP ${res.status}`);
  const json: unknown = await res.json();
  if (!Array.isArray(json)) throw new Error("longdo events: not an array");
  // Cache only the flood reports, not the ~500 KB of accidents and breakdowns.
  return parseRoads(json);
}

// null = could not check; the UI must say so instead of implying "no flooded roads".
// Age and ended-ness depend on the clock, so callers filter with currentRoads(reports, Date.now()) at render time.
export async function loadRoads(): Promise<RoadReport[] | null> {
  try {
    return await fetchRoads();
  } catch (e) {
    console.error("roads fetch failed", e);
    return null;
  }
}
