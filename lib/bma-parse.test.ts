import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { bmaStatus, inArea, parseBma, parseBmaDate, selectBma, type BmaStation } from "./bma-parse.ts";

// Frozen slice of the real GetDataForUpdate response (16 of 401 rows). Readings are stamped 2026-10-01 16:45 UTC.
const fixture: unknown = JSON.parse(readFileSync(new URL("./fixtures/bma_klongmap.json", import.meta.url), "utf8"));
const T = 1790873100000;
const NOW = T + 10 * 60_000;
const H = 3600_000;

const stations = parseBma(fixture);
const byId = (id: number) => {
  const s = stations.find((x) => x.id === id);
  assert.ok(s, `station ${id}`);
  return s;
};

function mk(over: Partial<BmaStation> = {}): BmaStation {
  return { id: 1, nameTh: "ก", nameEn: "A", kind: "pump", lat: 13.7, lon: 100.6, level: 0, warning: 0.5, critical: 0.8, outerLevel: null, maxToday: null, maxYesterday: null, at: NOW, ...over };
}

test("parses the real fixture", () => {
  // 16 rows: one has no coordinates and one has wl_in -99, so 14 are usable.
  assert.equal(stations.length, 14);
  const kinds = { canal: 0, pump: 0, gate: 0 };
  for (const s of stations) kinds[s.kind]++;
  assert.deepEqual(kinds, { canal: 3, pump: 6, gate: 5 });
  assert.equal(new Set(stations.map((s) => s.id)).size, stations.length);
});

test("maps fields and units (metres, ms epoch)", () => {
  const p = byId(43);
  assert.equal(p.kind, "pump");
  assert.equal(p.nameTh, "ส.พระโขนง");
  assert.equal(p.nameEn, "Khraw Phra Khanong");
  assert.equal(p.lat, 13.70901);
  assert.equal(p.lon, 100.59503);
  assert.equal(p.level, -0.9);
  assert.equal(p.warning, -0.2);
  assert.equal(p.critical, -0.1);
  assert.equal(p.outerLevel, 0.62);
  assert.equal(p.maxToday, -0.62);
  assert.equal(p.maxYesterday, -0.5);
  assert.equal(p.at, T);
  assert.equal(byId(29).kind, "gate");
  assert.equal(byId(64).kind, "canal");
});

test("outer level -99 becomes null; double spaces in names collapse", () => {
  assert.equal(byId(256).outerLevel, null);
  assert.equal(byId(237).nameTh, "ค.บางนา ถ.สุขุมวิท");
});

test("rows without a usable level or position are dropped", () => {
  assert.equal(stations.find((s) => s.id === 92), undefined); // wl_in -99
  assert.equal(stations.find((s) => s.nameTh === "คลองสองตะวันตก"), undefined); // no coordinates
});

test("-99 and null levels are dropped, other fields stay optional", () => {
  const row = (wl: unknown) => ({
    waterStation: [
      { water_id: "7", station_name: "ส.ทดสอบ", station_type_id: 2, active: 1, water_station_info: { latitude: 13.7, longitude: 100.6 }, water_level_last: { site_timestamp: "/Date(1790873100000)/", wl_in: wl } },
    ],
  });
  assert.equal(parseBma(row(-99)).length, 0);
  assert.equal(parseBma(row(null)).length, 0);
  assert.equal(parseBma(row(undefined)).length, 0);
  assert.equal(parseBma(row("0.5")).length, 0);
  assert.equal(parseBma(row(Number.NaN)).length, 0);
  const ok = parseBma(row(0.5));
  assert.equal(ok.length, 1);
  assert.equal(ok[0].warning, null);
  assert.equal(ok[0].critical, null);
  assert.equal(ok[0].maxToday, null);
  assert.equal(ok[0].nameEn, "ส.ทดสอบ"); // falls back to the Thai name
});

test("garbage input returns [] and never throws", () => {
  for (const g of [null, undefined, 0, "x", [], {}, { waterStation: null }, { waterStation: "x" }, { waterStation: [null, 1, "a", [], {}] }, { waterStation: [{ water_station_info: 5, water_level_last: 5 }] }]) {
    assert.deepEqual(parseBma(g), []);
  }
  const bad = { waterStation: [{ water_id: "x", station_type_id: 2, water_station_info: { latitude: 1, longitude: 1 }, water_level_last: { site_timestamp: "/Date(1)/", wl_in: 1 } }] };
  assert.deepEqual(parseBma(bad), []); // non-numeric id
});

