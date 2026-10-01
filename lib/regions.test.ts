import assert from "node:assert/strict";
import test from "node:test";
import { BANGNA_BOX, pickDerived, regionOf, type Candidate } from "./regions.ts";

const c = (id: number, provinceCode: string, over: Partial<Candidate> = {}): Candidate => ({
  id,
  provinceCode,
  lat: 14.3,
  lon: 100.5,
  isKey: false,
  situation: 3,
  fresh: true,
  ...over,
});

test("provinces map to the right region", () => {
  assert.equal(regionOf("14", 14.3, 100.5), "central"); // Ayutthaya
  assert.equal(regionOf("10", 13.8, 100.45), "central"); // Bangkok west of the box
  assert.equal(regionOf("24", 13.7, 101.1), "eastern"); // Chachoengsao
  assert.equal(regionOf("71", 14, 99), null); // Kanchanaburi is in neither view
  assert.equal(regionOf("", 13.6, 100.6), null);
});

test("Samut Prakan and east Bangkok form the Bang Na view, wherever in the province", () => {
  assert.equal(regionOf("11", 13.45, 100.6), "bangna"); // Samut Prakan, even south of the box
  assert.equal(regionOf("11", 13.6, 101.0), "bangna"); // and east of it
  assert.equal(regionOf("10", 13.668, 100.605), "bangna"); // Bang Na district
  assert.equal(regionOf("10", BANGNA_BOX.north + 0.01, 100.6), "central"); // north of the box
  assert.equal(regionOf("10", 13.7, BANGNA_BOX.west - 0.01), "central"); // just west of the box
  assert.equal(regionOf("12", 13.668, 100.605), "central", "the box does not capture other provinces");
});

test("Bangkok's two views each get their own per-province cap", () => {
  const inBox = Array.from({ length: 5 }, (_, i) => c(10 + i, "10", { lat: 13.67, lon: 100.6, isKey: true }));
  const outBox = Array.from({ length: 5 }, (_, i) => c(20 + i, "10", { lat: 13.85, lon: 100.4, isKey: true }));
  const ids = pickDerived([...inBox, ...outBox], new Set(), 4, 70);
  assert.equal(ids.filter((i) => i < 20).length, 4);
  assert.equal(ids.filter((i) => i >= 20).length, 4);
});

test("only key stations and watch/over-bank ones qualify, in the chosen regions only", () => {
  const ids = pickDerived(
    [c(1, "14", { isKey: true }), c(2, "14", { situation: 4 }), c(3, "14", { situation: 3 }), c(4, "71", { isKey: true }), c(5, "20", { situation: 5 })],
    new Set(),
  );
  assert.deepEqual(ids.sort((a, b) => a - b), [1, 2, 5]);
});

test("hardcoded stations are skipped", () => {
  assert.deepEqual(pickDerived([c(26, "12", { isKey: true }), c(99, "14", { isKey: true })], new Set([26])), [99]);
});

test("one flooded province cannot crowd out the others", () => {
  const ayutthaya = Array.from({ length: 21 }, (_, i) => c(100 + i, "14", { situation: 5 }));
  const ids = pickDerived([...ayutthaya, c(7, "18", { isKey: true }), c(8, "17", { isKey: true })], new Set(), 4, 70);
  assert.equal(ids.filter((i) => i >= 100).length, 4);
  assert.ok(ids.includes(7) && ids.includes(8));
});

test("overall cap applies and ranking prefers fresh, then key, then severity", () => {
  const cands = [
    c(1, "14", { isKey: true, fresh: false }),
    c(2, "15", { situation: 4 }),
    c(3, "16", { isKey: true }),
    c(4, "17", { situation: 5 }),
  ];
  assert.deepEqual(pickDerived(cands, new Set(), 4, 3), [3, 4, 2]); // stale key station is ranked last and cut by the cap
});

test("empty input is fine and ordering is deterministic", () => {
  assert.deepEqual(pickDerived([], new Set()), []);
  const cands = [c(5, "14", { isKey: true }), c(3, "15", { isKey: true })];
  assert.deepEqual(pickDerived(cands, new Set()), pickDerived([...cands].reverse(), new Set()));
});
