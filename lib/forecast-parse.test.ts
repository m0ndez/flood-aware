import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseForecast } from "./forecast-parse.ts";

const real = () => JSON.parse(readFileSync(new URL("./fixtures/open_meteo.json", import.meta.url), "utf8"));

test("parses a real Open-Meteo response into Thai-time hours and days", () => {
  const f = parseForecast(real());
  assert.equal(f.hours.length, 72);
  assert.equal(f.days.length, 3);
  assert.match(f.hours[0].t, /^\d{4}-\d{2}-\d{2} \d{2}:00$/); // "T" replaced, local time kept
  assert.ok(f.hours.every((h) => h.mm >= 0));
  assert.ok(f.days.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.d)));
});

test("a missing hour is unknown, not dry: it is dropped, never turned into 0 mm", () => {
  const j = real();
  j.hourly.precipitation[5] = null;
  const f = parseForecast(j);
  assert.equal(f.hours.length, 71);
  assert.ok(!f.hours.some((h) => h.t === j.hourly.time[5].replace("T", " ")));
});

test("missing probabilities become null", () => {
  const j = real();
  delete j.hourly.precipitation_probability;
  assert.ok(parseForecast(j).hours.every((h) => h.prob === null));
});

test("an unrecognised shape throws, so it is never cached or shown", () => {
  const j = real();
  j.hourly.time.pop(); // length mismatch
  assert.throws(() => parseForecast(j), /bad shape/);
  for (const bad of [null, undefined, "x", {}, { hourly: {}, daily: {} }]) assert.throws(() => parseForecast(bad), /bad shape/);
});
