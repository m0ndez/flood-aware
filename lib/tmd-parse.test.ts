/* eslint-disable @typescript-eslint/no-explicit-any -- these tests mutate untyped upstream JSON fixtures on purpose */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { collectWarnings, decodeTmd, parseOutlook } from "./tmd-parse.ts";

const raw = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url));
const json = (n: string) => JSON.parse(raw(n).toString("utf8"));

test("outlook: 7 days for the province, oldest first, ISO dates, numbers parsed", () => {
  const days = parseOutlook(json("tmd_outlook.json"), "นนทบุรี");
  assert.equal(days.length, 7);
  assert.ok(days.every((d, i) => i === 0 || days[i - 1].date < d.date), "ascending although the feed is newest first");
  assert.match(days[0].date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(days.every((d) => typeof d.desc.th === "string" && typeof d.desc.en === "string"));
  assert.ok(days.some((d) => typeof d.rainPct === "number" && typeof d.max === "number"));
});

test("outlook: matches by Thai name; an unknown province is empty, not someone else's forecast", () => {
  assert.equal(parseOutlook(json("tmd_outlook.json"), "พระนครศรีอยุธยา").length, 7);
  assert.deepEqual(parseOutlook(json("tmd_outlook.json"), "ภูเก็ต"), []);
  for (const bad of [null, undefined, {}, { Provinces: {} }, { Provinces: { Province: "x" } }]) assert.deepEqual(parseOutlook(bad, "นนทบุรี"), []);
});

test("outlook: a row with a malformed date is dropped, the rest survive", () => {
  const j = json("tmd_outlook.json");
  j.Provinces.Province.find((p: any) => p.ProvinceNameThai === "นนทบุรี").SevenDaysForecast.ForecastDate[2] = "2026-10-03";
  assert.equal(parseOutlook(j, "นนทบุรี").length, 6);
});

test("warnings: the real v1 feed returns one bare object, which is still collected", () => {
  const w = collectWarnings(json("tmd_warnings_v1.json").WarningNews);
  assert.equal(w.length, 1);
  assert.equal(w[0].announced, "2022-10-16 17:06"); // seconds and millis trimmed
  assert.equal(w[0].titleEn, "Storm NESAT");
  assert.ok(w[0].descTh.length > 20);
});

test("warnings: the real v2 feed is empty today, arrays and nested shapes are collected, items without a date are skipped", () => {
  const v2 = JSON.parse(decodeTmd(Uint8Array.from(raw("tmd_warnings_v2.json")).buffer as ArrayBuffer, "application/json; charset=tis620"));
  assert.deepEqual(collectWarnings(v2.Warnings), []);
  const item = (o: object) => ({ TitleThai: "ฝนตกหนัก", AnnounceDateTime: "2026-10-01 08:00:00.000", ...o });
  assert.equal(collectWarnings([item({ IssueNo: "1" }), item({ IssueNo: "2" })]).length, 2);
  assert.equal(collectWarnings({ Warning: { Items: [item({})] } }).length, 1);
  assert.equal(collectWarnings([item({ AnnounceDateTime: undefined })]).length, 0); // cannot judge freshness, so not shown
  assert.deepEqual(collectWarnings(undefined), []);
  assert.deepEqual(collectWarnings("text"), []);
});

test("decode: tis620 Thai text round-trips, utf-8 is the default, and an unknown charset never throws", () => {
  const thai = "พายุ";
  const tis = Uint8Array.from([...thai].map((c) => c.codePointAt(0)! - 0x0e01 + 0xa1)); // TIS-620: U+0E01 -> 0xA1
  assert.equal(decodeTmd(tis.buffer as ArrayBuffer, "application/json; charset=tis620"), thai);
  assert.equal(decodeTmd(new TextEncoder().encode(thai).buffer as ArrayBuffer, "application/json"), thai);
  assert.doesNotThrow(() => decodeTmd(new TextEncoder().encode(thai).buffer as ArrayBuffer, "application/json; charset=x-bogus"));
  assert.equal(decodeTmd(new TextEncoder().encode(thai).buffer as ArrayBuffer, "application/json; charset=x-bogus"), thai);
});
