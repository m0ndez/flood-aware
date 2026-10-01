import assert from "node:assert/strict";
import test from "node:test";
import { clientKey, makeLimiter } from "./ratelimit.ts";

test("allows up to the limit, then refuses with a retry hint", () => {
  let t = 1_000;
  const check = makeLimiter(3, 60_000, () => t);
  assert.deepEqual([check("a"), check("a"), check("a")].map((r) => r.ok), [true, true, true]);
  const blocked = check("a");
  assert.equal(blocked.ok, false);
  assert.ok(!blocked.ok && blocked.retryAfterS >= 1 && blocked.retryAfterS <= 60);
  t += 30_000;
  assert.equal(check("a").ok, false); // same window
});

test("the window resets and other clients are independent", () => {
  let t = 0;
  const check = makeLimiter(1, 1_000, () => t);
  assert.equal(check("a").ok, true);
  assert.equal(check("a").ok, false);
  assert.equal(check("b").ok, true);
  t += 1_001;
  assert.equal(check("a").ok, true);
});

test("memory stays bounded: expired keys are pruned once the map is large", () => {
  let t = 0;
  const check = makeLimiter(1, 1_000, () => t);
  for (let i = 0; i < 5_100; i++) check(`ip${i}`);
  t += 2_000;
  check("fresh"); // triggers the prune
  assert.equal(check("ip0").ok, true); // ip0's old window was pruned, so it starts a new one
});

test("client key prefers the platform header and never trusts an empty value", () => {
  assert.equal(clientKey(new Headers({ "x-vercel-forwarded-for": "1.2.3.4, 5.6.7.8", "x-forwarded-for": "9.9.9.9" })), "1.2.3.4");
  assert.equal(clientKey(new Headers({ "x-forwarded-for": "9.9.9.9, 8.8.8.8" })), "9.9.9.9");
  assert.equal(clientKey(new Headers()), "unknown");
});
