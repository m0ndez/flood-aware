import { cacheLife } from "next/cache";
import type { Warning } from "./warnings.ts";

// Thai Meteorological Department open API. Credit "data.tmd.go.th" and never imply TMD endorsement.
// Defaults to TMD's published shared demo credentials; set TMD_UID / TMD_UKEY (server-only) for your own.
const BASE = "https://data.tmd.go.th/api";
const qs = () =>
  `uid=${encodeURIComponent(process.env.TMD_UID || "api")}&ukey=${encodeURIComponent(process.env.TMD_UKEY || "api12345")}&format=json`;

export type Bi = { th: string; en: string };
export type OutlookDay = { date: string; rainPct: number | null; max: number | null; min: number | null; desc: Bi };

const obj = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
const num = (x: unknown): number | null => {
  const n = typeof x === "string" && x.trim() !== "" ? Number(x) : typeof x === "number" ? x : NaN;
  return Number.isFinite(n) ? n : null;
};

// Some TMD feeds are served as tis620 (v2 warnings), so decode by the declared charset.
async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}/${path}`, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`TMD ${path}: HTTP ${res.status}`);
  const cs = /charset=([\w-]+)/i.exec(res.headers.get("content-type") ?? "")?.[1]?.toLowerCase() ?? "utf-8";
  return JSON.parse(new TextDecoder(cs.startsWith("tis") ? "windows-874" : cs).decode(await res.arrayBuffer()));
}

// 7-day province outlook. Use v2: v1 times out. Feed arrays are strings, DD/MM/YYYY, newest first.
// Provinces are matched on their Thai name: TMD's English spellings differ from ThaiWater's ("Chainat", "Sakaeo").
async function fetchOutlook(provinceTh: string): Promise<OutlookDay[]> {
  "use cache: remote";
  cacheLife({ stale: 900, revalidate: 3600, expire: 21600 });
  const provinces = obj(obj(await getJson(`WeatherForecast7Days/v2/?${qs()}`))?.Provinces)?.Province;
  const p = (Array.isArray(provinces) ? provinces : []).map(obj).find((x) => typeof x?.ProvinceNameThai === "string" && x.ProvinceNameThai.trim() === provinceTh);
  const f = obj(p?.SevenDaysForecast);
  const arr = (k: string) => (Array.isArray(f?.[k]) ? (f[k] as unknown[]) : []);
  const dates = arr("ForecastDate");
  const days: OutlookDay[] = [];
  dates.forEach((d, i) => {
    const m = typeof d === "string" ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d) : null;
    const th = arr("DescriptionThai")[i];
    const en = arr("DescriptionEnglish")[i];
    if (!m || typeof th !== "string" || typeof en !== "string") return;
    days.push({
      date: `${m[3]}-${m[2]}-${m[1]}`,
      rainPct: num(arr("PercentRainCover")[i]),
      max: num(arr("MaximumTemperature")[i]),
      min: num(arr("MinimumTemperature")[i]),
      desc: { th, en }, // TMD's own wording per language; Thai and English fields differ, never derive one from the other
    });
  });
  if (days.length === 0) throw new Error(`TMD outlook: ${provinceTh} not found`);
  return days.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);
}

// Collect every object that looks like a warning, whatever nesting the feed uses
// (v1 returns a bare object for one item, an array for several; the v2 item shape is unverified).
function collect(x: unknown, out: Warning[]): Warning[] {
  if (Array.isArray(x)) x.forEach((v) => collect(v, out));
  else {
    const o = obj(x);
    if (o && (typeof o.TitleThai === "string" || typeof o.TitleEnglish === "string")) {
      const at = typeof o.AnnounceDateTime === "string" ? o.AnnounceDateTime.slice(0, 16) : null;
      if (at) {
        out.push({
          issueNo: String(o.IssueNo ?? ""),
          announced: at,
          titleTh: typeof o.TitleThai === "string" ? o.TitleThai : "",
          titleEn: typeof o.TitleEnglish === "string" ? o.TitleEnglish : "",
          descTh: typeof o.DescriptionThai === "string" ? o.DescriptionThai : "",
        });
      }
    } else if (o) Object.values(o).forEach((v) => collect(v, out));
  }
  return out;
}

async function fetchWarnings(): Promise<Warning[]> {
  "use cache: remote";
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  // v2 is the current feed and must succeed; v1 is best-effort (it has been slow and mostly stale).
  const [v2, v1] = await Promise.allSettled([getJson(`WeatherWarningNews/v2/?${qs()}`), getJson(`WeatherWarningNews/v1/?${qs()}`)]);
  if (v2.status === "rejected") throw v2.reason;
  const out = collect(obj(v2.value)?.Warnings, []);
  if (v1.status === "fulfilled") collect(obj(v1.value)?.WarningNews, out);
  return out;
}

export async function loadOutlook(provinceTh: string): Promise<OutlookDay[] | null> {
  try {
    return await fetchOutlook(provinceTh);
  } catch (e) {
    console.error("TMD outlook fetch failed", e);
    return null;
  }
}

// null = could not check; the UI must say so instead of implying "no warnings".
export async function loadWarnings(): Promise<Warning[] | null> {
  try {
    return await fetchWarnings();
  } catch (e) {
    console.error("TMD warnings fetch failed", e);
    return null;
  }
}
