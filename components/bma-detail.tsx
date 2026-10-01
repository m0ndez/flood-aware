import Link from "next/link";
import { ChevronLeftIcon } from "@/components/icons";
import { StatusBadge } from "@/components/status-badge";
import { BMA_GROUP } from "@/lib/bma-adapt";
import type { BmaStation } from "@/lib/bma-parse";
import { fmtTime, type Dict, type Lang } from "@/lib/i18n";
import type { Status } from "@/lib/status";

const tone = (s: Status) => `var(--st-${s})`; // see app/globals.css

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-xs text-slate-600 dark:text-slate-400">{label}</dt>
    <dd className="text-base font-semibold tabular-nums">{value}</dd>
  </div>
);

// A BMA canal, pumping station or sluice gate. The feed gives the current level, BMA's own marks and today's and
// yesterday's maximum, but no history, so there is no chart. The marks are the canal's operating levels, not banks.
export function BmaDetail({ s, name, status, backHref, lang, t }: { s: BmaStation; name: string; status: Status; backHref: string; lang: Lang; t: Dict }) {
  const k = t.bma;
  const unit = lang === "th" ? "ม." : "m";
  const m = (v: number | null) => (v == null ? "–" : v.toFixed(2));
  const mark = s.warning ?? s.critical;
  const gap = mark != null ? mark - s.level : null; // + below the mark, 0 or - at or above it (amber starts at the mark)
  return (
    <section id="panel" className="flex flex-col gap-3">
      <Link href={backHref} scroll={false} className="-ml-1 flex min-h-11 w-fit items-center gap-1 rounded px-1 text-sm font-medium text-sky-800 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-slate-800 md:min-h-8">
        <ChevronLeftIcon /> {t.backToList}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 tabIndex={-1} data-autofocus className="text-balance outline-none text-xl font-bold leading-tight">{name}</h2>
          <p className="text-sm text-slate-700 dark:text-slate-300">{k.kind[s.kind]} · {BMA_GROUP[lang]}</p>
        </div>
        <StatusBadge status={status} label={t.status[status]} />
      </div>

      <div aria-live="polite" className="border-b border-slate-200 pb-3 dark:border-slate-700">
        {status === "stale" ? (
          <p className="text-base font-semibold">{k.cannotConfirm}</p>
        ) : gap != null ? (
          <p className="flex items-baseline gap-2">
            <span className="text-4xl font-bold leading-none tabular-nums" style={{ color: tone(status) }}>{Math.abs(gap).toFixed(2)}</span>
            <span className="text-base font-semibold">{unit} {gap <= 0 ? k.heroAbove : k.heroBelow}</span>
          </p>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Fact label={k.level} value={`${m(s.level)} ${unit}`} />
        <Fact label={k.outer} value={s.outerLevel == null ? "–" : `${m(s.outerLevel)} ${unit}`} />
        <Fact label={k.warning} value={`${m(s.warning)} ${unit}`} />
        <Fact label={k.critical} value={`${m(s.critical)} ${unit}`} />
        <Fact label={k.maxToday} value={`${m(s.maxToday)} ${unit}`} />
        <Fact label={k.maxYesterday} value={`${m(s.maxYesterday)} ${unit}`} />
        <div className="col-span-2">
          <Fact label={t.updated} value={fmtTime(s.at, lang)} />
        </div>
      </dl>
      <p className="text-xs text-slate-700 dark:text-slate-300">{k.note}</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">{k.noChart}</p>
      <p className="text-xs text-slate-600 dark:text-slate-400">{k.source}</p>
    </section>
  );
}
