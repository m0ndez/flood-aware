import assert from "node:assert/strict";
import test from "node:test";
import { BASE_LAYERS, MAP_STYLES, parseMapStyle } from "./mapstyle.ts";

test("the cookie value is untrusted: anything unknown falls back to standard", () => {
  assert.equal(parseMapStyle("dark"), "dark");
  assert.equal(parseMapStyle("satellite"), "satellite");
  assert.equal(parseMapStyle("standard"), "standard");
  for (const bad of [undefined, null, "", "DARK", "dark ", "<script>", "../etc", 1, {}]) {
    assert.equal(parseMapStyle(bad), "standard", String(bad));
  }
});

test("every style has https tile layers with z/x/y placeholders", () => {
  for (const s of MAP_STYLES) {
    assert.ok(BASE_LAYERS[s].length >= 1, s);
    for (const l of BASE_LAYERS[s]) {
      assert.match(l.url, /^https:\/\//, `${s}: ${l.url}`);
      assert.ok(l.url.includes("{z}") && l.url.includes("{x}") && l.url.includes("{y}"), `${s}: ${l.url}`);
      assert.ok(l.maxZoom >= (l.maxNativeZoom ?? 0), `${s}: maxZoom below maxNativeZoom`);
    }
  }
});

test("no basemap points at a provider that now needs an API key", () => {
  // CARTO answers 200 with an "API KEY REQUIRED" watermark tile, so only a source-level guard can catch it.
  for (const s of MAP_STYLES) for (const l of BASE_LAYERS[s]) assert.doesNotMatch(l.url, /cartocdn|stadiamaps/);
});
