import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BANGNA_BOX } from "./regions.ts";
import { currentRoads, parseRoads, roadsInBox, sourceOf, type RoadReport } from "./roads-parse.ts";

const fixture: unknown = JSON.parse(readFileSync(new URL("./fixtures/longdo_events.json", import.meta.url), "utf8"));
const fixtureRows = fixture as { eid: string; type: string }[];
const H = 3600_000;
// 2026-10-02 00:30 ICT, the evening the fixture was captured.
const NOW = Date.UTC(2026, 9, 1, 17, 30);

const ev = (o: Record<string, unknown> = {}) => ({
  eid: "1", title: "น้ำท่วม ถนนทดสอบ", title_en: "Flood at Test Rd.", description: "ถนนทดสอบ", latitude: "13.7", longitude: "100.6",
  type: "6", start: "2026-10-01 12:00:00", stop: "2026-10-02 12:00:00", contributor: "itic_user", ...o,
});
const rep = (o: Partial<RoadReport> = {}): RoadReport => ({
  id: "1", title: "น้ำท่วม A", titleEn: "", place: "", lat: 13.7, lon: 100.6, start: NOW - H, stop: NOW + H, source: "public", ...o,
});

test("real fixture: only type 6 survives, with clean fields", () => {
  const floods = fixtureRows.filter((e) => e.type === "6");
  assert.ok(floods.length >= 20 && floods.length < fixtureRows.length, "fixture mixes flood and non-flood events");
  const out = parseRoads(fixture);
  assert.equal(out.length, floods.length);
  assert.deepEqual(new Set(out.map((r) => r.id)), new Set(floods.map((e) => e.eid)));
  for (const r of out) {
    assert.ok(r.title.length > 0 && r.place.length <= 160);
    assert.ok(!/[\u0000-\u001f<>]|Cr\./i.test(r.place), `dirty place for ${r.id}: ${JSON.stringify(r.place)}`);
    assert.ok(r.stop >= r.start);
    assert.ok(["doh", "itic", "public"].includes(r.source));
  }
  assert.ok(new Set(out.map((r) => r.source)).size === 3, "fixture has all three contributor kinds");
});

test("real fixture: Bang Na box and currentRoads behave on a pinned clock", () => {
  const all = parseRoads(fixture);
  const near = roadsInBox(all, BANGNA_BOX);
  assert.ok(near.length >= 15 && near.length < all.length);
  const cur = currentRoads(all, NOW);
  assert.ok(cur.length > 0 && cur.length < all.length, "iTIC day-windows ended at 23:59, 2026-09-18 report is too old");
  assert.ok(!cur.some((r) => r.id === "978201"), "18-day-old DOH report dropped");
  assert.ok(!cur.some((r) => r.id === "977707"), "report that ended 23:59:59 dropped");
  assert.ok(cur.some((r) => r.id === "978142"));
  for (let i = 1; i < cur.length; i++) assert.ok(cur[i - 1].start >= cur[i].start);
});

test("times are ICT (UTC+7), seconds kept", () => {
  const [r] = parseRoads([ev({ start: "2026-10-01 07:00:00", stop: "2026-10-01 23:59:59" })]);
  assert.equal(r.start, Date.UTC(2026, 9, 1, 0, 0, 0));
  assert.equal(r.stop, Date.UTC(2026, 9, 1, 16, 59, 59));
  const [r2] = parseRoads([ev({ start: "2026-10-01 00:00:01", stop: "2026-10-01 00:00:02" })]);
  assert.equal(r2.start, Date.UTC(2026, 8, 30, 17, 0, 1));
});

test("bad dates are dropped, never thrown", () => {
  for (const [start, stop] of [["", "2026-10-02 12:00:00"], ["2026-10-01", "2026-10-02 12:00:00"], ["2026-13-01 00:00:00", "2026-10-02 12:00:00"],
    ["2026-10-01 12:00:00", "soon"], ["2026-10-01 12:00:99", "2026-10-02 12:00:00"], [null, null], [20261001, 20261002],
    ["2026-10-02 12:00:00", "2026-10-01 12:00:00"]]) {
    assert.deepEqual(parseRoads([ev({ start, stop })]), [], JSON.stringify([start, stop]));
  }
});

