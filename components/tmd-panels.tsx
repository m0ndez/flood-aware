import { WarnIcon } from "@/components/icons";
import { loadOutlook, loadWarnings } from "@/lib/tmd";
import { parseIct } from "@/lib/status";
import { fmtTime, type Dict, type Lang } from "@/lib/i18n";
import { relevantWarnings } from "@/lib/warnings";

// Official TMD text is shown as TMD wrote it. Never machine-translated.
export async function WarningStrip({ now, lang, t, extra = [] }: { now: number; lang: Lang; t: Dict; extra?: string[] }) {
  const all = await loadWarnings();
  if (!all) return <p className="rounded-lg bg-white/90 dark:bg-slate-900/90 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 shadow-lg dark:ring-1 dark:ring-white/10 backdrop-blur-xl">{t.warnUnchecked}</p>; // "could not check" must not look like "no warnings"
  const hits = relevantWarnings(all, now, extra);
  if (hits.length === 0) return null;
  return (
    <section aria-label={t.warnTitle} className="rounded-lg border-2 border-amber-700 dark:border-amber-500 bg-amber-50 dark:bg-amber-950 p-3 shadow-lg">
      <h2 className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200"><WarnIcon /> {t.warnTitle}</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {hits.map((w) => (
          <li key={`${w.issueNo}-${w.announced}`}>
            <details>
              <summary className="cursor-pointer font-semibold">
                {lang === "en" && w.titleEn ? w.titleEn : w.titleTh}
                <span className="ml-2 text-sm font-normal text-slate-700 dark:text-slate-300">{fmtTime(parseIct(w.announced), lang)}</span>
              </summary>
              <p className="mt-1 whitespace-pre-line text-sm" lang="th">{w.descTh}</p>
              {lang === "en" && <p className="text-xs text-slate-700 dark:text-slate-300">{t.warnThaiOnly}</p>}
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function Outlook({ provinceTh, lang, t }: { provinceTh: string; lang: Lang; t: Dict }) {
  const days = await loadOutlook(provinceTh);
  if (!days) return <p className="text-sm text-slate-700 dark:text-slate-300">{t.noOutlook}</p>;
  const dayFmt = new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", { weekday: "short", day: "numeric", timeZone: "Asia/Bangkok" });
  return (
    <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-700 text-sm">
      {days.map((d) => (
        <li key={d.date} className="flex items-center justify-between gap-3 py-1.5">
          <span className="min-w-0">
            <span className="block font-semibold">{dayFmt.format(parseIct(`${d.date} 12:00`))}</span>
            <span className="block text-xs text-slate-700 dark:text-slate-300">{d.desc[lang]}</span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block tabular-nums">{d.max != null ? Math.round(d.max) : "–"}° / {d.min != null ? Math.round(d.min) : "–"}°</span>
            <span className="block text-xs text-slate-700 dark:text-slate-300">{t.rainCover} {d.rainPct != null ? `${d.rainPct}%` : "–"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
