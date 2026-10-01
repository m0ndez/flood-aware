import type { Bi } from "./stations.ts";

// Publishers' own RSS feeds. Each is optional: a block or outage removes that outlet only. Daily News is left out on
// purpose (its robots.txt disallows feed URLs), and Google News RSS is not used (its feed notice limits it to personal readers).
// We show headline, outlet, age and a link out. Never article text or images: no outlet grants republishing rights.
export type NewsSource = { id: string; name: Bi; url: string; domain: string; lang: "th" | "en" };

export const NEWS_SOURCES: NewsSource[] = [
  { id: "thaipbs", name: { th: "ไทยพีบีเอส", en: "Thai PBS" }, url: "https://news.thaipbs.or.th/rss/news", domain: "thaipbs.or.th", lang: "th" },
  { id: "thairath", name: { th: "ไทยรัฐ", en: "Thairath" }, url: "https://www.thairath.co.th/rss/news", domain: "thairath.co.th", lang: "th" },
  { id: "matichon", name: { th: "มติชน", en: "Matichon" }, url: "https://www.matichon.co.th/feed", domain: "matichon.co.th", lang: "th" },
  { id: "matichon-flood", name: { th: "มติชน", en: "Matichon" }, url: "https://www.matichon.co.th/tag/%E0%B8%99%E0%B9%89%E0%B8%B3%E0%B8%97%E0%B9%88%E0%B8%A7%E0%B8%A1/feed", domain: "matichon.co.th", lang: "th" },
  { id: "khaosod", name: { th: "ข่าวสด", en: "Khaosod" }, url: "https://www.khaosod.co.th/feed", domain: "khaosod.co.th", lang: "th" },
  { id: "thaipost", name: { th: "ไทยโพสต์", en: "Thai Post" }, url: "https://www.thaipost.net/feed/", domain: "thaipost.net", lang: "th" },
  { id: "thestandard", name: { th: "The Standard", en: "The Standard" }, url: "https://www.thestandard.co/feed/", domain: "thestandard.co", lang: "th" },
  { id: "bangkokinsight", name: { th: "The Bangkok Insight", en: "The Bangkok Insight" }, url: "https://www.thebangkokinsight.com/feed/", domain: "thebangkokinsight.com", lang: "th" },
  { id: "bangkokpost", name: { th: "Bangkok Post", en: "Bangkok Post" }, url: "https://www.bangkokpost.com/rss/data/thailand.xml", domain: "bangkokpost.com", lang: "en" },
];

// No feed exists for these (checked), so they are plain links.
export const OFFICIAL_CHANNELS: { id: string; name: Bi; url: string }[] = [
  { id: "tmd", name: { th: "กรมอุตุนิยมวิทยา", en: "Thai Meteorological Dept." }, url: "https://www.tmd.go.th" },
  { id: "ddpm", name: { th: "ปภ. (ภัยพิบัติ)", en: "Disaster Prevention & Mitigation Dept." }, url: "https://www.disaster.go.th" },
  { id: "rid", name: { th: "กรมชลประทาน", en: "Royal Irrigation Dept." }, url: "https://www.rid.go.th" },
  { id: "dds", name: { th: "สำนักการระบายน้ำ กทม.", en: "BMA Drainage Dept." }, url: "https://dds.bangkok.go.th" },
  { id: "nonthaburi", name: { th: "จังหวัดนนทบุรี", en: "Nonthaburi Province" }, url: "https://www.nonthaburi.go.th" },
];
