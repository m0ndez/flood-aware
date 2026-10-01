import type { Map as LeafletMap, TileLayer } from "leaflet";
import { withTimeout } from "@/lib/abort";

// RainViewer radar, used only when TMD's own radar is unreachable (it is not, from Vercel). Free tier terms:
// "personal or educational use only", max zoom 7, 100 requests/IP/min. This site is a non-commercial personal
// portfolio, which that covers. If it ever becomes a product or carries ads, delete this file (the fallback in
// map-hooks.ts useRadarLayer then reports "radar unavailable") or buy a RainViewer licence.
type Leaflet = typeof import("leaflet");

export async function addRadar(L: Leaflet, map: LeafletMap): Promise<{ layer: TileLayer; time: number }> {
  const req = withTimeout(15_000);
  let j: { host?: unknown; radar?: { past?: unknown } };
  try {
    const res = await fetch("https://api.rainviewer.com/public/weather-maps.json", { signal: req.signal });
    if (!res.ok) throw new Error(`RainViewer: HTTP ${res.status}`);
    j = await res.json();
  } finally {
    req.done();
  }
  const past: unknown = j?.radar?.past;
  const last = Array.isArray(past) ? past[past.length - 1] : null;
  const host: unknown = j?.host;
  if (typeof host !== "string" || !host.startsWith("https://") || typeof last?.path !== "string" || !/^\/v2\/radar\/\w+$/.test(last.path) || typeof last.time !== "number") {
    throw new Error("RainViewer: bad metadata");
  }
  const layer = L.tileLayer(`${host}${last.path}/256/{z}/{x}/{y}/2/1_1.png`, {
    opacity: 0.6,
    maxNativeZoom: 7, // above z7 the server returns a "Zoom Level Not Supported" image with HTTP 200
    maxZoom: 18,
    attribution: 'Radar &copy; <a href="https://www.rainviewer.com">RainViewer</a>',
  }).addTo(map);
  return { layer, time: last.time * 1000 };
}
