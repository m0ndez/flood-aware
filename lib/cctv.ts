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

const MUNI = "http://182.52.224.70"; // frames only: the station list is a static snapshot below
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

const MUNI_STATIONS: { code: string; name: string; lat: number; lon: number; cams: string[] }[] = [
  // Snapshot of the municipal station list (json.php?app=station) taken 2026-10-01: 26 stations, 36 cameras.
  // Static on purpose: fetching it on every cold start put a slow, flaky HTTP call in front of the whole page.
  // Re-take the snapshot if the municipality adds cameras; frames are still fetched live.
  { code: "A1", name: "คลองท่าทราย", lat: 13.889283, lon: 100.490387, cams: ["A1-คลองท่าทราย Cam1", "A1-คลองท่าทราย Cam2"] },
  { code: "A2", name: "วัดตำหนักใต้", lat: 13.886683, lon: 100.488564, cams: ["A2-วัดตำหนักใต้ Cam1", "A2-วัดตำหนักใต้ Cam2"] },
  { code: "A3", name: "คลองบางธรณี", lat: 13.883282, lon: 100.488848, cams: ["A3-คลองบางธรณี"] },
  { code: "A4", name: "คลองอ้อช้าง", lat: 13.87756, lon: 100.48101, cams: ["A4-คลองอ้อช้าง Cam1"] },
  { code: "A5", name: "คลองบางสร้อยทอง", lat: 13.874929, lon: 100.482431, cams: ["A5-คลองบางสร้อยทอง Cam1", "A5-คลองบางสร้อยทอง Cam2"] },
  { code: "A6", name: "คลองบางกระสอ", lat: 13.871506, lon: 100.481918, cams: ["A6-คลองบางกระสอ Cam1", "A6-คลองบางกระสอ Cam2"] },
  { code: "A7", name: "คลองบางซื่อน้อย", lat: 13.860795, lon: 100.482076, cams: ["A7-คลองบางซื่อน้อย Cam1"] },
  { code: "A8", name: "คลองมะขามโพรง", lat: 13.856844, lon: 100.482236, cams: ["A8-คลองมะขามโพรง Cam1", "A8-คลองมะขามโพรง Cam2"] },
  { code: "A9", name: "คลองบางแพรก2", lat: 13.852458, lon: 100.490203, cams: ["A9-คลองบางแพรก2 Cam1", "A9-คลองบางแพรก2 Cam2"] },
  { code: "A10", name: "คลองบางแพรก", lat: 13.849799, lon: 100.490467, cams: ["A10-คลองบางแพรก Cam1", "A10-คลองบางแพรก Cam2"] },
  { code: "A11", name: "คลองบางขวาง", lat: 13.840246, lon: 100.492018, cams: ["A11-คลองบางขวาง"] },
  { code: "A12", name: "คลองบางตะนาวศรี", lat: 13.836621, lon: 100.498333, cams: ["A12-คลองบางตะนาวศรี"] },
  { code: "A13", name: "คลองบางขุนเทียน", lat: 13.832203, lon: 100.498236, cams: ["A13-คลองบางขุนเทียน"] },
  { code: "A14", name: "บางบุญนาค", lat: 13.826267, lon: 100.502058, cams: ["A14-บางบุญนาค"] },
  { code: "A15", name: "วัดเขมาฯ", lat: 13.821329, lon: 100.503013, cams: ["A15-วัดเขมาฯ Cam1"] },
  { code: "A16", name: "คลองบางแพรก (ข้างกรมราชทัณฑ์)", lat: 13.850356, lon: 100.487768, cams: ["A16-คลองบางแพรก กรมราชทัณฑ์"] },
  { code: "B4", name: "คลองตาโฮ", lat: 13.880922, lon: 100.540506, cams: ["B4-คลองตาโฮ Cam1", "B4-คลองตาโฮ Cam2"] },
  { code: "B5", name: "ประชานิเวศน์ 2", lat: 13.880567, lon: 100.543425, cams: ["B5-ประชานิเวศน์ 2 Cam1", "B5-ประชานิเวศน์ 2 Cam2"] },
  { code: "B6", name: "ปลายคลองบางตลาด", lat: 13.877633, lon: 100.549823, cams: ["B6-ปลายคลองบางตลาด Cam1"] },
  { code: "B7", name: "ประชานิเวศ 4", lat: 13.875714, lon: 100.548785, cams: ["B7-ประชานิเวศน์ 4"] },
  { code: "B8", name: "ใต้ทางด่วน", lat: 13.85757, lon: 100.533089, cams: ["B8-ใต้ทางด่วน Cam1", "B8-ใต้ทางด่วน Cam2"] },
  { code: "B9", name: "แยกพงษ์เพชร", lat: 13.854544, lon: 100.544532, cams: ["B9-แยกพงษ์เพชร"] },
  { code: "B10", name: "คลองส่วย", lat: 13.851083, lon: 100.543807, cams: ["B10-คลองส่วย"] },
  { code: "B11", name: "คลองศรีเพ็ชร", lat: 13.850907, lon: 100.504496, cams: ["B11-คลองศรีเพ็ชร"] },
  { code: "B12", name: "คลองขุด ข้าง กสท.", lat: 13.867886, lon: 100.518566, cams: ["B12-คลองขุดข้าง กสท"] },
  { code: "B13", name: "คลองวัดบัวขวัญ", lat: 13.867641, lon: 100.54777, cams: ["B13-คลองวัดบัวขวัญ"] },
];

