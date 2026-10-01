import assert from "node:assert/strict";
import test from "node:test";
import { withTimeout } from "./abort.ts";

test("aborts after the timeout", async () => {
  const { signal, done } = withTimeout(20);
  assert.equal(signal.aborted, false);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(signal.aborted, true);
  done();
});

test("aborts when the parent aborts, and immediately if the parent already has", () => {
  const parent = new AbortController();
  const a = withTimeout(10_000, parent.signal);
  parent.abort();
  assert.equal(a.signal.aborted, true);
  a.done();
  assert.equal(withTimeout(10_000, parent.signal).signal.aborted, true);
});

test("done() cancels the timer so a finished request is never aborted later", async () => {
  const { signal, done } = withTimeout(20);
  done();
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(signal.aborted, false);
});
