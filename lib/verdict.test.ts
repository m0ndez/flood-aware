import assert from "node:assert/strict";
import test from "node:test";
import { countStatuses, headlineOf, severityRank, total, worstOf } from "./verdict.ts";

const c = (critical = 0, watch = 0, stale = 0, normal = 0) => ({ critical, watch, stale, normal });

test("counts every status and totals them", () => {
  const counts = countStatuses(["watch", "watch", "critical", "stale", "normal", "normal", "normal"]);
  assert.deepEqual(counts, c(1, 2, 1, 3));
  assert.equal(total(counts), 7);
});

test("severity ranks critical > watch > stale > normal (unknown is worse than confirmed fine)", () => {
  const order = ["normal", "stale", "watch", "critical"] as const;
  for (let i = 1; i < order.length; i++) assert.ok(severityRank(order[i]) > severityRank(order[i - 1]));
});

test("headline: critical wins and mentions watch; watch says none over bank", () => {
  assert.deepEqual(headlineOf(c(2, 5, 1, 3)), { kind: "critical", critical: 2, watch: 5, stale: 1 });
  assert.deepEqual(headlineOf(c(0, 2, 0, 12)), { kind: "watch", critical: 0, watch: 2, stale: 0 });
});

test("headline never says all normal when nothing could be confirmed", () => {
  assert.equal(headlineOf(c(0, 0, 14, 0))?.kind, "allStale");
  assert.equal(headlineOf(c(0, 0, 3, 11))?.kind, "allNormal"); // confirmed ones are normal, the stale count is shown separately
  assert.equal(headlineOf(c()), null);
});

test("the icon follows the headline", () => {
  assert.equal(worstOf(c(1, 0, 0, 0)), "critical");
  assert.equal(worstOf(c(0, 3, 9, 0)), "watch");
  assert.equal(worstOf(c(0, 0, 14, 0)), "stale");
  assert.equal(worstOf(c(0, 0, 2, 5)), "normal");
  assert.equal(worstOf(c()), "normal");
});
