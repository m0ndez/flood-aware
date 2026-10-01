import assert from "node:assert/strict";
import test from "node:test";
import { relevantWarnings, type Warning } from "./warnings.ts";

const now = Date.parse("2026-10-01T11:00:00+07:00");
const w = (announced: string, titleTh: string, descTh = ""): Warning => ({
  issueNo: "1",
  announced,
  titleTh,
  titleEn: "",
  descTh,
});

test("fresh warning that mentions the area is kept", () => {
  const keep = w("2026-10-01 08:00", "ฝนตกหนัก", "ภาคกลางมีฝนตกหนักถึงหนักมาก");
  assert.deepEqual(relevantWarnings([keep], now), [keep]);
  assert.equal(relevantWarnings([w("2026-10-01 08:00", "น้ำท่วมนนทบุรี")], now).length, 1);
});

test("the 2022 storm item in the live feed is dropped", () => {
  assert.equal(relevantWarnings([w("2022-10-16 17:06", "พายุ เนสาท", "ภาคกลาง กรุงเทพ")], now).length, 0);
});

test("fresh but unrelated, over-72h, and future items are dropped", () => {
  assert.equal(relevantWarnings([w("2026-10-01 08:00", "พายุ", "ภาคใต้ตอนล่าง")], now).length, 0);
  assert.equal(relevantWarnings([w("2026-09-28 10:59", "ฝน", "กรุงเทพ")], now).length, 0); // 72h01m
  assert.equal(relevantWarnings([w("2026-09-28 11:00", "ฝน", "กรุงเทพ")], now).length, 1); // exactly 72h
  assert.equal(relevantWarnings([w("2026-10-02 11:00", "ฝน", "กรุงเทพ")], now).length, 0); // future
  assert.equal(relevantWarnings([w("garbage", "ฝน", "กรุงเทพ")], now).length, 0);
});
