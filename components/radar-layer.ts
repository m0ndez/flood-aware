import type { Map as LeafletMap, TileLayer } from "leaflet";

// RainViewer radar. Free tier is "personal or educational use only", max zoom 7, 100 requests/IP/min.
// Fine for a local PoC; for a public launch delete this file (and its toggle in station-map.tsx) or buy a licence.
// Kept self-contained so removal touches nothing else.
type Leaflet = typeof import("leaflet");

export async function addRadar(L: Leaflet, map: LeafletMap): Promise<{ layer: TileLayer; time: number }> {
  const res = await fetch("https://api.rainviewer.com/public/weather-maps.json", { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`RainViewer: HTTP ${res.status}`);
  const j = await res.json();
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
