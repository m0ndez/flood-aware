import type { Dict, Lang } from "@/lib/i18n";
import { loadForecast } from "@/lib/forecast";
import { parseIct } from "@/lib/status";

const W = 600;
const H = 100;

export async function ForecastPanel({ lat, lon, now, lang, t }: { lat: number; lon: number; now: number; lang: Lang; t: Dict }) {
  const fc = await loadForecast(lat, lon);
  if (!fc) return <p className="text-sm text-slate-600 dark:text-slate-400">{t.noForecast}</p>;

  // Open-Meteo hours are on the hour, so keep hours that haven't fully ended yet.
  const next = fc.hours.filter((h) => parseIct(h.t) + 3600_000 > now).slice(0, 24);
  if (next.length === 0) return <p className="text-sm text-slate-600 dark:text-slate-400">{t.noForecast}</p>;

  const total = next.reduce((a, h) => a + h.mm, 0);
  const probs = next.flatMap((h) => (h.prob == null ? [] : [h.prob]));
  const peakProb = probs.length ? Math.max(...probs) : null;
  const top = Math.max(2, ...next.map((h) => h.mm)); // floor keeps a drizzle from looking like a storm
  const bw = W / next.length;
  const days = fc.days.slice(0, 7);
  const dayTop = Math.max(10, ...days.map((d) => d.mm)); // floor: a dry week must not draw full bars
  const dayPeak = Math.max(...days.map((d) => d.mm));
  const today = new Date(now + 7 * 3600_000).toISOString().slice(0, 10); // Bangkok calendar date
  const locale = lang === "th" ? "th-TH" : "en-GB";
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "Asia/Bangkok" });
  const dayNum = new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "Asia/Bangkok" });
  // Colour is a second cue only; the value is always printed next to the bar.
  const barColor = (mm: number) => (mm >= 35 ? "bg-indigo-900 dark:bg-indigo-400" : mm >= 10 ? "bg-sky-700 dark:bg-sky-500" : "bg-sky-400");

  return (
    <div className="flex flex-col gap-2 text-sm">
      <dl className="grid grid-cols-2 gap-x-4">
        <div>
          <dt className="text-slate-600 dark:text-slate-400">{t.fc24}</dt>
          <dd className="text-lg font-semibold tabular-nums">{total.toFixed(1)}</dd>
        </div>
        <div>
          <dt className="text-slate-600 dark:text-slate-400">{t.fcProb}</dt>
          <dd className="text-lg font-semibold tabular-nums">{peakProb != null ? `${peakProb}%` : "–"}</dd>
        </div>
      </dl>

      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${t.fcHourly}: ${total.toFixed(1)} mm`} className="w-full">
        <line x1="0" x2={W} y1={H - 26} y2={H - 26} className="stroke-slate-300 dark:stroke-slate-600" />
        {next.map((h, i) => {
          const bh = (h.mm / top) * (H - 38);
          return <rect key={h.t} x={i * bw + 1} y={H - 26 - bh} width={Math.max(bw - 2, 1)} height={bh} className="fill-sky-700 dark:fill-sky-400" />;
        })}
        <text x="0" y={H - 6} fontSize="16" className="fill-slate-600 dark:fill-slate-400">{next[0].t.slice(11)}</text>
        <text x={W} y={H - 6} textAnchor="end" fontSize="16" className="fill-slate-600 dark:fill-slate-400">{next[next.length - 1].t.slice(11)}</text>
      </svg>

      <div>
        <h4 className="font-semibold">{t.fc7}</h4>
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {days.map((d) => {
            const at = parseIct(`${d.d} 12:00`);
            const width = d.mm > 0 ? Math.max(3, Math.min(100, (d.mm / dayTop) * 100)) : 0;
            return (
              <li key={d.d} className="grid grid-cols-[5rem_1fr_3rem] items-center gap-2">
                <span className={`whitespace-nowrap ${d.d === today ? "font-semibold" : "text-slate-700 dark:text-slate-300"}`}>
                  {d.d === today ? t.today : weekday.format(at)} {dayNum.format(at)}
                </span>
                <span className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" aria-hidden="true">
                  <span className={`block h-full rounded-full ${barColor(d.mm)}`} style={{ width: `${width}%` }} />
                </span>
                <span className={`text-right tabular-nums ${d.mm === dayPeak && dayPeak > 0 ? "font-bold" : "font-semibold"}`}>{d.mm.toFixed(1)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
