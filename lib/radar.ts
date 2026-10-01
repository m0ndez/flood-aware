import { cacheLife } from "next/cache";
import { parseFrames, STAMP_RE, type RadarFrame } from "./radar-catalogue.ts";

const ORIGIN = "https://radargis.tmd.go.th";
const MAX_BYTES = 3_000_000; // real frames are ~50 KB

// Throws on failure so errors are never cached. The upstream sends no-store, so caching is ours.
async function fetchLatest(): Promise<RadarFrame> {
  "use cache";
  cacheLife({ stale: 120, revalidate: 300, expire: 1800 });
  const res = await fetch(`${ORIGIN}/api/overlays`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`TMD radar catalogue: HTTP ${res.status}`);
  const frame = parseFrames(await res.json()).at(-1);
  if (!frame) throw new Error("TMD radar catalogue: no usable dBZ frame");
  return frame;
}

export async function loadLatestRadar(): Promise<RadarFrame | null> {
  try {
    return await fetchLatest();
  } catch (e) {
    console.error("TMD radar catalogue failed", e);
    return null;
  }
}

// ponytail: frames are immutable per stamp; keep the last few in process memory.
const images = new Map<string, ArrayBuffer>();

// Only the stamp of the current newest frame is served, so this cannot be used as an open proxy.
export async function loadRadarImage(stamp: string): Promise<ArrayBuffer | null> {
  if (!STAMP_RE.test(stamp)) return null;
  const hit = images.get(stamp);
  if (hit) return hit;
  const latest = await loadLatestRadar();
  if (!latest || latest.stamp !== stamp) return null;
  try {
    const res = await fetch(`${ORIGIN}${latest.path}`, { signal: AbortSignal.timeout(25_000) });
    const buf = await res.arrayBuffer();
    if (!res.ok || res.headers.get("content-type")?.startsWith("image/png") !== true || buf.byteLength > MAX_BYTES) {
      throw new Error(`radar image ${stamp}: bad upstream response (${res.status})`);
    }
    images.set(stamp, buf);
    for (const k of [...images.keys()].slice(0, -3)) images.delete(k);
    return buf;
  } catch (e) {
    console.error("TMD radar image failed", e);
    return null;
  }
}
