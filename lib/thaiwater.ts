import { cacheLife } from "next/cache";
import { nearestRain, obj, parseGraph, parseOverview, parseRain, unwrap, type RainRow } from "./thaiwater-parse.ts";
import type { Graph, Overview, Rain, Station } from "./stations.ts";

export * from "./stations.ts";

// Undocumented public JSON that thaiwater.net's own frontend uses. Keep ALL network knowledge of it in this file;
// parsing lives in thaiwater-parse.ts so it can be tested.
const BASE = "https://api-v3.thaiwater.net/api/v1/thaiwater30/public";

async function get(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}/${path}`, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`ThaiWater ${path}: HTTP ${res.status}`);
  return res.json();
}

// Throws on upstream failure so errors are never cached; callers fall back (see loadOverview).
async function fetchOverview(): Promise<Overview> {
  "use cache: remote";
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
  // Only the gauge feed (240 KB gzipped). The 4.4 MB rain feed is fetched separately, and only for an opened station.
  const wl = await get("waterlevel_load");
  const rows = unwrap(obj(wl)?.waterlevel_data);
  const fetchedAt = Date.now();
  return { fetchedAt, ...parseOverview(rows, fetchedAt) };
}

// Rain gauges inside this box only (Nonthaburi, Central and Eastern provinces with a margin): about a quarter of
// the national feed, so the cached entry stays small.
const RAIN_BOX = { south: 11.5, north: 16.8, west: 98.5, east: 103.6 };

// Throws on failure so errors are never cached.
async function fetchRainRows(): Promise<RainRow[]> {
  "use cache: remote";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  return parseRain(unwrap(await get("rain_24h"))).filter((r) => r.lat >= RAIN_BOX.south && r.lat <= RAIN_BOX.north && r.lon >= RAIN_BOX.west && r.lon <= RAIN_BOX.east);
}

// Nearest rain gauge to a station. null = could not load, which the UI must say, not show as 0 mm.
export async function loadRainNear(lat: number, lon: number): Promise<Rain | null> {
  try {
    return nearestRain(lat, lon, await fetchRainRows());
  } catch (e) {
    console.error("rain feed failed", e);
    return null;
  }
}

async function fetchGraph(id: number): Promise<Graph> {
  "use cache: remote";
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
  return parseGraph(unwrap(await get(`waterlevel_graph?station_type=tele_waterlevel&station_id=${id}`)));
}

// ponytail: in-memory last-good copy, single local process. Move to a store if this ever runs multi-instance.
let lastGood: Overview | null = null;

export async function loadOverview(): Promise<{ data: Overview | null; failed: boolean; now: number }> {
  try {
    lastGood = await fetchOverview();
    return { data: lastGood, failed: false, now: Date.now() };
  } catch (e) {
    console.error("overview fetch failed", e);
    return { data: lastGood, failed: true, now: Date.now() };
  }
}

export async function loadGraph(id: number, known: Station[]): Promise<Graph | null> {
  if (!known.some((s) => s.id === id)) return null; // only stations we list reach upstream
  try {
    return await fetchGraph(id);
  } catch (e) {
    console.error("graph fetch failed", e);
    return null;
  }
}
