export type Forecast = {
  hours: { t: string; mm: number; prob: number | null }[]; // t = "YYYY-MM-DD HH:mm" Thai time, 7 days
  days: { d: string; mm: number }[]; // d = "YYYY-MM-DD"
};

const nums = (x: unknown): (number | null)[] | null =>
  Array.isArray(x) ? x.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null)) : null;
const strs = (x: unknown): string[] | null =>
  Array.isArray(x) && x.every((v) => typeof v === "string") ? (x as string[]) : null;
const obj = (x: unknown): Record<string, unknown> | null =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;

// Open-Meteo response -> Forecast. Throws on a shape it does not recognise, so a bad payload is never cached or shown.
export function parseForecast(json: unknown): Forecast {
  const j = obj(json);
  const h = obj(j?.hourly);
  const d = obj(j?.daily);
  const ht = strs(h?.time);
  const hp = nums(h?.precipitation);
  const hq = nums(h?.precipitation_probability);
  const dt = strs(d?.time);
  const dp = nums(d?.precipitation_sum);
  if (!ht || !hp || !dt || !dp || ht.length !== hp.length || dt.length !== dp.length) throw new Error("Open-Meteo: bad shape");
  return {
    // A missing hour is unknown, not dry: drop it instead of coercing to 0 mm.
    hours: ht.flatMap((t, i) => (hp[i] == null ? [] : [{ t: t.replace("T", " "), mm: hp[i]!, prob: hq?.[i] ?? null }])),
    days: dt.flatMap((day, i) => (dp[i] == null ? [] : [{ d: day, mm: dp[i]! }])),
  };
}
