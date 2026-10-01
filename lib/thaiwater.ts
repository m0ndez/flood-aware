import { cacheLife } from "next/cache";
import { pickDerived, regionOfProvince, type Candidate, type Region } from "./regions.ts";
import { isStale } from "./status.ts";

// Undocumented public JSON that thaiwater.net's own frontend uses. Keep ALL upstream knowledge in this file.
const BASE = "https://api-v3.thaiwater.net/api/v1/thaiwater30/public";

// "province" groups the derived Central/Eastern stations by their province instead of by role.
export type Group = "nonthaburi" | "upstream" | "downstream" | "nearby" | "province";
export type Bi = { th: string; en: string };
export type Station = {
  id: number;
  code: string;
  group: Group;
  region: Region;
  name: Bi;
  river: Bi; // empty strings when the feed has no river name
  province?: Bi; // set on derived stations
  provinceCode?: string; // set on derived stations; also their list/map group key
  thaiOnly?: boolean; // derived station whose feed entry has no English name
};

// The hand-picked Nonthaburi set, with English names. Everything else is derived from the feed (see parseOverview).
type Core = Omit<Station, "region">;
const CORE: Core[] = [
  { id: 26, code: "CPY014", group: "nonthaburi", name: { th: "สะพานนวลฉวี (ปากเกร็ด)", en: "Nuan Chawee Bridge (Pak Kret)" }, river: { th: "แม่น้ำเจ้าพระยา", en: "Chao Phraya River" } },
  { id: 24, code: "BKK018", group: "nonthaburi", name: { th: "คลองพระพิมล (ไทรน้อย)", en: "Khlong Phra Phimon (Sai Noi)" }, river: { th: "คลองพระพิมล", en: "Khlong Phra Phimon" } },
  { id: 49, code: "CPY012", group: "upstream", name: { th: "บางปะอิน", en: "Bang Pa-in" }, river: { th: "แม่น้ำเจ้าพระยา", en: "Chao Phraya River" } },
  { id: 39, code: "CPY011", group: "upstream", name: { th: "พระนครศรีอยุธยา", en: "Ayutthaya" }, river: { th: "แม่น้ำเจ้าพระยา", en: "Chao Phraya River" } },
  { id: 2609, code: "C.35", group: "upstream", name: { th: "บ้านป้อม", en: "Ban Pom" }, river: { th: "แม่น้ำเจ้าพระยา", en: "Chao Phraya River" } },
  { id: 2599, code: "C.12", group: "downstream", name: { th: "สามเสน", en: "Sam Sen" }, river: { th: "แม่น้ำเจ้าพระยา", en: "Chao Phraya River" } },
  { id: 4, code: "CPY015", group: "downstream", name: { th: "สะพานกรุงเทพ", en: "Krung Thep Bridge" }, river: { th: "แม่น้ำเจ้าพระยา", en: "Chao Phraya River" } },
  // Nearby klongs (Pathum Thani, Bangkok, Nakhon Pathom). Several already read over bank in the feed.
  { id: 1, code: "BKK021", group: "nearby", name: { th: "คลองลาดพร้าว วัดบางบัว", en: "Khlong Lat Phrao (Wat Bang Bua)" }, river: { th: "คลองบางบัว", en: "Khlong Bang Bua" } },
  { id: 11, code: "BKK001", group: "nearby", name: { th: "คลองลาดพร้าว ท้ายปตร.คลอง 2", en: "Khlong Lat Phrao (below Khlong 2 sluice)" }, river: { th: "คลองหกวา", en: "Khlong Hok Wa" } },
  { id: 8, code: "BKK020", group: "nearby", name: { th: "คลองลาดพร้าว ปากคลอง 2 สายใต้", en: "Khlong Lat Phrao (Khlong 2 South mouth)" }, river: { th: "คลองหกวา", en: "Khlong Hok Wa" } },
  { id: 27, code: "BKK002", group: "nearby", name: { th: "คลองเปรมประชากร หลักหก", en: "Khlong Prem Prachakon (Lak Hok)" }, river: { th: "คลองเปรมประชากร", en: "Khlong Prem Prachakon" } },
  { id: 5, code: "BKK003", group: "nearby", name: { th: "คลองมหาสวัสดิ์ (บางกรวย-สวนผัก)", en: "Khlong Mahasawat (Bang Kruai-Suan Phak)" }, river: { th: "คลองมหาสวัสดิ์", en: "Khlong Mahasawat" } },
  { id: 747, code: "BKK019", group: "nearby", name: { th: "คลองนราภิรมย์ (บางเลน)", en: "Khlong Nara Phirom (Bang Len)" }, river: { th: "คลองนราภิรมย์", en: "Khlong Nara Phirom" } },
  { id: 749, code: "VLGE20", group: "nearby", name: { th: "ศาลาดิน", en: "Sala Din" }, river: { th: "คลองหม่อมเจ้าเฉลิมศรี", en: "Khlong Mom Chao Chaloemsi" } },
]; 
export const CORE_STATIONS: Station[] = CORE.map((c) => ({ ...c, region: "nonthaburi" as const }));
export const DEFAULT_STATION = 26;

