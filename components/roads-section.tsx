import { ageOf } from "@/lib/news-parse";
import type { Dict, Lang } from "@/lib/i18n";

const MUTED = "text-slate-700 dark:text-slate-300";

type Item = { id: string; title: string; place: string; start: number; source: "doh" | "itic" | "public" };

// Flooded-road reports as published (never translated by us): title, place, source and age. Items are not links:
// the feed has no page to point at. `roads === null` means the feed failed, which must not read as "no reports".
export function RoadsSection({ roads, total, elsewhere = 0, now, lang, t }: { roads: Item[] | null; total: number; elsewhere?: number; now: number; lang: Lang; t: Dict }) {
  const r = t.roads;
  const rtf = new Intl.RelativeTimeFormat(lang === "th" ? "th-TH" : "en", { numeric: "auto" });
  return (
    <details open className="mt-3">
      <summary className="flex min-h-11 cursor-pointer items-center text-base font-bold md:min-h-9">{r.title}</summary>
      {roads === null ? (
        <p className={`text-sm ${MUTED}`}>{r.unavailable}</p>
      ) : roads.length === 0 ? (
        <>
          <p className={`text-sm ${MUTED}`}>{r.none}</p>
          {elsewhere > 0 && <p className={`text-xs ${MUTED}`}>{r.elsewhere.replace("{n}", String(elsewhere))}</p>}
        </>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-700">
            {roads.map((it) => {
              const a = ageOf(it.start, now);
              return (
                <li key={it.id} className="flex min-h-11 flex-col justify-center py-2.5">
                  <span className="text-sm font-medium leading-snug">{it.title}</span>
                  {it.place && <span className={`line-clamp-2 text-xs ${MUTED}`}>{it.place}</span>}
                  <span className={`mt-1 text-xs ${MUTED}`}>
                    {r.source[it.source]} · {rtf.format(a.value, a.unit)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={`mt-1 text-xs ${MUTED}`}>{r.caveat}</p>
          {total > roads.length && <p className={`text-xs ${MUTED}`}>{r.more.replace("{n}", String(total - roads.length))}</p>}
          {elsewhere > 0 && <p className={`text-xs ${MUTED}`}>{r.elsewhere.replace("{n}", String(elsewhere))}</p>}
          <p className={`text-xs ${MUTED}`}>{r.credit}</p>
        </>
      )}
    </details>
  );
}
