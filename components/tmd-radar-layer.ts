import type { ImageOverlay, Map as LeafletMap } from "leaflet";
import { pixelBox, STAMP_RE } from "@/lib/radar-catalogue";

// TMD radar (radargis.tmd.go.th) through our own same-origin proxy, so the pixels are readable.
// No published terms or SLA and the service looks experimental: check with TMD before any public use.
// components/radar-layer.ts (RainViewer) is the fallback when this fails.
type Leaflet = typeof import("leaflet");
type Bounds = [[number, number], [number, number]];

const HERE = { lat: 13.86, lon: 100.52 };
const HALF_DEG = 0.45; // about 50 km
const MIN_ECHO_PX = 200; // opaque pixels in that box before we say there is rain nearby

const isPoint = (p: unknown): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && Number.isFinite(n));

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("radar image failed"));
    img.src = src;
  });
}

// An empty frame is normal in dry weather. Say so, so a blank map is never mistaken for a broken layer.
function hasEchoes(img: HTMLImageElement, bounds: Bounds): boolean {
  const b = pixelBox(bounds, img.naturalWidth, img.naturalHeight, HERE.lat, HERE.lon, HALF_DEG);
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  if (w <= 0 || h <= 0) return false;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return true; // cannot tell, so do not claim it is empty
  ctx.drawImage(img, b.x0, b.y0, w, h, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  let n = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] > 32 && ++n >= MIN_ECHO_PX) return true;
  return false;
}

export async function addTmdRadar(L: Leaflet, map: LeafletMap): Promise<{ layer: ImageOverlay; time: number; echoes: boolean }> {
  const res = await fetch("/api/radar", { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`radar meta: HTTP ${res.status}`);
  const j = await res.json();
  if (typeof j?.stamp !== "string" || !STAMP_RE.test(j.stamp) || typeof j.time !== "number" || !Array.isArray(j.bounds) || !isPoint(j.bounds[0]) || !isPoint(j.bounds[1])) {
    throw new Error("radar meta: bad shape");
  }
  const bounds: Bounds = [j.bounds[0], j.bounds[1]];
  const src = `/api/radar/${j.stamp}`;
  const img = await load(src);
  const layer = L.imageOverlay(src, bounds, {
    opacity: 0.8,
    interactive: false,
    attribution: 'Radar &copy; <a href="https://www.tmd.go.th">TMD</a>',
  }).addTo(map);
  return { layer, time: j.time, echoes: hasEchoes(img, bounds) };
}
