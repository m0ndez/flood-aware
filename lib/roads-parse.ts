import { parseIct } from "./status.ts";

// Pure parsing of Longdo/iTIC traffic events (https://event.longdo.com/feed/json) into flooded-road reports.
// The feed is undocumented and untrusted: nothing here throws, every field is re-validated, and text is stripped of
// markup, control characters and trailing credits before it can reach the UI.

export type RoadReport = {
  id: string;
  title: string;
  titleEn: string;
  place: string; // cleaned description, one line, max PLACE_MAX chars
  lat: number;
  lon: number;
  start: number; // epoch ms
  stop: number; // epoch ms
  source: "doh" | "itic" | "public";
};

export type Box = { south: number; north: number; west: number; east: number };

const FLOOD_TYPE = "6";
const MAX_EVENTS = 5000;
const PLACE_MAX = 160;
export const MAX_AGE_MS = 48 * 3600_000;
const FUTURE_SKEW_MS = 3600_000;
// Thailand's bounding box: drops 0,0 placeholders and swapped lat/lon.
const LAT_MIN = 5.5;
const LAT_MAX = 20.6;
const LON_MIN = 97.3;
const LON_MAX = 105.7;

// "YYYY-MM-DD HH:MM:SS" in Thai local time (UTC+7) with no offset. parseIct takes minutes, so seconds are added on top.
function parseLongdoTime(v: unknown): number {
  if (typeof v !== "string") return NaN;
  const m = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}):(\d{2})$/.exec(v.trim());
  if (!m || Number(m[2]) > 59) return NaN;
  return parseIct(m[1]) + Number(m[2]) * 1000;
}

function clean(v: unknown, max = PLACE_MAX): string {
  if (typeof v !== "string") return "";
  const text = v
    .replace(/<[^>]*>/g, " ")
    .replace(/\bCr\.\s*\S*/gi, " ") // trailing credits: "Cr.NT", "Cr.FM91trafficpro", "Cr. Fm91"
    .replace(/รายงานโดย\s*\S*/g, " ") // "reported by <username>": a member of the public's handle is not ours to republish
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ") // CR/LF/tab and other control characters
    .replace(/\s+/g, " ")
    .trim();
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max - 1).join("").trimEnd()}…` : text;
}

export function sourceOf(contributor: unknown): RoadReport["source"] {
  if (typeof contributor !== "string") return "public";
  const c = contributor.trim();
  if (c === "DOH Admin") return "doh";
  if (c !== "itic_user" && c.toLowerCase().startsWith("itic")) return "itic";
  return "public";
}

function coord(v: unknown, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : NaN;
}

export function parseRoads(json: unknown): RoadReport[] {
  if (!Array.isArray(json)) return [];
  const out: RoadReport[] = [];
  for (const e of json.length > MAX_EVENTS ? json.slice(0, MAX_EVENTS) : json) {
    if (!e || typeof e !== "object") continue;
    const r = e as Record<string, unknown>;
    if (String(r.type) !== FLOOD_TYPE) continue;
    const lat = coord(r.latitude, LAT_MIN, LAT_MAX);
    const lon = coord(r.longitude, LON_MIN, LON_MAX);
    const start = parseLongdoTime(r.start);
    const stop = parseLongdoTime(r.stop);
    if (Number.isNaN(lat) || Number.isNaN(lon) || Number.isNaN(start) || Number.isNaN(stop) || stop < start) continue;
    const id = typeof r.eid === "string" || typeof r.eid === "number" ? String(r.eid).trim() : "";
    const title = clean(r.title);
    if (!id || !title) continue;
    out.push({ id, title, titleEn: clean(r.title_en), place: clean(r.description), lat, lon, start, stop, source: sourceOf(r.contributor) });
  }
  return out;
}

// Reports still worth showing: not ended, not older than maxAgeMs (feed windows can run for days or weeks), and not
// from the future (clock skew tolerated up to 1 h). Duplicates (same title at the same ~100 m spot) keep the newest.
export function currentRoads(reports: RoadReport[], now: number, maxAgeMs = MAX_AGE_MS): RoadReport[] {
  const best = new Map<string, RoadReport>();
  for (const r of reports) {
    if (r.stop < now || now - r.start > maxAgeMs || r.start - now > FUTURE_SKEW_MS) continue;
    const key = `${r.title}|${r.lat.toFixed(3)}|${r.lon.toFixed(3)}`;
    const prev = best.get(key);
    if (!prev || r.start > prev.start || (r.start === prev.start && r.id > prev.id)) best.set(key, r);
  }
  return [...best.values()].sort((a, b) => b.start - a.start || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

export function inBox(r: { lat: number; lon: number }, box: Box): boolean {
  return r.lat >= box.south && r.lat <= box.north && r.lon >= box.west && r.lon <= box.east;
}

export function roadsInBox(reports: RoadReport[], box: Box): RoadReport[] {
  return reports.filter((r) => inBox(r, box));
}
