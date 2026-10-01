import assert from "node:assert/strict";
import test from "node:test";
import { distanceKm, nearest } from "./geo.ts";

test("distance matches known values", () => {
  assert.equal(distanceKm(13.86, 100.52, 13.86, 100.52), 0);
  // 1 degree of latitude is about 111.2 km
  assert.ok(Math.abs(distanceKm(13, 100, 14, 100) - 111.2) < 0.5);
  // Pak Kret gauge to Krung Thep Bridge gauge, roughly 27 km along the river
  const d = distanceKm(13.94749, 100.53507, 13.700301, 100.49277);
  assert.ok(d > 26 && d < 29, `got ${d}`);
});

test("nearest picks the closest and handles an empty list", () => {
  const pts = [{ id: "far", lat: 14.3, lon: 100.5 }, { id: "near", lat: 13.9, lon: 100.5 }];
  const n = nearest(pts, 13.86, 100.52);
  assert.equal(n?.item.id, "near");
  assert.ok(n && n.km < 6);
  assert.equal(nearest([], 13.86, 100.52), null);
});
