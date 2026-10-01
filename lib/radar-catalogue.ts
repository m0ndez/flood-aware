// Pure parsing for the TMD RADARGIS catalogue (https://radargis.tmd.go.th/api/overlays).
// No terms or SLA are published and the service looks experimental: check with TMD before any public use.

export type RadarFrame = {
  stamp: string; // "20261001_0430", the UTC valid time embedded in the file name
  path: string; // "/products/leaflet_overlay_dbz/...png"
  time: number; // valid time, epoch ms
  bounds: [[number, number], [number, number]]; // [[south, west], [north, east]]
};

const GROUP = "01 dBZ Overlay";

// The catalogue's valid_dt_ts is wrong by exactly 7 h (UTC wall time read as Thai local time), so take
// the true valid time from the UTC stamp in the file name.
export function stampToMs(stamp: string): number {
  const [d, hm] = stamp.split("_");
  return Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8), +hm.slice(0, 2), +hm.slice(2, 4));
}
const PATH_RE = /^\/products\/leaflet_overlay_dbz\/TMD20_DBZ_MP_MONSOON_DBZ_OVERLAY_(\d{8}_\d{4})_UTC\.png$/;
export const STAMP_RE = /^\d{8}_\d{4}$/;

const obj = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

function parseBounds(x: unknown): RadarFrame["bounds"] | null {
  if (!Array.isArray(x) || x.length !== 2) return null;
  const [a, b] = x.map((p) => (Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && Number.isFinite(n)) ? (p as [number, number]) : null));
  if (!a || !b || a[0] >= b[0] || a[1] >= b[1]) return null;
  if (a[0] < -90 || b[0] > 90 || a[1] < -180 || b[1] > 180) return null;
  return [a, b];
}

// Newest dBZ frame, or null if the catalogue has none that passes validation.
export function parseFrames(json: unknown): RadarFrame[] {
  const list = obj(json)?.overlays;
  const out: RadarFrame[] = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const o = obj(raw);
    if (!o || o.group !== GROUP || typeof o.url !== "string" || typeof o.valid_dt_ts !== "number") continue;
    const path = o.url.split("?")[0]; // drop the ?v= cache-buster, frames are immutable per file name
    const m = PATH_RE.exec(path);
    const bounds = parseBounds(o.bounds);
    if (!m || !bounds) continue;
    out.push({ stamp: m[1], path, time: stampToMs(m[1]), bounds });
  }
  return out.sort((a, b) => a.time - b.time);
}

// Pixel box around a point inside a TMD overlay. L.imageOverlay stretches the image linearly in
// Web Mercator between the two corners, so rows are linear in mercator-y, not in latitude.
const merc = (latDeg: number) => Math.log(Math.tan(Math.PI / 4 + (latDeg * Math.PI) / 360));

export function pixelBox(
  bounds: RadarFrame["bounds"],
  w: number,
  h: number,
  lat: number,
  lon: number,
  halfDeg: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const [[south, west], [north, east]] = bounds;
  const px = (lo: number) => ((lo - west) / (east - west)) * w;
  const py = (la: number) => ((merc(north) - merc(la)) / (merc(north) - merc(south))) * h;
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(v)));
  return {
    x0: clamp(px(lon - halfDeg), w),
    x1: clamp(px(lon + halfDeg), w),
    y0: clamp(py(lat + halfDeg), h),
    y1: clamp(py(lat - halfDeg), h),
  };
}
