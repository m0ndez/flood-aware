import assert from "node:assert/strict";
import test from "node:test";
import { CORE_STATIONS, type Station } from "./stations.ts";
import { groupKeyOf, makeHref, makeStatusFor, resolveView } from "./view-state.ts";

const derived = (id: number, region: "central" | "eastern", provinceCode: string): Station => ({
  id,
  code: `D${id}`,
  group: "province",
  region,
  name: { th: "ก", en: "A" },
  river: { th: "", en: "" },
  province: { th: "จ", en: "P" },
  provinceCode,
});
const stations: Station[] = [...CORE_STATIONS, derived(2611, "central", "14"), derived(504994, "eastern", "25")];

test("no usable ?station= is the list view in Nonthaburi", () => {
  for (const sp of [{}, { station: "abc" }, { station: "" }, { station: "999999" }, { station: ["x"] }]) {
    const v = resolveView(sp, stations);
    assert.equal(v.selectedId, null);
    assert.equal(v.region, "nonthaburi");
  }
});

test("the open station decides the region, even against a conflicting ?region=", () => {
  const v = resolveView({ station: "504994", region: "central" }, stations);
  assert.equal(v.selectedId, 504994);
  assert.equal(v.region, "eastern");
  assert.deepEqual(v.inRegion.map((s) => s.id), [504994]);
});

test("?region= is honoured when valid and falls back when not", () => {
  assert.equal(resolveView({ region: "central" }, stations).region, "central");
  assert.equal(resolveView({ region: ["eastern", "central"] }, stations).region, "eastern");
  for (const bad of ["CENTRAL", "north", "", "../x"]) assert.equal(resolveView({ region: bad }, stations).region, "nonthaburi");
});

test("a group only counts if it exists in the region on screen", () => {
  assert.equal(resolveView({ group: "upstream" }, stations).activeGroup, "upstream");
  assert.equal(resolveView({ region: "central", group: "p14" }, stations).activeGroup, "p14");
  assert.equal(resolveView({ group: "p14" }, stations).activeGroup, null, "a Central province in the Nonthaburi view");
  assert.equal(resolveView({ group: "<script>" }, stations).activeGroup, null);
  assert.equal(groupKeyOf(derived(1, "central", "14")), "p14");
  assert.equal(groupKeyOf(CORE_STATIONS[0]), "nonthaburi");
});

test("links carry language, station, camera and the active group; a region change drops the group", () => {
  const href = makeHref("th", "upstream");
  assert.equal(href(26), "/?station=26&lang=th&group=upstream");
  assert.equal(href(26, { lang: "en", cam: "A 1" }), "/?station=26&lang=en&cam=A%201&group=upstream");
  assert.equal(href(null, { region: "central", group: null }), "/?region=central&lang=th");
  assert.equal(href(null, { region: "nonthaburi", group: null }), "/?lang=th", "the default region is not written");
  assert.equal(href(null, { group: "p14" }), "/?lang=th&group=p14");
  assert.equal(makeHref("en", null)(null), "/?lang=en");
});

test("a failed fetch, a missing reading or old data can never read as normal", () => {
  const now = Date.parse("2026-10-01T10:30:00+07:00");
  const fresh = { id: 1, lat: 0, lon: 0, levelMsl: 1, datetime: "2026-10-01 10:20", situation: 1, bankPct: null, bankM: null };
  assert.equal(makeStatusFor(false, now)(fresh), "normal");
  assert.equal(makeStatusFor(true, now)(fresh), "stale", "upstream failure forces stale");
  assert.equal(makeStatusFor(false, now)(undefined), "stale", "no reading");
  assert.equal(makeStatusFor(false, now)({ ...fresh, datetime: "2026-10-01 23:00" }), "stale", "future timestamp");
  assert.equal(makeStatusFor(false, now)({ ...fresh, situation: 5 }), "critical");
});
