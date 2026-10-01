import assert from "node:assert/strict";
import test from "node:test";
import { pickDerived, regionOfProvince, type Candidate } from "./regions.ts";

const c = (id: number, provinceCode: string, over: Partial<Candidate> = {}): Candidate => ({
  id,
  provinceCode,
  isKey: false,
  situation: 3,
  fresh: true,
  ...over,
});

test("provinces map to the right region", () => {
  assert.equal(regionOfProvince("14"), "central"); // Ayutthaya
  assert.equal(regionOfProvince("10"), "central"); // Bangkok
  assert.equal(regionOfProvince("24"), "eastern"); // Chachoengsao
  assert.equal(regionOfProvince("71"), null); // Kanchanaburi is in neither view
  assert.equal(regionOfProvince(""), null);
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
