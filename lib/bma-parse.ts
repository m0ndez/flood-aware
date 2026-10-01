import { BANGNA_BOX } from "./regions.ts";

// Pure handling of the Bangkok Metropolitan Administration canal feed (weather.bangkok.go.th/Klongmap/GetDataForUpdate).
// No fetch, no Next imports, so it is tested on a frozen slice of the real response. The feed is undocumented and
// untrusted: input is `unknown`, every field is checked, and a bad row is skipped rather than thrown on.

export type BmaKind = "canal" | "pump" | "gate";
export type BmaStatus = "normal" | "watch" | "critical" | "stale";

export type BmaStation = {
  id: number;
  nameTh: string;
  nameEn: string;
  kind: BmaKind;
  lat: number;
  lon: number;
  /** Level in metres (inner side for pumps and gates). */
  level: number;
  warning: number | null;
  critical: number | null;
  /** Outer-side level (e.g. the river side of a pump or gate). */
  outerLevel: number | null;
  maxToday: number | null;
  maxYesterday: number | null;
  /** Reading time, ms since epoch. */
  at: number;
};

export type Box = { south: number; north: number; west: number; east: number };

export const BMA_STALE_MS = 3 * 3600_000; // same rule as lib/status.ts
export const BMA_FUTURE_MS = 3600_000;
export const BMA_DEFAULT_CAP = 40;

const KINDS: Record<number, BmaKind> = { 1: "canal", 2: "pump", 3: "gate" };
const MAX_ROWS = 5000;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// The feed uses -99 (and null) for "no reading". Treat anything at or below -90 m as that sentinel, and non-numbers as absent.
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > -90 ? v : null;
}

// "/Date(1790873100000)/" = ms since epoch, UTC (ASP.NET JSON date).
export function parseBmaDate(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = /^\/Date\((-?\d{1,15})(?:[+-]\d{4})?\)\/$/.exec(v);
  if (!m) return null;
  const t = Number(m[1]);
  return Number.isFinite(t) && t > 0 ? t : null;
}

const name = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

export function parseBma(json: unknown): BmaStation[] {
  if (!isObj(json) || !Array.isArray(json.waterStation)) return [];
  const out: BmaStation[] = [];
  const seen = new Set<number>();
  for (const row of json.waterStation.slice(0, MAX_ROWS)) {
    try {
      const s = parseRow(row);
      if (s && !seen.has(s.id)) {
        seen.add(s.id);
        out.push(s);
      }
    } catch {
      // a malformed row must never take the rest down
    }
  }
  return out;
}

function parseRow(row: unknown): BmaStation | null {
  if (!isObj(row)) return null;
  const kind = typeof row.station_type_id === "number" ? KINDS[row.station_type_id] : undefined;
  if (!kind || row.active === 0 || row.active === false) return null;
  const info = row.water_station_info;
  const last = row.water_level_last;
  if (!isObj(info) || !isObj(last)) return null;
  const id = Number(row.water_id);
  const lat = info.latitude;
  const lon = info.longitude;
  if (!Number.isInteger(id) || typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const level = num(last.wl_in);
  const at = parseBmaDate(last.site_timestamp);
  if (level == null || at == null) return null;
  const nameTh = name(row.station_name);
  if (!nameTh) return null;
  return {
    id,
    nameTh,
    nameEn: name(row.station_name_en) || nameTh,
    kind,
    lat,
    lon,
    level,
    warning: num(info.warning),
    critical: num(info.critical),
    outerLevel: num(last.wl_out01),
    maxToday: num(last.max_in_day),
    maxYesterday: num(last.max_in_yesterday),
    at,
  };
}

export function inArea(s: Pick<BmaStation, "lat" | "lon">, box: Box = BANGNA_BOX): boolean {
  return s.lat >= box.south && s.lat <= box.north && s.lon >= box.west && s.lon <= box.east;
}

export function isBmaStale(at: number, now: number): boolean {
  return at > now + BMA_FUTURE_MS || now - at > BMA_STALE_MS;
}

// Level against the station's own warning/critical marks, ignoring freshness. Thresholds are per station and share the
// gauge's datum, so they are only comparable with that station's own level. null = cannot confirm "normal".
function rawStatus(s: BmaStation): "normal" | "watch" | "critical" | null {
  if (s.critical != null && s.level >= s.critical) return "critical";
  if (s.warning != null && s.level >= s.warning) return "watch";
  return s.warning != null && s.critical != null ? "normal" : null;
}

export function bmaStatus(s: BmaStation, now: number): BmaStatus {
  if (isBmaStale(s.at, now)) return "stale";
  return rawStatus(s) ?? "stale";
}

const SEVERITY = { critical: 2, watch: 1, normal: 0 } as const;

// All pumps and gates (the controllable structures), then the canal gauges that are at or above their warning mark.
// Fresh readings first; then higher severity; then newest. Pumps and gates keep their lead over canals.
export function selectBma(stations: BmaStation[], now: number, cap: number = BMA_DEFAULT_CAP): BmaStation[] {
  const rank = (s: BmaStation) => ({
    group: s.kind === "canal" ? 1 : 0,
    stale: isBmaStale(s.at, now) ? 1 : 0,
    sev: SEVERITY[rawStatus(s) ?? "normal"],
  });
  return stations
    .filter((s) => inArea(s) && (s.kind !== "canal" || rawStatus(s) === "watch" || rawStatus(s) === "critical"))
    .map((s) => ({ s, r: rank(s) }))
    .sort((a, b) => a.r.group - b.r.group || a.r.stale - b.r.stale || b.r.sev - a.r.sev || b.s.at - a.s.at || a.s.id - b.s.id)
    .slice(0, Math.max(0, cap))
    .map((x) => x.s);
}
