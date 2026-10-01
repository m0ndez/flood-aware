import type { Warning } from "./warnings.ts";

export type Bi = { th: string; en: string };
export type OutlookDay = { date: string; rainPct: number | null; max: number | null; min: number | null; desc: Bi };

const obj = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
const num = (x: unknown): number | null => {
  const n = typeof x === "string" && x.trim() !== "" ? Number(x) : typeof x === "number" ? x : NaN;
  return Number.isFinite(n) ? n : null;
};

// TMD serves some feeds as tis620 (v2 warnings). Decode by the declared charset; an unknown label must not throw
// (that would make the warnings strip say "could not check" forever), so fall back to utf-8.
export function decodeTmd(buf: ArrayBuffer, contentType: string): string {
  const cs = /charset=([\w-]+)/i.exec(contentType)?.[1]?.toLowerCase() ?? "utf-8";
  try {
    return new TextDecoder(cs.startsWith("tis") ? "windows-874" : cs).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

// 7-day province outlook from WeatherForecast7Days/v2. Feed arrays are strings, DD/MM/YYYY, newest first.
// Provinces are matched on their Thai name: TMD's English spellings differ from ThaiWater's ("Chainat", "Sakaeo").
// Returns [] when the province or its rows are missing; the caller decides whether that is an error.
export function parseOutlook(json: unknown, provinceTh: string): OutlookDay[] {
  const provinces = obj(obj(json)?.Provinces)?.Province;
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
  return days.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);
}

// Collect every object that looks like a warning, whatever nesting the feed uses
// (v1 returns a bare object for one item, an array for several; the v2 item shape is unverified).
export function collectWarnings(x: unknown, out: Warning[] = []): Warning[] {
  if (Array.isArray(x)) x.forEach((v) => collectWarnings(v, out));
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
    } else if (o) Object.values(o).forEach((v) => collectWarnings(v, out));
  }
  return out;
}