test("type filter keeps only flood events, numeric or string", () => {
  const out = parseRoads([ev({ eid: "a", type: "6" }), ev({ eid: "b", type: "1" }), ev({ eid: "c", type: "18" }), ev({ eid: "d", type: 6 }), ev({ eid: "e", type: undefined })]);
  assert.deepEqual(out.map((r) => r.id), ["a", "d"]);
});

test("garbage and empty input give []", () => {
  for (const g of [undefined, null, 0, "", "[]", {}, { events: [] }, [], [null], [1, "x", []], [{}], [{ type: "6" }], [ev({ title: "" })], [ev({ eid: "" })]]) {
    assert.deepEqual(parseRoads(g), [], JSON.stringify(g));
  }
});

test("coordinates must be finite and inside Thailand", () => {
  const bad = [["0", "0"], ["", ""], ["abc", "100"], ["13.7", "NaN"], ["Infinity", "100"], ["100.6", "13.7"], ["5.4", "100"], ["20.7", "100"], ["13.7", "97.2"], ["13.7", "105.8"], [null, null], [[], {}]];
  for (const [latitude, longitude] of bad) assert.deepEqual(parseRoads([ev({ latitude, longitude })]), [], JSON.stringify([latitude, longitude]));
  for (const [latitude, longitude] of [["5.5", "97.3"], ["20.6", "105.7"], [13.7, 100.6]]) assert.equal(parseRoads([ev({ latitude, longitude })]).length, 1);
  const [r] = parseRoads([ev({ latitude: "13.746718497691", longitude: "100.50988980519" })]);
  assert.equal(r.lat, 13.746718497691);
  assert.equal(r.lon, 100.50988980519);
});

test("source mapping from contributor", () => {
  assert.equal(sourceOf("DOH Admin"), "doh");
  assert.equal(sourceOf("itic.nirat"), "itic");
  assert.equal(sourceOf("itic.iyarin"), "itic");
  assert.equal(sourceOf("itic_user"), "public");
  assert.equal(sourceOf("piromyaa"), "public");
  assert.equal(sourceOf(""), "public");
  assert.equal(sourceOf(undefined), "public");
  assert.equal(sourceOf(42), "public");
  const out = parseRoads([ev({ eid: "1", contributor: "DOH Admin" }), ev({ eid: "2", contributor: "itic.nirat" }), ev({ eid: "3", contributor: "itic_user" }), ev({ eid: "4", contributor: "RVP" })]);
  assert.deepEqual(out.map((r) => r.source), ["doh", "itic", "public", "public"]);
});

test("description cleaning: CRLF, credits, tags, control chars, 160 cap", () => {
  const place = (description: unknown) => parseRoads([ev({ description })])[0].place;
  assert.equal(place("ทางคู่ขนานถนนเทพรัตน ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540 รายงานโดย SUPRIYA"), "ทางคู่ขนานถนนเทพรัตน ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ 10540", "reporter handles are not republished");
  assert.equal(place("น้ำท่วม ทางหลวงชนบท สป.2003 ต.บางบ่อ จ.สมุทรปราการ\r\n\r\nCr.NT"), "น้ำท่วม ทางหลวงชนบท สป.2003 ต.บางบ่อ จ.สมุทรปราการ");
  assert.equal(place("ท่วมขังมา 6 วัน! หมู่บ้านพฤกษา 20 \r\n\r\nCr.FM91trafficpro"), "ท่วมขังมา 6 วัน! หมู่บ้านพฤกษา 20");
  assert.equal(place("ซอยสุขุมวิท 101\nCr. Fm91"), "ซอยสุขุมวิท 101");
  assert.equal(place("ถนน <b>ทดสอบ</b><script>alert(1)</script> ลาดพร้าว"), "ถนน ทดสอบ alert(1) ลาดพร้าว");
  assert.equal(place("ก\u0000ข\u0007ค\tง\u2028จ"), "ก ข ค ง จ");
  assert.equal(place("  a \n\n  b   c  "), "a b c");
  assert.equal(place(null), "");
  assert.equal(place(123), "");
  const long = place("ก".repeat(500));
  assert.ok(Array.from(long).length <= 160, `len ${Array.from(long).length}`);
  assert.ok(long.endsWith("…"));
  assert.equal(place("x".repeat(160)).length, 160);
  assert.equal(place("a\nสาเหตุ: ฝนตก\nการแก้ไข: กระสอบทราย").includes("\n"), false);
  // Title is cleaned the same way.
  assert.equal(parseRoads([ev({ title: "น้ำท่วม <i>ซอย</i>\r\nCr.NT" })])[0].title, "น้ำท่วม ซอย");
});

