import assert from "node:assert/strict";
import test from "node:test";
import { parseFrames } from "./radar-catalogue.ts";

const bounds = [[4.04, 90.76], [22.43, 110.42]];
const frame = (stamp: string, ts: number, over: Record<string, unknown> = {}) => ({
  group: "01 dBZ Overlay",
  url: `/products/leaflet_overlay_dbz/TMD20_DBZ_MP_MONSOON_DBZ_OVERLAY_${stamp}_UTC.png?v=1`,
  valid_dt_ts: ts,
  bounds,
  ...over,
});

test("keeps valid dBZ frames, newest last, without the cache-buster", () => {
  const f = parseFrames({ overlays: [frame("20261001_0430", 200), frame("20261001_0415", 100)] });
  assert.deepEqual(f.map((x) => x.stamp), ["20261001_0415", "20261001_0430"]);
  assert.equal(f[1].path.includes("?"), false);
  // time comes from the UTC stamp, not from valid_dt_ts (which the real feed gets wrong by 7 h)
  assert.equal(f[1].time, Date.parse("2026-10-01T04:30:00Z"));
  assert.equal(f[0].time, Date.parse("2026-10-01T04:15:00Z"));
});

test("rejects other groups, odd paths and bad bounds", () => {
  const bad = [
    frame("20261001_0430", 1, { group: "04 dBZ Nowcast Overlay" }),
    frame("20261001_0430", 1, { url: "https://evil.example/x.png" }),
    frame("20261001_0430", 1, { url: "/products/../etc/passwd" }),
    frame("20261001_0430", 1, { bounds: [[10, 10], [5, 5]] }),
    frame("20261001_0430", 1, { bounds: "x" }),
    frame("20261001_0430", "1" as unknown as number),
  ];
  assert.deepEqual(parseFrames({ overlays: bad }), []);
  assert.deepEqual(parseFrames(null), []);
  assert.deepEqual(parseFrames({ overlays: "x" }), []);
});

import { pixelBox } from "./radar-catalogue.ts";

test("pixel box is centred on the point and uses mercator rows", () => {
  const b: [[number, number], [number, number]] = [[4.045858659494958, 90.76771294565968], [22.43817240284896, 110.42512786049976]];
  const box = pixelBox(b, 2706, 2706, 13.86, 100.52, 0.45);
  // x: 100.52 sits (100.52-90.77)/19.66 = 49.6% across
  assert.ok(Math.abs((box.x0 + box.x1) / 2 - 0.496 * 2706) < 3, `x centre ${(box.x0 + box.x1) / 2}`);
  assert.ok(box.x1 > box.x0 && box.y1 > box.y0);
  // y: linear-latitude would put 13.86 at ~53% down; mercator puts it lower (~54%+), so the two must differ
  const linear = ((22.43817 - 13.86) / (22.43817 - 4.04586)) * 2706;
  assert.ok(Math.abs((box.y0 + box.y1) / 2 - linear) > 5);
  // a point outside the image clamps to the edge instead of going negative
  const out = pixelBox(b, 100, 100, 40, 120, 0.5);
  assert.deepEqual(out, { x0: 100, y0: 0, x1: 100, y1: 0 });
});
