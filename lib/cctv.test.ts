import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { DOH_HLS_RE, getFrame, loadCameras, resetCameraState } from "./cctv.ts";

const realFetch = globalThis.fetch;
const realError = console.error;
let calls: string[] = [];

const jpg = (bytes = 600, type = "image/jpg") => new Response(new Uint8Array(bytes), { status: 200, headers: { "content-type": type } });
function stub(handler: (url: string) => Response | Promise<Response>) {
  calls = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return handler(url);
  }) as typeof fetch;
}

beforeEach(() => {
  resetCameraState();
  console.error = () => {}; // expected upstream failures are logged by design
});
afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = realError;
});

const ok = (r: Awaited<ReturnType<typeof getFrame>>) => "buf" in r;
const err = (r: Awaited<ReturnType<typeof getFrame>>) => ("error" in r ? r.error : null);

test("only listed cameras and frame indexes reach the network", async () => {
  stub(() => jpg());
  for (const [code, n] of [["NOPE", 0], ["CAMPK024", 1], ["CAMPK024", -1], ["CAMPK024", 1.5], ["../etc", 0], ["A1", 9]] as const) {
    assert.equal(err(await getFrame(code, n)), "not_found", `${code}/${n}`);
  }
  assert.equal(calls.length, 0);
});

test("Pak Kret frame: https contractor host, id from our list, 1 s shared-cache lifetime", async () => {
  stub(() => jpg(700, "image/jpg")); // Pak Kret really labels JPEGs "image/jpg"
  const r = await getFrame("CAMPK024", 0);
  assert.ok(ok(r) && r.ttlS === 1 && r.buf.byteLength === 700);
  assert.match(calls[0], /^https:\/\/www\.thaiclouderp\.com\/src\/img\.php\?t=\d+&name=CAMPK024_thumb\.jpg$/);
});

test("municipal frame: built from our constants with the encoded camera name, shared for 1 s at the CDN only", async () => {
  stub(() => jpg(40_000, "image/jpeg"));
  const r = await getFrame("A1", 0);
  assert.ok(ok(r) && r.ttlS === 1);
  assert.match(calls[0], /^http:\/\/182\.52\.224\.70\/MilestoneImageService\/.*cameraname=A1-%E0%B8/);
  assert.ok(!calls[0].includes("ondate"), "the ignored upstream ondate parameter is never sent");
});

test("a bad upstream answer is an error, never a frame: empty body, HTML, oversize, HTTP error", async () => {
  const cases: [string, () => Response][] = [
    ["empty 200 (Pak Kret does this for unknown ids)", () => jpg(0)],
    ["html page", () => new Response("<html>blocked</html>".repeat(100), { status: 200, headers: { "content-type": "text/html" } })],
    ["oversize", () => jpg(2_500_000)],
    ["http 503", () => new Response("down", { status: 503, headers: { "content-type": "image/jpeg" } })],
  ];
  for (const [label, make] of cases) {
    resetCameraState();
    stub(make);
    assert.equal(err(await getFrame("CAMPK024", 0)), "upstream", label);
  }
});

test("a fresh frame is shared: sequential and concurrent callers cost one upstream fetch", async () => {
  stub(() => jpg());
  await getFrame("CAMPK024", 0);
  await getFrame("CAMPK024", 0);
  assert.equal(calls.length, 1, "second call served from the 0.8 s cache");
  resetCameraState();
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  stub(async () => (await gate, jpg()));
  const both = Promise.all([getFrame("CAMPK025", 0), getFrame("CAMPK025", 0)]);
  release();
  const [a, b] = await both;
  assert.ok(ok(a) && ok(b));
  assert.equal(calls.length, 1, "single flight");
});

test("a failed camera backs off briefly and a neighbour is unaffected", async () => {
  stub((url) => (url.includes("CAMPK024") ? new Response("x", { status: 500 }) : jpg()));
  assert.equal(err(await getFrame("CAMPK024", 0)), "upstream");
  const before = calls.length;
  assert.equal(err(await getFrame("CAMPK024", 0)), "upstream");
  assert.equal(calls.length, before, "not retried inside its backoff window");
  assert.ok(ok(await getFrame("CAMPK025", 0)), "a neighbour still works");
  assert.equal(calls.length, before + 1);
});

test("one transient hang costs seconds, not half a minute, and a success clears the penalty", async () => {
  const realNow = Date.now;
  let t = realNow();
  Date.now = () => t;
  try {
    let fail = true;
    stub(() => (fail ? new Response("x", { status: 500 }) : jpg()));
    assert.equal(err(await getFrame("CAMPK024", 0)), "upstream");
    t += 1_500;
    assert.equal(err(await getFrame("CAMPK024", 0)), "upstream", "still inside the first 2 s backoff");
    fail = false;
    t += 600; // 2.1 s after the failure
    assert.ok(ok(await getFrame("CAMPK024", 0)), "retried after about 2 s, recovered");
    fail = true;
    t += 1_000;
    const stale = await getFrame("CAMPK024", 0); // cached frame is older than 0.8 s, upstream fails again: last good frame, not an error
    assert.ok("buf" in stale && stale.stale === true && stale.ttlS === 1 && stale.at < t, "stale frame keeps its own capture time and is not shared for long");
    t += 2_100;
    fail = false;
    assert.ok(ok(await getFrame("CAMPK024", 0)), "backoff restarted at 2 s because the success reset it, not at 4 s");
  } finally {
    Date.now = realNow;
  }
});

