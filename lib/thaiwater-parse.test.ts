/* eslint-disable @typescript-eslint/no-explicit-any -- these tests mutate untyped upstream JSON fixtures on purpose */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isStale } from "./status.ts";
import { CORE_STATIONS } from "./stations.ts";
import { km, nearestRain, parseGraph, parseOverview, parseRain, parseRows, unwrap } from "./thaiwater-parse.ts";

// Real upstream rows, frozen on 2026-10-01 (see lib/fixtures). They include a gauge stamped 23:00 at 15:50.
const fx = (n: string) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8"));
const rows = fx("waterlevel_load.json").waterlevel_data.data as Record<string, any>[];
const rain = fx("rain_24h.json").data as unknown[];
const NOW = Date.parse("2026-10-01T15:55:00+07:00");
const row = (id: number) => structuredClone(rows.find((r) => r.station.id === id)!);

test("unwrap accepts the OK envelope and rejects anything else", () => {
  assert.deepEqual(unwrap({ result: "OK", data: [1] }), [1]);
  for (const bad of [null, undefined, "x", [], {}, { result: "FAIL", data: [] }]) assert.throws(() => unwrap(bad), /bad envelope/);
});

test("parseRows reads every real row and coerces numeric strings", () => {
  const out = parseRows(rows);
  assert.equal(out.length, rows.length);
  const cpy = out.find((r) => r.reading.id === 26)!;
  assert.equal(cpy.code, "CPY014");
  assert.equal(typeof cpy.reading.levelMsl, "number");
  assert.equal(typeof cpy.reading.bankM, "number");
  assert.equal(cpy.provinceCode, "12");
  const stringy = row(26);
  stringy.waterlevel_msl = "2.5";
  assert.equal(parseRows([stringy])[0].reading.levelMsl, 2.5);
});

test("parseRows drops rows it cannot trust instead of inventing values", () => {
  const noLat = row(26); delete noLat.station.tele_station_lat;
  const wrongType = row(26); wrongType.station_type = "manual";
  const nanLevel = row(26); nanLevel.waterlevel_msl = "abc";
  const noLevel = row(26); nanLevel.waterlevel_msl = null; noLevel.waterlevel_msl = null;
  const numDate = row(26); numDate.waterlevel_datetime = 20261001;
  const noSituation = row(26); delete noSituation.situation_level;
  const noId = row(26); delete noId.station.id;
  assert.deepEqual(parseRows([noLat, wrongType, nanLevel, noLevel, numDate, noSituation, noId, null, 42, "x"]), []);
  assert.deepEqual(parseRows(undefined), []);
  assert.deepEqual(parseRows({ not: "an array" }), []);
});

test("a missing bank level is null, never 0 (a 0 would read as 'at the bank')", () => {
  const r = row(26); delete r.station.min_bank; r.storage_percent = null;
  const out = parseRows([r])[0].reading;
  assert.equal(out.bankM, null);
  assert.equal(out.bankPct, null);
});

test("the real future-dated gauge keeps its timestamp so the stale rule can catch it", () => {
  const kanchanaburi = parseRows(rows).find((r) => r.reading.id === 505018)!;
  assert.equal(kanchanaburi.reading.datetime, "2026-10-01 23:00");
  assert.equal(isStale(kanchanaburi.reading.datetime, NOW), true);
});

test("parseOverview: all 14 hardcoded stations stay listed, readings only exist for those in the feed", () => {
  const { stations, readings } = parseOverview(rows, NOW);
  for (const c of CORE_STATIONS) assert.ok(stations.some((s) => s.id === c.id), `core ${c.id} listed`);
  const present = new Set(rows.map((r) => r.station.id));
  for (const c of CORE_STATIONS) assert.equal(readings.some((r) => r.id === c.id), present.has(c.id));
});

test("parseOverview derives Central/Eastern stations: key or high, in the chosen provinces only", () => {
  const { stations } = parseOverview(rows, NOW);
  const derived = stations.filter((s) => s.group === "province");
  assert.deepEqual(derived.map((s) => s.id).sort((a, b) => a - b), [131, 2611, 504994, 1098950]);
  const byId = new Map(derived.map((s) => [s.id, s]));
  assert.equal(byId.get(2611)!.region, "central"); // Ayutthaya, key
  assert.equal(byId.get(504994)!.region, "eastern"); // Prachin Buri, key
  assert.equal(byId.get(131)!.region, "eastern"); // Chanthaburi, not key but over bank
  assert.ok(!stations.some((s) => s.id === 505018), "Kanchanaburi is in neither view");
  assert.ok(!stations.some((s) => s.id === 83), "a normal, non-key gauge is not worth a marker");
});

test("parseOverview flags Thai-only names and keeps province info for grouping", () => {
  const { stations } = parseOverview(rows, NOW);
  const s2611 = stations.find((s) => s.id === 2611)!;
  assert.equal(s2611.thaiOnly, true);
  assert.equal(s2611.name.en, s2611.name.th); // falls back to Thai instead of an empty string
  assert.equal(s2611.provinceCode, "14");
  assert.ok(s2611.province && s2611.province.th.length > 0);
  assert.equal(stations.find((s) => s.id === 131)!.thaiOnly, false);
});

test("parseOverview survives garbage input", () => {
  for (const bad of [undefined, null, "x", {}, [null, 1, "x"]]) {
    const { stations, readings } = parseOverview(bad, NOW);
    assert.equal(readings.length, 0);
    assert.equal(stations.length, CORE_STATIONS.length);
  }
});

test("parseRain keeps valid gauges, falls back to the Thai name, and drops broken rows", () => {
  const out = parseRain(rain);
  assert.equal(out.length, rain.length);
  assert.ok(out.every((r) => r.name.en.length > 0));
  const broken = [{ station: {}, rain_24h: 3 }, { station: { tele_station_name: { th: "x" }, tele_station_lat: 1, tele_station_long: 1 }, rain_24h: "n/a", rainfall_datetime: "2026-10-01 10:00" }, null];
  assert.deepEqual(parseRain(broken), []);
  assert.deepEqual(parseRain(undefined), []);
});

test("a missing 1-hour rain value is null, not 0 mm", () => {
  const r = structuredClone(rain[0]) as Record<string, any>;
  delete r.rain_1h;
  assert.equal(parseRain([r])[0].h1, null);
});

test("nearestRain picks the closest gauge and reports the distance; no gauges means null", () => {
  const gauges = parseRain(rain);
  const pak = nearestRain(13.94749, 100.53507, gauges)!;
  assert.equal(pak.name.th, "สะพานนวลฉวี");
  assert.ok(pak.km < 0.1);
  assert.equal(nearestRain(13.9, 100.5, []), null);
  assert.ok(km(13, 100, 14, 100) > 100 && km(13, 100, 14, 100) < 120);
});

test("parseGraph keeps good points, drops bad ones, and reads the bank level", () => {
  const g = parseGraph({
    graph_data: [{ datetime: "2026-10-01 10:00", value: 2.4 }, { datetime: "2026-10-01 10:10", value: "2.5" }, { datetime: 5, value: 2 }, { datetime: "x", value: "nope" }, null],
    min_bank: 2.5,
  });
  assert.deepEqual(g.points, [{ t: "2026-10-01 10:00", v: 2.4 }, { t: "2026-10-01 10:10", v: 2.5 }]);
  assert.equal(g.bankM, 2.5);
  assert.deepEqual(parseGraph(undefined), { points: [], bankM: null });
});
