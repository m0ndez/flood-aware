import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { bmaId, bmaReading, bmaStation, bmaUiStatus, isBmaId } from "./bma-adapt.ts";
import { parseBma, type BmaStation } from "./bma-parse.ts";

const real = parseBma(JSON.parse(readFileSync(new URL("./fixtures/bma_klongmap.json", import.meta.url), "utf8")));
const base: BmaStation = { id: 43, nameTh: "ส.พระโขนง", nameEn: "", kind: "pump", lat: 13.7, lon: 100.6, level: 0, warning: 0.6, critical: 0.7, outerLevel: null, maxToday: null, maxYesterday: null, at: Date.UTC(2026, 9, 1, 16, 45) };
const NOW = base.at + 10 * 60_000;

test("ids are negative so they never collide with ThaiWater, and round-trip", () => {
  assert.equal(bmaId(base), -43);
  assert.ok(isBmaId(-43) && !isBmaId(26));
  for (const s of real) assert.ok(bmaStation(s).id < 0 && bmaStation(s).region === "bangna");
});

test("BMA is amber at most: critical folds into watch, never red", () => {
  assert.equal(bmaUiStatus({ ...base, level: 0.3 }, NOW), "normal");
  assert.equal(bmaUiStatus({ ...base, level: 0.6 }, NOW), "watch");
  assert.equal(bmaUiStatus({ ...base, level: 0.9 }, NOW), "watch", "above the critical mark is still only watch");
  assert.equal(bmaUiStatus({ ...base, level: 0.3, at: base.at - 4 * 3600_000 }, NOW), "stale");
  assert.equal(bmaUiStatus({ ...base, level: 0.3, warning: null, critical: null }, NOW), "stale", "no marks: cannot confirm");
  for (const s of real) assert.notEqual(bmaUiStatus(s, s.at + 60_000), "critical");
});

test("reading carries the warning mark and local Thai time", () => {
  const r = bmaReading({ ...base, level: 0.3 }, "normal");
  assert.equal(r.bankM, 0.6);
  assert.equal(r.datetime, "2026-10-01 23:45", "16:45 UTC is 23:45 ICT");
  assert.equal(r.bankPct, null);
  assert.equal(bmaReading({ ...base, warning: null }, "normal").bankM, 0.7, "falls back to the critical mark");
});

test("a station without an English name is flagged Thai-only", () => {
  assert.equal(bmaStation(base).thaiOnly, true);
  assert.equal(bmaStation({ ...base, nameEn: "Phra Khanong" }).name.en, "Phra Khanong");
});
