import assert from "node:assert/strict";
import test from "node:test";
import { isStale, statusOf, trendOf } from "./status.ts";

const now = Date.parse("2026-10-01T10:30:00+07:00");

test("status maps ThaiWater situation_level", () => {
  const fresh = "2026-10-01 10:20";
  assert.equal(statusOf(1, fresh, now), "normal");
  assert.equal(statusOf(3, fresh, now), "normal");
  assert.equal(statusOf(4, fresh, now), "watch");
  assert.equal(statusOf(5, fresh, now), "critical");
});

test("future, old and unparseable timestamps are stale, never normal", () => {
  assert.equal(isStale("2026-10-01 23:00", now), true); // future (real RID quirk)
  assert.equal(isStale("2026-10-01 07:29", now), true); // 3h01m old
  assert.equal(isStale("2026-10-01 07:30", now), false); // exactly 3h
  assert.equal(isStale("garbage", now), true);
  assert.equal(statusOf(1, "2026-10-01 23:00", now), "stale");
  assert.equal(statusOf(5, "2026-09-30 10:00", now), "stale");
});

// 4 days of hourly points: a daily-mean slope (m/day) plus a +/-0.3 m semi-diurnal tide.
function tidal(slopePerDay: number) {
  const end = Date.parse("2026-10-01T10:00:00+07:00");
  return Array.from({ length: 96 }, (_, i) => {
    const ms = end - (95 - i) * 3600_000;
    const tide = 0.3 * Math.sin((2 * Math.PI * (ms - end)) / (12.42 * 3600_000));
    return {
      t: new Date(ms + 7 * 3600_000).toISOString().slice(0, 16).replace("T", " "),
      v: 2 + (slopePerDay * (ms - end)) / 86_400_000 + tide,
    };
  });
}

test("trend follows the daily mean and ignores the tide", () => {
  assert.equal(trendOf(tidal(0.3)), "rising");
  assert.equal(trendOf(tidal(-0.3)), "falling");
  assert.equal(trendOf(tidal(0)), "steady"); // pure tide must not read as rising/falling
});

test("trend needs two full days of data", () => {
  assert.equal(trendOf([]), null);
  assert.equal(trendOf(tidal(0.3).slice(-30)), null); // only ~30 h, previous window too thin
});
