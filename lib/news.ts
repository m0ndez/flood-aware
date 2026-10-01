import { cacheLife } from "next/cache";
import { parseRss, selectNews, type NewsItem, type RawItem } from "./news-parse.ts";
import { NEWS_SOURCES, type NewsSource } from "./news-sources.ts";

export type NewsResult = { items: NewsItem[]; failed: string[]; checked: number };

// Some outlets 403 an empty or browser UA; an honest bot UA with a contact URL is accepted by all of ours.
const UA = "Mozilla/5.0 (compatible; FloodAwareBot/1.0; +https://github.com/m0ndez/flood-aware)";

async function fetchFeed(s: NewsSource): Promise<RawItem[]> {
  const res = await fetch(s.url, { signal: AbortSignal.timeout(5_000), headers: { "user-agent": UA, accept: "application/rss+xml, application/xml, text/xml" } });
  if (!res.ok) throw new Error(`${s.id}: HTTP ${res.status}`);
  return parseRss(await res.text());
}

async function fetchNews(): Promise<NewsResult> {
  "use cache: remote";
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 });
  // One slow or blocked outlet must not take the others down, so each fails alone and is reported by name.
  const settled = await Promise.allSettled(NEWS_SOURCES.map(fetchFeed));
  const ok: { source: NewsSource; items: RawItem[] }[] = [];
  const failed: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") ok.push({ source: NEWS_SOURCES[i], items: r.value });
    else failed.push(NEWS_SOURCES[i].id);
  });
  if (ok.length === 0) throw new Error("news: every source failed");
  return { items: selectNews(ok, Date.now()), failed, checked: ok.length };
}

// null = could not check; the UI must say so instead of implying "no news".
export async function loadNews(): Promise<NewsResult | null> {
  try {
    return await fetchNews();
  } catch (e) {
    console.error("news fetch failed", e);
    return null;
  }
}