test("currentRoads: ended, too old, and future rules", () => {
  const maxAge = 48 * H;
  const keep = rep({ id: "keep", title: "keep", start: NOW - 2 * H, stop: NOW + H });
  const ended = rep({ id: "ended", title: "ended", start: NOW - 5 * H, stop: NOW - 1 });
  const endsNow = rep({ id: "endsNow", title: "endsNow", start: NOW - 5 * H, stop: NOW });
  const exactAge = rep({ id: "exactAge", title: "exactAge", start: NOW - maxAge, stop: NOW + H });
  const tooOld = rep({ id: "tooOld", title: "tooOld", start: NOW - maxAge - 1, stop: NOW + 100 * H });
  const soon = rep({ id: "soon", title: "soon", start: NOW + H, stop: NOW + 5 * H });
  const future = rep({ id: "future", title: "future", start: NOW + H + 1, stop: NOW + 5 * H });
  const ids = (a: RoadReport[]) => a.map((r) => r.id).sort();
  assert.deepEqual(ids(currentRoads([keep, ended, endsNow, exactAge, tooOld, soon, future], NOW)), ["endsNow", "exactAge", "keep", "soon"]);
  assert.deepEqual(ids(currentRoads([exactAge, tooOld], NOW, 49 * H)), ["exactAge", "tooOld"]);
  assert.deepEqual(ids(currentRoads([keep, exactAge], NOW, H)), []);
  assert.deepEqual(currentRoads([], NOW), []);
});

test("currentRoads: dedupes same title at same rounded coords, keeping newest start", () => {
  const a = rep({ id: "old", start: NOW - 10 * H });
  const b = rep({ id: "new", start: NOW - 2 * H, lat: 13.70004, lon: 100.60004 });
  const other = rep({ id: "elsewhere", lat: 13.75 });
  const diffTitle = rep({ id: "diffTitle", title: "น้ำท่วม B" });
  const out = currentRoads([a, b, other, diffTitle], NOW);
  assert.deepEqual(out.map((r) => r.id).sort(), ["diffTitle", "elsewhere", "new"]);
  assert.equal(currentRoads([b, a], NOW).find((r) => r.title === "น้ำท่วม A" && r.lat < 13.71)?.id, "new");
});

test("currentRoads: newest start first, stable on ties, does not mutate input", () => {
  const rs = [rep({ id: "1", title: "a", start: NOW - 3 * H }), rep({ id: "2", title: "b", start: NOW - H }), rep({ id: "3", title: "c", start: NOW - 2 * H }), rep({ id: "4", title: "d", start: NOW - H })];
  const copy = rs.map((r) => r.id);
  assert.deepEqual(currentRoads(rs, NOW).map((r) => r.id), ["4", "2", "3", "1"]);
  assert.deepEqual(rs.map((r) => r.id), copy);
});

test("roadsInBox is inclusive on the edges", () => {
  const box = { south: 13.5, north: 13.8, west: 100.52, east: 100.95 };
  const rs = [rep({ id: "in" }), rep({ id: "edge", lat: 13.5, lon: 100.95 }), rep({ id: "north", lat: 13.81 }), rep({ id: "west", lon: 100.5 })];
  assert.deepEqual(roadsInBox(rs, box).map((r) => r.id), ["in", "edge"]);
});

test("a hostile huge array is bounded", () => {
  const out = parseRoads(Array.from({ length: 20_000 }, (_, i) => ev({ eid: String(i) })));
  assert.equal(out.length, 5000);
});
