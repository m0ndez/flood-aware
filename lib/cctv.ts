import { cacheLife } from "next/cache";

// Two informal public sources, none with stated terms. Fine for a local PoC; get written permission
// from each owner before any public deployment.
//  muni    Nonthaburi City Municipality flood center (plain HTTP on a bare IP, 7-22 s per frame)
//  pakkret Pak Kret municipal CCTV on a contractor host (https, 320x240 stills, flaky)
// ponytail: a DOH highway HLS stream near Bang Bua Thong (streaming1.highwaytraffic.go.th, PER_10_019_IN)
// was tried and dropped: it decodes about a second of video, then stalls with MEDIA_ERR_DECODE in Chrome.
export type Source = "muni" | "pakkret";
export type Camera = {
  code: string;
  source: Source;
  name: string;
  lat: number;
  lon: number;
  cams: string[]; // upstream ids used by getFrame
  labels: string[]; // what to show for each frame
};

const MUNI = "http://182.52.224.70";
const MUNI_IMG = "/MilestoneImageService/ImageService.svc/ImageService/GetImage";
const PAKKRET_IMG = "https://www.thaiclouderp.com/src/img.php";

// Curated for flooding: river bridges, underpasses and low-lying approaches. Coordinates and names come
// from the operator's own viewer page; hardcoded so a page redesign cannot break the map.
// ponytail: the other ~44 Pak Kret cameras are ordinary junctions. Add ids here if they are wanted.
const PAKKRET: { id: string; name: string; lat: number; lon: number }[] = [
  { id: "CAMPK005", name: "สะพานพระรามสี่", lat: 13.91229, lon: 100.49764 },
  { id: "CAMPK024", name: "สะพานพระราม 4 (ฝั่งขาเข้า)", lat: 13.91528, lon: 100.49454 },
  { id: "CAMPK025", name: "สะพานพระราม 4 (ฝั่งขาออก)", lat: 13.91454, lon: 100.49503 },
  { id: "CAMPK052", name: "อุโมงค์ห้าแยกปากเกร็ด ถนนติวานนท์ (ขาออก)", lat: 13.90748, lon: 100.50417 },
  { id: "CAMPK015", name: "ถนนภูมิเวท ร.ร.วัดกลางเกร็ด ตัวที่ 1", lat: 13.90464, lon: 100.49226 },
  { id: "CAMPK016", name: "ถนนภูมิเวท ร.ร.วัดกลางเกร็ด ตัวที่ 2", lat: 13.90476, lon: 100.49225 },
  { id: "CAMPK046", name: "ถนนศรีสมาน (ขาออกไปสะพานนวลฉวี)", lat: 13.94429, lon: 100.53814 },
  { id: "CAMPK048", name: "ถนนติวานนท์ หน้าตลาดกรมชลฯ", lat: 13.89234, lon: 100.50952 },
  { id: "CAMPK053", name: "ถนนติวานนท์ ก่อนซอยติวานนท์-ปากเกร็ด 3", lat: 13.90298, lon: 100.50532 },
  { id: "CAMPK010", name: "แยกคลองประปา-ถนนแจ้งวัฒนะ (มาจากปากเกร็ด)", lat: 13.89554, lon: 100.55403 },
  { id: "CAMPK011", name: "แยกคลองประปา-ถนนแจ้งวัฒนะ (ไปหลักสี่)", lat: 13.89539, lon: 100.55432 },
];
const PAKKRET_ID_RE = /^CAMPK\d{3}$/;

const STATIC: Camera[] = [
  ...PAKKRET.map((p) => ({ code: p.id, source: "pakkret" as const, name: p.name, lat: p.lat, lon: p.lon, cams: [p.id], labels: [p.name] })),
];

const obj = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

