import assert from "node:assert/strict";
import test from "node:test";
import { BMA_ENDPOINTS, firstWorking } from "./bma-source.ts";

const ok = (j: unknown) => (Array.isArray(j) && j.length > 0 ? j : null);

test("BMA's own endpoint wins when it works, and the mirror is never asked", async () => {
  const asked: string[] = [];
  const r = await firstWorking(BMA_ENDPOINTS, async (u) => (asked.push(u), [1]), ok);
  assert.equal(r.source, "bma");
  assert.equal(asked.length, 1);
});

test("an HTTP 403 from BMA (what Vercel gets) falls back to the mirror and says so", async () => {
  const r = await firstWorking(
    BMA_ENDPOINTS,
    async (u) => {
      if (u.includes("bangkok.go.th")) throw new Error("BMA klongmap: HTTP 403");
      return [1, 2];
    },
    ok,
  );
  assert.equal(r.source, "mirror");
  assert.deepEqual(r.value, [1, 2]);
});

test("a 200 with an unusable body (challenge page, empty feed) counts as a failure too", async () => {
  const r = await firstWorking(BMA_ENDPOINTS, async (u) => (u.includes("bangkok.go.th") ? { html: "challenge" } : [9]), ok);
  assert.equal(r.source, "mirror");
});

test("when nothing works it throws with every reason, so the page reports 'unavailable', not 'normal'", async () => {
  await assert.rejects(
    firstWorking(BMA_ENDPOINTS, async () => { throw new Error("HTTP 403"); }, ok),
    (e: Error) => /bma: HTTP 403/.test(e.message) && /mirror: HTTP 403/.test(e.message),
  );
});

test("the mirror is the last resort and BMA is first", () => {
  assert.deepEqual(BMA_ENDPOINTS.map((e) => e.id), ["bma", "mirror"]);
  assert.ok(BMA_ENDPOINTS.every((e) => e.url.startsWith("https://")));
});
