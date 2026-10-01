import assert from "node:assert/strict";
import test from "node:test";
import { cluster, MAX_CLUSTER_ZOOM } from "./cluster.ts";

// Two Pak Kret cameras about 25 m apart, one 3 km away, and one in Mueang.
const a = { id: "a", lat: 13.89554, lon: 100.55403 };
const b = { id: "b", lat: 13.89539, lon: 100.55432 };
const far = { id: "far", lat: 13.92, lon: 100.55 };
const mueang = { id: "m", lat: 13.86, lon: 100.49 };

test("every item lands in exactly one cluster", () => {
  const out = cluster([a, b, far, mueang], 10);
  const ids = out.flatMap((c) => c.items.map((i) => i.id)).sort();
  assert.deepEqual(ids, ["a", "b", "far", "m"]);
});

test("close items merge and the cluster sits at their mean position", () => {
  const out = cluster([a, b], 10);
  assert.equal(out.length, 1);
  assert.equal(out[0].items.length, 2);
  assert.ok(Math.abs(out[0].lat - (a.lat + b.lat) / 2) < 1e-9);
  assert.ok(Math.abs(out[0].lon - (a.lon + b.lon) / 2) < 1e-9);
});

test("zooming in separates items that are far apart; a very low zoom merges them", () => {
  assert.equal(cluster([a, far], 15).length, 2); // ~3 km is hundreds of px apart at z15
  assert.equal(cluster([a, far, mueang], 4).length, 1); // the whole province is a few px wide at z4, whatever grid lines would fall on it
});

test("above the max cluster zoom nothing is merged, even identical points", () => {
  const out = cluster([a, a, b], MAX_CLUSTER_ZOOM + 1);
  assert.equal(out.length, 3);
  assert.ok(out.every((c) => c.items.length === 1));
});

test("empty input and a single item are fine", () => {
  assert.deepEqual(cluster([], 10), []);
  const one = cluster([mueang], 10);
  assert.equal(one.length, 1);
  assert.deepEqual(one[0].items, [mueang]);
});