// Throws on failure so errors are never cached.
async function fetchMuni(): Promise<Camera[]> {
  "use cache";
  cacheLife({ stale: 600, revalidate: 3600, expire: 86400 });
  const res = await fetch(`${MUNI}/json.php?app=station`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`CCTV list: HTTP ${res.status}`);
  const rows = obj(await res.json())?.station;
  const out: Camera[] = [];
  for (const raw of Array.isArray(rows) ? rows : []) {
    const r = obj(raw);
    const loc = obj(r?.location);
    if (!r || typeof r.code !== "string" || typeof r.name !== "string" || !Array.isArray(r.cctv)) continue;
    if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number") continue;
    // Only the camera name is taken from upstream. The URL is rebuilt from our own constants, and the
    // upstream `ondate` parameter is ignored by the server (verified: it always returns the live frame).
    const cams = r.cctv.flatMap((u) => {
      const m = typeof u === "string" ? /[?&]cameraname=([^&]+)$/.exec(u) : null;
      return m && m[1].trim() ? [m[1].trim()] : [];
    });
    if (cams.length > 0) {
      out.push({ code: r.code, source: "muni", name: r.name, lat: loc.lat, lon: loc.lng, cams, labels: cams.map((c) => c.replace(/^[^-]+-/, "")) });
    }
  }
  return out;
}

// The static sources never depend on the municipal list, so one source failing hides only itself.
export async function loadCameras(): Promise<Camera[]> {
  let muni: Camera[] = [];
  try {
    muni = await fetchMuni();
  } catch (e) {
    console.error("municipal camera list fetch failed", e);
  }
  return [...muni, ...STATIC];
}

// ponytail: in-process frame cache + single-flight; a shared cache if this ever runs multi-instance.
// Players poll continuously, so the cache only has to merge viewers, not hide the upstream.
// The municipal server is slow enough on its own (7-22 s per frame) to throttle its own loop.
const FRAME_TTL_MS: Record<Source, number> = { muni: 5_000, pakkret: 800 };
const MAX_UPSTREAM = 6; // distinct cameras in flight; upstream can take 7-22 s per frame, so never queue unbounded work behind it
const MAX_BYTES = 2_000_000;
const MIN_BYTES = 500; // Pak Kret answers 200 with an empty body for ids it doesn't know
const frames = new Map<string, { at: number; buf: ArrayBuffer }>();
const pending = new Map<string, Promise<{ at: number; buf: ArrayBuffer }>>();

export type Frame = { at: number; buf: ArrayBuffer };
export type FrameError = "not_found" | "busy" | "upstream";

function frameRequest(cam: Camera, upstreamId: string): { url: string; timeout: number } | null {
  if (cam.source === "muni") {
    return { url: `${MUNI}${MUNI_IMG}?width=800&height=450&cameraname=${encodeURIComponent(upstreamId)}`, timeout: 25_000 };
  }
  if (cam.source === "pakkret" && PAKKRET_ID_RE.test(upstreamId)) {
    return { url: `${PAKKRET_IMG}?t=${Date.now()}&name=${upstreamId}_thumb.jpg`, timeout: 8_000 }; // it stalls 20+ s now and then: give up early, the player keeps the last frame
  }
  return null;
}

export async function getFrame(code: string, n: number): Promise<Frame | { error: FrameError }> {
  const cam = (await loadCameras()).find((c) => c.code === code); // whitelist: only listed cameras
  const upstreamId = Number.isInteger(n) ? cam?.cams[n] : undefined;
  if (!cam || upstreamId === undefined) return { error: "not_found" };
  const req = frameRequest(cam, upstreamId);
  if (!req) return { error: "not_found" };

  const key = `${code}/${n}`;
  const hit = frames.get(key);
  if (hit && Date.now() - hit.at < FRAME_TTL_MS[cam.source]) return hit;

  let p = pending.get(key);
  if (!p) {
    if (pending.size >= MAX_UPSTREAM) return { error: "busy" };
    p = (async () => {
      const res = await fetch(req.url, { signal: AbortSignal.timeout(req.timeout) });
      const buf = await res.arrayBuffer();
      // Pak Kret labels its JPEGs "image/jpg", so accept both spellings.
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !/^image\/jpe?g/.test(type) || buf.byteLength < MIN_BYTES || buf.byteLength > MAX_BYTES) {
        throw new Error(`frame ${key}: bad upstream response (${res.status}, ${type}, ${buf.byteLength}B)`);
      }
      const frame = { at: Date.now(), buf };
      frames.set(key, frame);
      return frame;
    })().finally(() => pending.delete(key));
    pending.set(key, p);
  }
  try {
    return await p;
  } catch (e) {
    console.error("frame fetch failed", e);
    return { error: "upstream" };
  }
}
