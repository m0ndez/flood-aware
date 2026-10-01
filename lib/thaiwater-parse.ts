import { pickDerived, regionOf, type Candidate } from "./regions.ts";
import { isStale } from "./status.ts";
import { CORE_STATIONS, type Bi, type Graph, type Point, type Rain, type Reading, type Station } from "./stations.ts";

// Pure parsing of ThaiWater's undocumented JSON. Trust boundary: coerce every field we use, drop rows that don't fit,
// and never turn a missing value into a number. No fetch and no Next imports, so it is unit-tested with real fixtures.
export const num = (x: unknown): number | null => {
  const n = typeof x === "number" ? x : typeof x === "string" && x.trim() !== "" ? Number(x) : NaN;
  return Number.isFinite(n) ? n : null;
};
export const obj = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

// Most endpoints wrap payloads as {result:"OK", data}; waterlevel_load nests that wrapper one level down.
export function unwrap(x: unknown): unknown {
  const o = obj(x);
  if (!o || o.result !== "OK") throw new Error("ThaiWater: bad envelope");
  return o.data;
}

// ponytail: flat-earth distance, fine at province scale.
export const km = (aLat: number, aLon: number, bLat: number, bLon: number) =>
  Math.hypot(aLat - bLat, (aLon - bLon) * Math.cos((aLat * Math.PI) / 180)) * 111;

export type RainRow = { name: Bi; lat: number; lon: number; h24: number; h1: number | null; datetime: string };

export function parseRain(data: unknown): RainRow[] {
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

export type Row = {
  reading: Reading;
  code: string;
  nameTh: string;
  nameEn: string | null;
  riverTh: string;
  provinceCode: string;
  province: Bi;
  isKey: boolean;
};

const str = (x: unknown): string => (typeof x === "string" ? x.trim() : "");

export function parseRows(data: unknown): Row[] {
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

export function nearestRain(lat: number, lon: number, rain: RainRow[]): Rain | null {
  let best: Rain | null = null;
  for (const g of rain) {
    const d = km(lat, lon, g.lat, g.lon);
    if (!best || d < best.km) best = { name: g.name, km: d, h24: g.h24, h1: g.h1, datetime: g.datetime };
  }
  return best;
}

// Hardcoded Nonthaburi stations always stay. Central and Eastern ones are derived from the feed (see pickDerived).
export function parseOverview(data: unknown, now: number): { readings: Reading[]; stations: Station[] } {
  const rows = parseRows(data);
  const core = new Set(CORE_STATIONS.map((s) => s.id));
  const cands: Candidate[] = rows.map((r) => ({
    id: r.reading.id,
    provinceCode: r.provinceCode,
    lat: r.reading.lat,
    lon: r.reading.lon,
    isKey: r.isKey,
    situation: r.reading.situation,
    fresh: !isStale(r.reading.datetime, now),
  }));
  const derivedIds = new Set(pickDerived(cands, core));
  const stations: Station[] = [...CORE_STATIONS];
  const readings: Reading[] = [];
  for (const r of rows) {
    const id = r.reading.id;
    const region = regionOf(r.provinceCode, r.reading.lat, r.reading.lon);
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
    readings.push(r.reading);
  }
  return { readings, stations };
}

// waterlevel_graph payload: a time series and the bank level. Points that don't parse are dropped, not zeroed.
export function parseGraph(data: unknown): Graph {
  const g = obj(data);
  const points: Point[] = [];
  for (const raw of Array.isArray(g?.graph_data) ? g.graph_data : []) {
    const p = obj(raw);
    const v = num(p?.value);
    if (typeof p?.datetime === "string" && v != null) points.push({ t: p.datetime, v });
  }
  return { points, bankM: num(g?.min_bank) };
}

export type { Bi };