test("a failing camera serves its last frame for 30 s, then reports the error", async () => {
  const realNow = Date.now;
  let t = realNow();
  Date.now = () => t;
  try {
    let fail = false;
    stub(() => (fail ? new Response("x", { status: 500 }) : jpg()));
    assert.ok(ok(await getFrame("CAMPK024", 0)));
    fail = true;
    t += 10_000;
    assert.ok(ok(await getFrame("CAMPK024", 0)), "10 s old frame still shown");
    t += 21_000;
    assert.equal(err(await getFrame("CAMPK024", 0)), "upstream", "31 s old: say so instead of showing it as current");
  } finally {
    Date.now = realNow;
  }
});

test("municipal frames are never reused, but viewers asking at once share one fetch", async () => {
  stub(() => jpg(700, "image/jpeg"));
  const [a, b, c] = await Promise.all([getFrame("A13", 0), getFrame("A13", 0), getFrame("A13", 0)]);
  assert.ok(ok(a) && ok(b) && ok(c));
  assert.equal(calls.length, 1, "three simultaneous viewers, one upstream request");
  assert.ok(ok(await getFrame("A13", 0)));
  assert.equal(calls.length, 2, "the next ask fetches again instead of replaying the old frame");
});

test("backoff doubles for consecutive failures and is capped at 30 s", async () => {
  const realNow = Date.now;
  let t = realNow();
  Date.now = () => t;
  try {
    stub(() => new Response("x", { status: 500 }));
    // How long after a failure until the camera is tried again, measured in 500 ms steps.
    const waitUntilRetried = async () => {
      for (let waited = 0; ; waited += 500) {
        const before = calls.length;
        await getFrame("CAMPK024", 0);
        if (calls.length > before) return waited;
        t += 500;
      }
    };
    const waits: number[] = [];
    for (let i = 0; i < 7; i++) waits.push(await waitUntilRetried());
    assert.deepEqual(waits.slice(0, 5), [0, 2_000, 4_000, 8_000, 16_000]); // first try is immediate, then 2, 4, 8, 16 s
    assert.ok(waits.slice(5).every((w) => w >= 29_000 && w <= 30_500), `capped near 30 s, got ${waits.slice(5)}`);
  } finally {
    Date.now = realNow;
  }
});

test("three different cameras failing marks the whole source down, without more fetches", async () => {
  stub(() => new Response("x", { status: 500 }));
  for (const code of ["CAMPK024", "CAMPK025", "CAMPK005"]) assert.equal(err(await getFrame(code, 0)), "upstream");
  const before = calls.length;
  assert.equal(before, 3);
  assert.equal(err(await getFrame("CAMPK052", 0)), "upstream", "a camera never tried yet is also skipped");
  assert.equal(calls.length, before, "no upstream call while the source is down");
  // a different source is unaffected
  stub(() => jpg(40_000, "image/jpeg"));
  assert.ok(ok(await getFrame("A1", 0)));
});

test("never queues unbounded work behind a slow upstream: the 7th distinct camera in flight is refused", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  stub(async () => (await gate, jpg()));
  const codes = ["CAMPK005", "CAMPK024", "CAMPK025", "CAMPK052", "CAMPK015", "CAMPK016", "CAMPK046"];
  const inflight = codes.slice(0, 6).map((c) => getFrame(c, 0));
  await new Promise((r) => setTimeout(r, 10)); // let the six reach fetch
  assert.equal(err(await getFrame(codes[6], 0)), "busy");
  release();
  assert.ok((await Promise.all(inflight)).every(ok));
});

test("DOH cameras are played by the browser: valid relay playlists, never fetched by our proxy", async () => {
  const doh = (await loadCameras()).filter((c) => c.source === "doh");
  assert.equal(doh.length, 5);
  for (const c of doh) {
    assert.ok(c.hls && DOH_HLS_RE.test(c.hls), `${c.code}: ${c.hls}`);
    assert.ok(c.lat > 13.7 && c.lat < 14.1 && c.lon > 100.3 && c.lon < 100.8, `${c.code} is near Nonthaburi`);
  }
  assert.equal(new Set(doh.map((c) => c.code)).size, 5);
  stub(() => jpg());
  assert.equal(err(await getFrame("DOH-PER-9-026", 0)), "not_found", "the frame proxy must not become an open relay for the DOH host");
  assert.equal(calls.length, 0);
  for (const bad of ["http://camerai1.iticfoundation.org/pass/1.2.3.4:1935/Phase9/PER_9_026_IN.stream/playlist.m3u8", "https://camerai1.iticfoundation.org.evil.com/pass/1.2.3.4:1935/Phase9/PER_9_026_IN.stream/playlist.m3u8", "https://evil.com/pass/1.2.3.4/Phase9/PER_9.stream/playlist.m3u8"]) {
    assert.ok(!DOH_HLS_RE.test(bad), bad);
  }
});
