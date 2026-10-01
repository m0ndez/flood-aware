import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ageOf, decodeEntities, parseRss, safeLink, selectNews, type RawItem } from "./news-parse.ts";
import { NEWS_SOURCES } from "./news-sources.ts";

const feed = (id: string) => readFileSync(new URL(`./fixtures/news/${id}.xml`, import.meta.url), "utf8");
const src = (id: string) => NEWS_SOURCES.find((s) => s.id === id)!;

test("every real fixture parses to titled, linked, dated items", () => {
  for (const s of NEWS_SOURCES) {
    const items = parseRss(feed(s.id));
    assert.ok(items.length >= 4, `${s.id}: ${items.length} items`);
    for (const it of items) {
      assert.ok(it.title.length > 0 && !/[<>]|&#?\w+;/.test(it.title), `${s.id}: dirty title ${it.title}`);
      assert.ok(Number.isFinite(it.time));
      assert.ok(safeLink(it.link, s.domain), `${s.id}: link off-domain ${it.link}`);
    }
  }
});

test("CDATA is kept literally and entities decode once", () => {
  const xml = `<rss><channel><title>x</title>
<item><title><![CDATA[Flood &amp; "rain" <b>now</b>]]></title><link>https://a.test/1</link><pubDate>Thu, 1 Oct 2026 12:46:37 +0700</pubDate></item>
<item><title>It&#8217;s &quot;high&quot; &amp;amp;</title><link>https://a.test/2</link><pubDate>Thu, 1 Oct 2026 12:00:00 +0700</pubDate></item></channel></rss>`;
  const [a, b] = parseRss(xml);
  assert.equal(a.title, "Flood &amp; \"rain\" now");
  assert.equal(b.title, "It’s \"high\" &amp;");
  assert.equal(a.time, Date.UTC(2026, 9, 1, 5, 46, 37)); // 12:46 +0700, single-digit day
});

test("malformed items are skipped, not thrown", () => {
  const xml = `<rss><channel><items>x</items>
<item><title>no date</title><link>https://a.test/1</link></item>
<item><title>bad date</title><link>https://a.test/2</link><pubDate>soon</pubDate></item>
<item><title></title><link>https://a.test/3</link><pubDate>Thu, 1 Oct 2026 12:00:00 +0700</pubDate></item>
<item><title>ok</title><link>https://a.test/4</link><pubDate>Thu, 1 Oct 2026 12:00:00 +0700</pubDate></item>
<item><title>unterminated`;
  assert.deepEqual(parseRss(xml).map((i) => i.title), ["ok"]);
  assert.deepEqual(parseRss(""), []);
  assert.deepEqual(parseRss("<html>blocked by cloudflare</html>"), []);
});

test("decodeEntities rejects invalid code points", () => {
  assert.equal(decodeEntities("a&#0;b&#xD800;c&#9999999;d"), "abcd");
  assert.equal(decodeEntities("&unknown; &lt;"), "&unknown; <");
});

test("safeLink only allows http(s) on the publisher's domain", () => {
  assert.equal(safeLink("https://www.matichon.co.th/x", "matichon.co.th"), "https://www.matichon.co.th/x");
  assert.equal(safeLink("javascript:alert(1)", "matichon.co.th"), null);
  assert.equal(safeLink("https://evil.com/?u=matichon.co.th", "matichon.co.th"), null);
  assert.equal(safeLink("https://matichon.co.th.evil.com/", "matichon.co.th"), null);
  assert.equal(safeLink("https://notmatichon.co.th/", "matichon.co.th"), null);
  assert.equal(safeLink("not a url", "matichon.co.th"), null);
});

const NOW = Date.UTC(2026, 9, 1, 8, 0, 0);
const mk = (title: string, ageH: number, link = `https://www.thairath.co.th/${title}`): RawItem => ({ title, link, time: NOW - ageH * 3600_000 });

test("selection: topic required, local first, then newest; old and future dropped", () => {
  const items = [
    mk("น้ำท่วมเมืองไกล", 1),
    mk("ดาราคนดัง", 0.5),
    mk("น้ำท่วมนนทบุรี", 10),
    mk("น้ำท่วมปากเกร็ดล่าสุด", 2),
    mk("น้ำท่วมเก่า", 73),
    mk("น้ำท่วมอนาคต", -5),
  ];
  const out = selectNews([{ source: src("thairath"), items }], NOW);
  assert.deepEqual(out.map((n) => n.title), ["น้ำท่วมปากเกร็ดล่าสุด", "น้ำท่วมนนทบุรี", "น้ำท่วมเมืองไกล"]);
  assert.deepEqual(out.map((n) => n.local), [true, true, false]);
});

test("selection: same story from two feeds shows once, capped at max, bad links dropped", () => {
  const a = { source: src("matichon"), items: [mk("น้ำท่วม นนทบุรี!", 3, "https://www.matichon.co.th/a")] };
  const b = { source: src("matichon-flood"), items: [mk("น้ำท่วม นนทบุรี", 2, "https://www.matichon.co.th/b"), mk("น้ำท่วม x", 1, "javascript:alert(1)")] };
  assert.equal(selectNews([a, b], NOW).length, 1);
  const many = { source: src("thairath"), items: Array.from({ length: 12 }, (_, i) => mk(`น้ำท่วม ${i}`, i)) };
  assert.equal(selectNews([many], NOW).length, 5);
  assert.equal(selectNews([many], NOW, 3).length, 3);
});

test("real fixtures through selection give only safe, topical, dated items", () => {
  const batches = NEWS_SOURCES.map((s) => ({ source: s, items: parseRss(feed(s.id)) }));
  const latest = Math.max(...batches.flatMap((b) => b.items.map((i) => i.time)));
  const out = selectNews(batches, latest + 3600_000);
  assert.ok(out.length <= 5);
  for (const n of out) {
    assert.ok(/^https?:/.test(n.link));
    assert.ok(latest + 3600_000 - n.time <= 72 * 3600_000);
  }
});

test("ageOf picks whole units, never zero or positive", () => {
  assert.deepEqual(ageOf(NOW - 10_000, NOW), { value: -1, unit: "minute" });
  assert.deepEqual(ageOf(NOW - 90 * 60_000, NOW), { value: -2, unit: "hour" });
  assert.deepEqual(ageOf(NOW - 50 * 3600_000, NOW), { value: -2, unit: "day" });
  assert.deepEqual(ageOf(NOW + 5000, NOW), { value: -1, unit: "minute" });
});
