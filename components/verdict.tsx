import { StatusIcon } from "@/components/status-badge";
import type { Dict } from "@/lib/i18n";
import { SEVERITY_ORDER, total, worstOf, type Counts, type Headline } from "@/lib/verdict";

export function headlineText(h: Headline, t: Dict): string {
  const v = t.verdict;
  const n = (s: string, k: number) => s.replace("{n}", String(k));
  switch (h.kind) {
    case "critical":
      return [n(v.critical, h.critical), h.watch > 0 ? n(v.watch, h.watch) : ""].filter(Boolean).join(" · ");
    case "watch":
      // With gauges we cannot confirm, "none over bank" would claim more than we know.
      return `${n(v.watch, h.watch)} · ${h.stale > 0 ? v.noCriticalConfirmed : v.noCritical}`;
    case "allStale":
      return v.allStale;
    default:
      return v.allNormal;
  }
}

// The answer to "is it flooding near me?", stated once at the top. It also doubles as the legend: only the
// statuses actually present are listed, each with its own shape and label.
export function Verdict({
  counts,
  headline,
  area,
  surround,
  surroundText,
  asOf,
  t,
}: {
  counts: Counts; // what the headline is about
  headline: Headline;
  area: string;
  surround: Counts | null; // wider set shown as a separate, labelled line (Nonthaburi and Bang Na views)
  surroundText?: string; // the label for that line, when it is not the default klong one
  asOf: string | null;
  t: Dict;
}) {
  const list = surround ?? counts;
  return (
    <section aria-label={t.verdict.asOf} className="mb-3 border-b border-slate-200 pb-3 dark:border-slate-700">
      <div className="flex items-start gap-3">
        <StatusIcon status={worstOf(counts)} size={28} />
        <div className="min-w-0">
          <p className="text-balance text-base font-bold leading-snug">{headlineText(headline, t)}</p>
          <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">
            {t.verdict.scope.replace("{area}", area).replace("{n}", String(total(counts)))}
            {asOf && ` · ${t.verdict.asOf} ${asOf}`}
          </p>
        </div>
      </div>
      {surround && <p className="mt-2 text-xs text-slate-700 dark:text-slate-300">{(surroundText ?? t.verdict.surround).replace("{n}", String(total(surround)))}</p>}
      <ul className={`${surround ? "mt-1" : "mt-2"} flex flex-wrap gap-x-3 gap-y-1 text-sm`}>
        {SEVERITY_ORDER.filter((s) => list[s] > 0).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <StatusIcon status={s} /> <span className="font-semibold tabular-nums">{list[s]}</span> {t.status[s]}
          </li>
        ))}
      </ul>
    </section>
  );
}
