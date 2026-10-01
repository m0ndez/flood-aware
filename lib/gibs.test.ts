import assert from "node:assert/strict";
import test from "node:test";
import { FLOOD_DATE_RE, floodDates, floodTemplate } from "./gibs.ts";

test("flood dates run newest first, ending yesterday in UTC", () => {
  const now = Date.parse("2026-10-01T11:00:00Z");
  assert.deepEqual(floodDates(now), ["2026-09-30", "2026-09-29", "2026-09-28"]);
  assert.deepEqual(floodDates(Date.parse("2026-03-01T00:30:00Z")), ["2026-02-28", "2026-02-27", "2026-02-26"]);
  assert.ok(floodDates(now).every((d) => FLOOD_DATE_RE.test(d)));
});

test("tile template keeps Leaflet placeholders in GIBS order (z/y/x)", () => {
  assert.match(floodTemplate("2026-09-30"), /\/2026-09-30\/GoogleMapsCompatible_Level9\/\{z\}\/\{y\}\/\{x\}\.png$/);
});