export type Rain = { name: Bi; km: number; h24: number; h1: number | null; datetime: string };
export type Reading = {
  id: number;
  lat: number;
  lon: number;
  levelMsl: number;
  datetime: string;
  situation: number; // ThaiWater situation_level 1-5
  bankPct: number | null; // % of bank capacity
  bankM: number | null; // min bank level, m MSL
  rain: Rain | null; // nearest rain gauge
};
export type Overview = { fetchedAt: number; readings: Reading[]; stations: Station[] };
export type Point = { t: string; v: number };
export type Graph = { points: Point[]; bankM: number | null };

// Trust boundary: upstream is undocumented, so coerce every field we use and drop rows that don't fit.
const num = (x: unknown): number | null => {
  const n = typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" ? Number(x) : NaN;
  return Number.isFinite(n) ? n : null;
};
const obj = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

async function get(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}/${path}`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`ThaiWater ${path}: HTTP ${res.status}`);
  return res.json();
}

// Most endpoints wrap payloads as {result:"OK", data}; waterlevel_load nests that wrapper one level down.
function unwrap(x: unknown): unknown {
  const o = obj(x);
  if (!o || o.result !== "OK") throw new Error("ThaiWater: bad envelope");
  return o.data;
}

// ponytail: flat-earth distance, fine at province scale.
const km = (aLat: number, aLon: number, bLat: number, bLon: number) =>
  Math.hypot(aLat - bLat, (aLon - bLon) * Math.cos((aLat * Math.PI) / 180)) * 111;

type RainRow = { name: Bi; lat: number; lon: number; h24: number; h1: number | null; datetime: string };

function parseRain(data: unknown): RainRow[] {
  const rows: RainRow[] = [];
  for (const raw of Array.isArray(data) ? data : []) {
    const r = obj(raw);
    const s = obj(r?.station);
    const nm = obj(s?.tele_station_name);
    const name = nm?.th;
    const lat = num(s?.tele_station_lat);
    const lon = num(s?.tele_station_long);
    const h24 = num(r?.rain_24h);
    if (!r || typeof name !== "string" || lat == null || lon == null || h24 == null || typeof r.rainfall_datetime !== "string") continue;
    rows.push({ name: { th: name, en: typeof nm?.en === "string" && nm.en ? nm.en : name }, lat, lon, h24, h1: num(r.rain_1h), datetime: r.rainfall_datetime });
  }
  return rows;
}

type Row = {
  reading: Omit<Reading, "rain">;
  code: string;
  nameTh: string;
  nameEn: string | null;
  riverTh: string;
  provinceCode: string;
  province: Bi;
  isKey: boolean;
};

const str = (x: unknown): string => (typeof x === "string" ? x.trim() : "");

function parseRows(data: unknown): Row[] {
  const out: Row[] = [];
  for (const raw of Array.isArray(data) ? data : []) {
    const r = obj(raw);
    const s = obj(r?.station);
    const id = num(s?.id);
    if (!r || id == null || r.station_type !== "tele_waterlevel") continue;
    const lat = num(s?.tele_station_lat);
    const lon = num(s?.tele_station_long);
    const levelMsl = num(r.waterlevel_msl);
    const situation = num(r.situation_level);
    if (lat == null || lon == null || levelMsl == null || situation == null || typeof r.waterlevel_datetime !== "string") continue;
    const nm = obj(s?.tele_station_name);
    const geo = obj(r.geocode);
    const prov = obj(geo?.province_name);
    out.push({
      reading: { id, lat, lon, levelMsl, situation, datetime: r.waterlevel_datetime, bankPct: num(r.storage_percent), bankM: num(s?.min_bank) },
      code: str(s?.tele_station_oldcode) || String(id),
      nameTh: str(nm?.th),
      nameEn: str(nm?.en) || null,
      riverTh: str(r.river_name),
      provinceCode: str(geo?.province_code),
      province: { th: str(prov?.th), en: str(prov?.en) || str(prov?.th) },
      isKey: s?.is_key_station === true,
    });
  }
  return out;
}

function nearestRain(lat: number, lon: number, rain: RainRow[]): Rain | null {
  let best: Rain | null = null;
  for (const g of rain) {
    const d = km(lat, lon, g.lat, g.lon);
    if (!best || d < best.km) best = { name: g.name, km: d, h24: g.h24, h1: g.h1, datetime: g.datetime };
  }
  return best;
}

// Hardcoded Nonthaburi stations always stay. Central and Eastern ones are derived from the feed (see pickDerived).
function parseOverview(data: unknown, rain: RainRow[], now: number): { readings: Reading[]; stations: Station[] } {
  const rows = parseRows(data);
  const core = new Set(CORE_STATIONS.map((s) => s.id));
  const cands: Candidate[] = rows.map((r) => ({
    id: r.reading.id,
    provinceCode: r.provinceCode,
    isKey: r.isKey,
    situation: r.reading.situation,
    fresh: !isStale(r.reading.datetime, now),
  }));
  const derivedIds = new Set(pickDerived(cands, core));
  const stations: Station[] = [...CORE_STATIONS];
  const readings: Reading[] = [];
  for (const r of rows) {
    const id = r.reading.id;
    const region = regionOfProvince(r.provinceCode);
    if (derivedIds.has(id) && region && r.nameTh) {
      stations.push({
        id,
        code: r.code,
        group: "province",
        region,
        name: { th: r.nameTh, en: r.nameEn ?? r.nameTh },
        river: { th: r.riverTh, en: r.riverTh },
        province: r.province,
        provinceCode: r.provinceCode,
        thaiOnly: r.nameEn == null,
      });
    } else if (!core.has(id)) continue;
    readings.push({ ...r.reading, rain: nearestRain(r.reading.lat, r.reading.lon, rain) });
  }
  return { readings, stations };
}

// Throws on upstream failure so errors are never cached; callers fall back (see loadOverview).
async function fetchOverview(): Promise<Overview> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
  const [wl, rain] = await Promise.all([get("waterlevel_load"), get("rain_24h")]);
  const rows = unwrap(obj(wl)?.waterlevel_data);
  const fetchedAt = Date.now();
  return { fetchedAt, ...parseOverview(rows, parseRain(unwrap(rain)), fetchedAt) };
}

async function fetchGraph(id: number): Promise<Graph> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
  const g = obj(unwrap(await get(`waterlevel_graph?station_type=tele_waterlevel&station_id=${id}`)));
  const points: Point[] = [];
  for (const raw of Array.isArray(g?.graph_data) ? g.graph_data : []) {
    const p = obj(raw);
    const v = num(p?.value);
    if (typeof p?.datetime === "string" && v != null) points.push({ t: p.datetime, v });
  }
  return { points, bankM: num(g?.min_bank) };
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
