import Link from "next/link";
import { Suspense } from "react";
import { ForecastPanel } from "@/components/forecast-panel";
import { ChevronLeftIcon, TrendIcon, WarnIcon } from "@/components/icons";
import { LevelChart } from "@/components/level-chart";
import { RainBox } from "@/components/rain-box";
import { StatusBadge } from "@/components/status-badge";
import { fmtTime, type Dict, type Lang } from "@/lib/i18n";
import { NEAR_BANK_PCT, parseIct, type Status, type Trend } from "@/lib/status";
import type { Graph, Reading } from "@/lib/thaiwater";

const tone = (s: Status) => `var(--st-${s})`; // see app/globals.css

export function StationDetail({
  name,
  subtitle,
  reading,
  status,
  graph,
  trend,
  failed,
  now,
  backHref,
  lang,
  t,
}: {
  name: string;
  subtitle: string; // river, province, code, already joined and in the right language
  reading: Reading | undefined;
  status: Status;
  graph: Graph | null;
  trend: Trend | null;
  failed: boolean;
  now: number;
  backHref: string;
  lang: Lang;
  t: Dict;
}) {
  const gap = reading?.bankM != null ? reading.bankM - reading.levelMsl : null; // + below bank, - above
  const pct = reading?.bankPct ?? null;
  const nearBank = status !== "critical" && status !== "stale" && pct != null && pct >= NEAR_BANK_PCT;
  // Gauge: fills to the % of bank capacity, with a tick at 100% (the bank). Scale grows past 120% when over bank.
  const scale = Math.max(120, pct ?? 0);
  return (
    <section id="panel" className="flex flex-col gap-3">
      <Link href={backHref} scroll={false} className="-ml-1 flex min-h-11 w-fit items-center gap-1 rounded px-1 text-sm font-medium text-sky-800 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-slate-800 md:min-h-8">
        <ChevronLeftIcon /> {t.backToList}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 tabIndex={-1} data-autofocus className="text-balance outline-none text-xl font-bold leading-tight">{name}</h2>
          <p className="text-sm text-slate-700 dark:text-slate-300">{subtitle}</p>
        </div>
        <StatusBadge status={status} label={t.status[status]} />
      </div>

      {!reading ? (
        <p>{t.noData}</p>
      ) : (
        <>
          {/* The one number that matters: how far from the bank, and which side. */}
          <div aria-live="polite" className="border-b border-slate-200 pb-3 dark:border-slate-700">
            {gap != null ? (
              <p className="flex items-baseline gap-2">
                <span className="text-4xl font-bold leading-none tabular-nums" style={{ color: tone(status) }}>{Math.abs(gap).toFixed(2)}</span>
                <span className="text-base font-semibold">{lang === "th" ? "ม." : "m"} {gap < 0 ? t.heroAbove : t.heroBelow}</span>
              </p>
            ) : (
              <p className="flex items-baseline gap-2">
                <span className="text-4xl font-bold leading-none tabular-nums">{reading.levelMsl.toFixed(2)}</span>
                <span className="text-base font-semibold">{t.level}</span>
              </p>
            )}
            {pct != null && (
              <div className="mt-7" role="img" aria-label={`${t.bankPct}: ${pct.toFixed(1)}%`}>
                <div className="relative h-2.5 rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (pct / scale) * 100)}%`, background: tone(status) }} />
                  <div className="absolute -top-1 h-[18px] w-0.5 rounded bg-slate-900 dark:bg-slate-100" style={{ left: `${(100 / scale) * 100}%` }} />
                  <span className="absolute -top-6 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-slate-800 dark:text-slate-200" style={{ left: `${(100 / scale) * 100}%` }}>{t.gaugeBank}</span>
                </div>
                <p className="mt-1.5 text-xs tabular-nums text-slate-700 dark:text-slate-300">{pct.toFixed(1)}{t.bankPct}</p>
              </div>
            )}
            {nearBank && (
              <p className="mt-2 flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
                <WarnIcon /> {t.nearBank}
              </p>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Fact label={t.level} value={reading.levelMsl.toFixed(2)} />
            <div>
              <dt className="text-xs text-slate-600 dark:text-slate-400">{t.trendLabel}</dt>
              <dd className="flex items-center gap-1.5 text-base font-semibold">
                {trend ? (
                  <>
                    <TrendIcon dir={trend} /> {t.trendWord[trend]}
                  </>
                ) : (
                  "–"
                )}
              </dd>
            </div>
            <div className="col-span-2">
              <Fact label={t.updated} value={fmtTime(parseIct(reading.datetime), lang)} />
            </div>
          </dl>
          <p className="-mt-1 text-xs text-slate-600 dark:text-slate-400">{t.mslNote}</p>

          <Suspense fallback={<div className="h-20 rounded-lg bg-slate-50 dark:bg-slate-800" aria-hidden="true" />}>
            <RainBox lat={reading.lat} lon={reading.lon} now={now} failed={failed} lang={lang} t={t} />
          </Suspense>
        </>
      )}

      <div>
        <h3 className="mb-1 text-sm font-semibold">{t.chart}</h3>
        {graph ? <LevelChart points={graph.points} bankM={graph.bankM} lang={lang} t={t} /> : <p className="text-sm text-slate-600 dark:text-slate-400">{t.noChart}</p>}
      </div>

      {reading && (
        <div>
          <h3 className="mb-1 text-sm font-semibold">{t.forecast}</h3>
          <Suspense fallback={<p className="text-sm text-slate-600 dark:text-slate-400">…</p>}>
            <ForecastPanel lat={reading.lat} lon={reading.lon} now={now} lang={lang} t={t} />
          </Suspense>
        </div>
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="text-base font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