const MUNI_CAMERAS: Camera[] = MUNI_STATIONS.map((m) => ({
  ...m,
  source: "muni" as const,
  labels: m.cams.map((c) => c.replace(/^[^-]+-/, "")),
}));

const ALL: Camera[] = [...MUNI_CAMERAS, ...STATIC];

// No network: the page never waits on a camera list. (Frames are fetched live, on demand, by getFrame.)
export async function loadCameras(): Promise<Camera[]> {
  return ALL;
}

// ponytail: in-process frame cache + single-flight; a shared cache if this ever runs multi-instance.
// Players poll continuously, so the cache only has to merge viewers, not hide the upstream.
// The municipal server is slow enough on its own (7-22 s per frame) to throttle its own loop.
const FRAME_TTL_MS: Record<Source, number> = { muni: 5_000, pakkret: 800 };
const MAX_UPSTREAM = 6; // distinct cameras in flight; upstream can take 7-22 s per frame, so never queue unbounded work behind it
const MAX_BYTES = 2_000_000;
const MIN_BYTES = 500; // Pak Kret answers 200 with an empty body for ids it doesn't know
// Pak Kret and the municipal server do not answer from every cloud network, and single cameras fail on their own.
// A failed camera is skipped briefly, with exponential backoff (2 s, 4 s, 8 s ... capped at 30 s, reset by a success), so
// a player does not wait out the full timeout on every poll of a dead camera, yet one transient hang (Pak Kret hangs
// on about one request in four) costs seconds, not half a minute. Only when several DIFFERENT cameras of one source
// fail inside the window is the whole source treated as down for 30 s: one flaky camera must not take its healthy
// neighbours with it.
const DOWN_MS = 30_000;
const BACKOFF_BASE_MS = 2_000;
const SOURCE_TRIP = 3;
const camDown = new Map<string, { n: number; until: number }>(); // camera code -> consecutive failures, skip until
const sourceDown = new Map<Source, number>();
const recentFail = new Map<Source, Map<string, number>>(); // source -> camera code -> failure time
const frames = new Map<string, Frame>();
const pending = new Map<string, Promise<Frame>>();

// A stalled or backing-off camera keeps showing its last good frame (its own capture time stays on it, so the player's
// clock tells the truth) instead of freezing the player on an error for the whole backoff.
const MAX_STALE_MS = 30_000;
const staleFrame = (key: string): Frame | null => {
  const f = frames.get(key);
  return f && Date.now() - f.at < MAX_STALE_MS ? { ...f, ttlS: 1 } : null;
};

const isDown = (cam: Camera, now: number) => (camDown.get(cam.code)?.until ?? 0) > now || (sourceDown.get(cam.source) ?? 0) > now;

function noteFailure(cam: Camera, now: number) {
  const n = (camDown.get(cam.code)?.n ?? 0) + 1;
  camDown.set(cam.code, { n, until: now + Math.min(BACKOFF_BASE_MS * 2 ** (n - 1), DOWN_MS) });
  const m = recentFail.get(cam.source) ?? new Map<string, number>();
  m.set(cam.code, now);
  for (const [code, t] of m) if (now - t > DOWN_MS) m.delete(code);
  recentFail.set(cam.source, m);
  if (m.size >= SOURCE_TRIP) sourceDown.set(cam.source, now + DOWN_MS);
}

// Test hook: module state outlives a test file's cases.
export function resetCameraState() {
  camDown.clear();
  sourceDown.clear();
  recentFail.clear();
  frames.clear();
  pending.clear();
}

export type Frame = { at: number; buf: ArrayBuffer; ttlS: number }; // ttlS: how long a shared CDN cache may reuse it
export type FrameError = "not_found" | "busy" | "upstream";

function frameRequest(cam: Camera, upstreamId: string): { url: string; timeout: number } | null {
  if (cam.source === "muni") {
    return { url: `${MUNI}${MUNI_IMG}?width=800&height=450&cameraname=${encodeURIComponent(upstreamId)}`, timeout: 30_000 }; // the municipal server takes 7-24 s per frame; stay under the player's own 35 s
  }
  if (cam.source === "pakkret" && PAKKRET_ID_RE.test(upstreamId)) {
    return { url: `${PAKKRET_IMG}?t=${Date.now()}&name=${upstreamId}_thumb.jpg`, timeout: 2_500 }; // normally 0.1-0.3 s but it stalls 20+ s now and then: give up early and serve the last frame
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
  if (isDown(cam, Date.now())) return staleFrame(key) ?? { error: "upstream" };
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
      const frame: Frame = { at: Date.now(), buf, ttlS: Math.max(1, Math.round(FRAME_TTL_MS[cam.source] / 1000)) };
      frames.set(key, frame);
      camDown.delete(cam.code); // recovered
      recentFail.get(cam.source)?.delete(cam.code);
      return frame;
    })().finally(() => pending.delete(key));
    pending.set(key, p);
  }
  try {
    return await p;
  } catch (e) {
    console.error("frame fetch failed", e);
    noteFailure(cam, Date.now());
    return staleFrame(key) ?? { error: "upstream" };
  }
}
