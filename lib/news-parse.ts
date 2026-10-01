import type { NewsSource } from "./news-sources.ts";

// Pure RSS handling and headline selection. No fetch, no Next imports, so it is tested on real frozen feeds.
// Feeds are untrusted input: parsing is a bounded indexOf scan (no regex backtracking), sizes are capped, and every
// link is re-validated against its publisher's domain before it can reach an href.

export type RawItem = { title: string; link: string; time: number };
export type NewsItem = { title: string; link: string; source: string; lang: "th" | "en"; time: number; local: boolean };

const MAX_XML = 3_000_000;
const MAX_ITEMS = 100;
const MAX_TITLE = 180;
export const MAX_AGE_MS = 72 * 3600_000;
const FUTURE_SKEW_MS = 3600_000;
export const MAX_NEWS = 5;

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (m, g: string) => {
    if (g[0] === "#") {
      const cp = g[1] === "x" || g[1] === "X" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
      return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : "";
    }
    return NAMED[g.toLowerCase()] ?? m;
  });
}

// <tag>...</tag> inner text of the first matching tag (exact name, not a longer one that shares the prefix).
function tagText(block: string, tag: string): string | null {
  let i = 0;
  const open = `<${tag}`;
  while ((i = block.indexOf(open, i)) !== -1) {
    const c = block[i + open.length];
    if (c === ">" || c === " " || c === "\n" || c === "\t" || c === "\r") break;
    i += open.length;
  }
  if (i === -1) return null;
  const gt = block.indexOf(">", i);
  if (gt === -1 || block[gt - 1] === "/") return null;
  const end = block.indexOf(`</${tag}>`, gt);
  return end === -1 ? null : block.slice(gt + 1, end);
}

function clean(raw: string): string {
  const t = raw.trim();
  const text = t.startsWith("<![CDATA[") && t.endsWith("]]>") ? t.slice(9, -3) : decodeEntities(t);
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function parseRss(xml: string): RawItem[] {
  const src = xml.length > MAX_XML ? xml.slice(0, MAX_XML) : xml;
  const out: RawItem[] = [];
  let pos = 0;
  while (out.length < MAX_ITEMS) {
    const s = src.indexOf("<item", pos);
    if (s === -1) break;
    const after = src[s + 5];
    const e = src.indexOf("</item>", s);
    if (e === -1) break;
    pos = e + 7;
    if (after !== ">" && after !== " " && after !== "\n" && after !== "\t" && after !== "\r") continue; // <items>, not <item>
    const block = src.slice(s, e);
    const t = tagText(block, "title");
    const l = tagText(block, "link");
    const d = tagText(block, "pubDate");
    if (t == null || l == null || d == null) continue;
    const title = clean(t);
    const time = Date.parse(clean(d));
    if (!title || Number.isNaN(time)) continue;
    out.push({ title, link: clean(l), time });
  }
  return out;
}

// A headline must be about flooding or heavy rain to qualify at all; being about this area ranks it first.
const TOPIC = /น้ำท่วม|อุทกภัย|น้ำหลาก|น้ำป่า|น้ำล้น|น้ำหนุน|ฝนตกหนัก|ฝนหนัก|พายุ|ระบายน้ำ|เขื่อน|ระดับน้ำ|พนังกั้นน้ำ|กระสอบทราย|ผู้ประสบภัย|เจ้าพระยา|flood|inundat|chao phraya|heavy rain|storm|dam discharge/i;
const PLACE = /นนทบุรี|ปากเกร็ด|บางบัวทอง|บางกรวย|บางใหญ่|ไทรน้อย|บางศรีเมือง|ปทุมธานี|คลองหลวง|รังสิต|อยุธยา|อ่างทอง|สิงห์บุรี|ชัยนาท|เจ้าพระยา|กรุงเทพ|กทม|ลาดพร้าว|nonthaburi|pathum thani|ayutthaya|chao phraya|bangkok|pak kret/i;

const titleKey = (t: string) => t.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, "");

// A link is shown only if it is http(s) and on the publisher's own domain: a feed cannot smuggle in javascript: URLs,
// trackers or another site.
export function safeLink(link: string, domain: string): string | null {
  try {
    const u = new URL(link);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const h = u.hostname.toLowerCase();
    return h === domain || h.endsWith(`.${domain}`) ? u.href : null;
  } catch {
    return null;
  }
}

export function selectNews(batches: { source: NewsSource; items: RawItem[] }[], now: number, max = MAX_NEWS): NewsItem[] {
  const all: NewsItem[] = [];
  for (const { source, items } of batches) {
    for (const it of items) {
      if (it.time > now + FUTURE_SKEW_MS || now - it.time > MAX_AGE_MS) continue; // future or stale: not news
      const title = it.title.length > MAX_TITLE ? `${it.title.slice(0, MAX_TITLE - 1)}…` : it.title;
      if (!TOPIC.test(title)) continue;
      const link = safeLink(it.link, source.domain);
      if (!link) continue;
      all.push({ title, link, source: source.id, lang: source.lang, time: it.time, local: PLACE.test(title) });
    }
  }
  // Local stories first, then newest. The same story from several outlets (or two feeds of one outlet) shows once.
  all.sort((a, b) => Number(b.local) - Number(a.local) || b.time - a.time);
  const seenTitle = new Set<string>();
  const seenLink = new Set<string>();
  const out: NewsItem[] = [];
  for (const n of all) {
    const k = titleKey(n.title);
    if (seenTitle.has(k) || seenLink.has(n.link)) continue;
    seenTitle.add(k);
    seenLink.add(n.link);
    out.push(n);
    if (out.length >= max) break;
  }
  return out;
}

// Whole units for "2 hours ago"; the component formats them with Intl.RelativeTimeFormat.
export function ageOf(time: number, now: number): { value: number; unit: "minute" | "hour" | "day" } {
  const mins = Math.max(0, Math.round((now - time) / 60_000));
  if (mins < 60) return { value: -Math.max(1, mins), unit: "minute" };
  if (mins < 24 * 60) return { value: -Math.round(mins / 60), unit: "hour" };
  return { value: -Math.round(mins / (24 * 60)), unit: "day" };
}