test("unknown station types, inactive rows and bad timestamps are skipped", () => {
  const base = { water_id: "7", station_name: "ส.ก", station_type_id: 2, active: 1, water_station_info: { latitude: 13.7, longitude: 100.6 }, water_level_last: { site_timestamp: "/Date(1790873100000)/", wl_in: 0.1 } };
  const one = (over: object) => parseBma({ waterStation: [{ ...base, ...over }] }).length;
  assert.equal(one({}), 1);
  assert.equal(one({ station_type_id: 5 }), 0);
  assert.equal(one({ active: 0 }), 0);
  assert.equal(one({ water_level_last: { site_timestamp: "yesterday", wl_in: 0.1 } }), 0);
  assert.equal(one({ water_level_last: { wl_in: 0.1 } }), 0);
  assert.equal(one({ water_station_info: { latitude: "13.7", longitude: 100.6 } }), 0);
});

test("duplicate ids keep the first row", () => {
  const row = (name: string) => ({ water_id: "7", station_name: name, station_type_id: 2, water_station_info: { latitude: 13.7, longitude: 100.6 }, water_level_last: { site_timestamp: "/Date(1790873100000)/", wl_in: 0.1 } });
  const r = parseBma({ waterStation: [row("ก"), row("ข")] });
  assert.equal(r.length, 1);
  assert.equal(r[0].nameTh, "ก");
});

test("parses /Date(...)/ timestamps", () => {
  assert.equal(parseBmaDate("/Date(1790873100000)/"), 1790873100000);
  assert.equal(new Date(1790873100000).toISOString(), "2026-10-01T16:45:00.000Z");
  assert.equal(parseBmaDate("/Date(1790873100000+0700)/"), 1790873100000); // offset is ignored: the value is already UTC
  assert.equal(parseBmaDate("01/01/0544 00:00"), null);
  assert.equal(parseBmaDate(1790873100000), null);
  assert.equal(parseBmaDate(null), null);
  assert.equal(parseBmaDate("/Date(abc)/"), null);
});

test("inArea uses the Bang Na box edges inclusively", () => {
  assert.equal(inArea({ lat: 13.67, lon: 100.6 }), true);
  assert.equal(inArea({ lat: 13.5, lon: 100.52 }), true);
  assert.equal(inArea({ lat: 13.8, lon: 100.95 }), true);
  assert.equal(inArea({ lat: 13.49, lon: 100.6 }), false);
  assert.equal(inArea({ lat: 13.81, lon: 100.6 }), false);
  assert.equal(inArea({ lat: 13.7, lon: 100.51 }), false);
  assert.equal(inArea({ lat: 13.7, lon: 100.96 }), false);
  assert.equal(inArea({ lat: 13.7, lon: 100.6 }, { south: 14, north: 15, west: 100, east: 101 }), false);
});

test("bmaStatus at each threshold boundary", () => {
  const s = (level: number) => mk({ level, warning: 0.5, critical: 0.8 });
  assert.equal(bmaStatus(s(0.49), NOW), "normal");
  assert.equal(bmaStatus(s(0.5), NOW), "watch");
  assert.equal(bmaStatus(s(0.79), NOW), "watch");
  assert.equal(bmaStatus(s(0.8), NOW), "critical");
  assert.equal(bmaStatus(s(2), NOW), "critical");
  // Negative thresholds are real (datum is not always zero at the bank).
  assert.equal(bmaStatus(mk({ level: -0.3, warning: -0.2, critical: 0 }), NOW), "normal");
  assert.equal(bmaStatus(mk({ level: -0.2, warning: -0.2, critical: 0 }), NOW), "watch");
});

test("bmaStatus is stale after 3 h and for future readings", () => {
  assert.equal(bmaStatus(mk({ at: NOW - 3 * H }), NOW), "normal"); // exactly 3 h is still fresh
  assert.equal(bmaStatus(mk({ at: NOW - 3 * H - 1 }), NOW), "stale");
  assert.equal(bmaStatus(mk({ at: NOW - 5 * H, level: 2 }), NOW), "stale"); // old high reading is not trusted as critical
  assert.equal(bmaStatus(mk({ at: NOW + H }), NOW), "normal"); // 1 h of clock skew is tolerated
  assert.equal(bmaStatus(mk({ at: NOW + H + 1 }), NOW), "stale");
  assert.equal(bmaStatus(mk({ at: NOW + 20 * H }), NOW), "stale");
});

