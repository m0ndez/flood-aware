import assert from "node:assert/strict";
import test from "node:test";
import { coverageOf } from "./coverage.ts";

const C = { lat: 13.668, lon: 100.605 };

test("counts per province, stale ones separately, biggest province first", () => {
  const cov = coverageOf(
    [
      { province: "สมุทรปราการ", lat: 13.6, lon: 100.6, stale: false },
      { province: "สมุทรปราการ", lat: 13.5, lon: 100.7, stale: true },
      { province: "กรุงเทพมหานคร", lat: 13.7, lon: 100.65, stale: false },
    ],
    C,
    5,
  );
  assert.deepEqual(cov.provinces, [
    { name: "สมุทรปราการ", n: 2, stale: 1 },
    { name: "กรุงเทพมหานคร", n: 1, stale: 0 },
  ]);
});

test("a stale gauge next door does not count as covering the place", () => {
  const cov = coverageOf([{ province: "x", lat: 13.668, lon: 100.605, stale: true }], C, 5);
  assert.equal(cov.near, 0);
});

test("near counts working gauges within the radius only", () => {
  const cov = coverageOf(
    [
      { province: "x", lat: 13.67, lon: 100.61, stale: false }, // ~0.6 km
      { province: "x", lat: 13.9, lon: 100.9, stale: false }, // far
    ],
    C,
    5,
  );
  assert.equal(cov.near, 1);
});

test("no stations at all gives an empty, honest result", () => {
  assert.deepEqual(coverageOf([], C, 5), { provinces: [], near: 0 });
});