test("bmaStatus with missing thresholds cannot confirm normal", () => {
  assert.equal(bmaStatus(mk({ warning: null, critical: null }), NOW), "stale");
  assert.equal(bmaStatus(mk({ warning: null, critical: null, level: 5 }), NOW), "stale");
  assert.equal(bmaStatus(mk({ warning: 0.5, critical: null, level: 0.1 }), NOW), "stale");
  assert.equal(bmaStatus(mk({ warning: null, critical: 0.8, level: 0.1 }), NOW), "stale");
  // ...but an exceeded threshold is still reported.
  assert.equal(bmaStatus(mk({ warning: 0.5, critical: null, level: 0.6 }), NOW), "watch");
  assert.equal(bmaStatus(mk({ warning: null, critical: 0.8, level: 0.9 }), NOW), "critical");
});

test("bmaStatus on the real fixture", () => {
  assert.equal(bmaStatus(byId(29), NOW), "critical"); // gate 0.73 >= 0.5
  assert.equal(bmaStatus(byId(30), NOW), "watch"); // gate 0.21 >= 0.2
  assert.equal(bmaStatus(byId(48), NOW), "normal");
  assert.equal(bmaStatus(byId(169), NOW), "stale"); // March reading
  assert.equal(bmaStatus(byId(149), NOW), "stale"); // June reading
});

test("selectBma: pumps and gates first, canals only when at watch or critical", () => {
  const sel = selectBma(stations, NOW);
  assert.deepEqual(
    sel.map((s) => s.id),
    // Fresh pumps/gates by severity (29 critical, 30 watch, then normal by id), the stale pump, then canal 64 (critical).
    [29, 30, 43, 44, 48, 50, 66, 196, 256, 149, 64],
  );
  assert.equal(sel.find((s) => s.id === 237), undefined); // normal canal
  assert.equal(sel.find((s) => s.id === 169), undefined); // normal (stale) canal
  assert.equal(sel.find((s) => s.id === 100), undefined); // outside the box
  assert.equal(sel.find((s) => s.id === 92), undefined);
});

test("selectBma: fresh before stale, severity, then newest", () => {
  const a = mk({ id: 1, level: 0, at: NOW - 60_000 });
  const b = mk({ id: 2, level: 0, at: NOW - 5_000 });
  const c = mk({ id: 3, level: 0.6, at: NOW - 120_000 }); // watch
  const d = mk({ id: 4, level: 0.9, at: NOW - 6 * H }); // critical but stale
  const e = mk({ id: 5, level: 0.9, at: NOW - 30_000 }); // critical
  assert.deepEqual(selectBma([a, b, c, d, e], NOW).map((s) => s.id), [5, 3, 2, 1, 4]);
  // Stale canal at critical still sorts after fresh canals and after every pump and gate.
  const k1 = mk({ id: 10, kind: "canal", level: 0.9, at: NOW - 6 * H });
  const k2 = mk({ id: 11, kind: "canal", level: 0.6, at: NOW });
  const g = mk({ id: 12, kind: "gate", level: 0 });
  assert.deepEqual(selectBma([k1, k2, g], NOW).map((s) => s.id), [12, 11, 10]);
});

test("selectBma: cap is respected and pumps/gates win the slots", () => {
  const many = Array.from({ length: 60 }, (_, i) => mk({ id: 100 + i, kind: i % 2 ? "gate" : "pump" }));
  const canal = mk({ id: 1, kind: "canal", level: 0.9 });
  assert.equal(selectBma([canal, ...many], NOW).length, 40);
  assert.equal(selectBma([canal, ...many], NOW).some((s) => s.id === 1), false);
  assert.equal(selectBma([canal, ...many], NOW, 5).length, 5);
  assert.equal(selectBma([canal, ...many], NOW, 0).length, 0);
  assert.equal(selectBma([canal], NOW, 40).length, 1);
});

test("selectBma excludes stations outside the box and does not mutate its input", () => {
  const out = mk({ id: 1, lon: 100.3 });
  const north = mk({ id: 2, lat: 13.9 });
  const inside = mk({ id: 3 });
  const input = [out, north, inside];
  assert.deepEqual(selectBma(input, NOW).map((s) => s.id), [3]);
  assert.deepEqual(input.map((s) => s.id), [1, 2, 3]);
  assert.deepEqual(selectBma([], NOW), []);
});
