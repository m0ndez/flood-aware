import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import type { Dict } from "@/lib/i18n";
import type { Region } from "@/lib/regions";
import type { Status } from "@/lib/status";
import type { Group } from "@/lib/thaiwater";
import { severityRank } from "@/lib/verdict";

export type StationRow = {
  id: number;
  group: Group;
  groupKey: string; // list section: a role for Nonthaburi, a province for Central/Eastern
  province?: string;
  name: string;
  river: string;
  note?: string; // e.g. "Thai name only"
  level: number | null;
  status: Status;
  href: string;
};
export type RegionTab = { key: Region; label: string; href: string; count: number };

const GROUPS: Group[] = ["nonthaburi", "upstream", "downstream", "nearby"];
const worstRank = (rows: StationRow[]) => Math.max(0, ...rows.map((r) => severityRank(r.status)));

export function StationList({
  rows,
  region,
  regions,
  selectedId,
  activeGroup,
  groupHref,
  t,
}: {
  rows: StationRow[];
  region: Region;
  regions: RegionTab[];
  selectedId: number | null;
  activeGroup: string | null;
  groupHref: (key: string | null) => string; // null clears the highlight
  t: Dict;
}) {
  // Nonthaburi keeps its hand-made role order; Central and Eastern go worst province first, so red is never
  // hidden behind an alphabetical collapsed group. Rows inside a group are worst first too.
  const bySeverity = (a: StationRow, b: StationRow) => severityRank(b.status) - severityRank(a.status);
  const groups = (
    region === "nonthaburi"
      ? GROUPS.map((g) => ({ key: g as string, label: t.group[g], rows: rows.filter((r) => r.group === g) }))
      : [...Map.groupBy(rows, (r) => r.groupKey)]
          .map(([key, rs]) => ({ key, label: rs[0].province ?? key, rows: rs }))
          .sort((a, b) => worstRank(b.rows) - worstRank(a.rows) || a.label.localeCompare(b.label))
  ).map((g) => ({ ...g, rows: [...g.rows].sort(bySeverity) }));
  const touch = "max-md:min-h-11";
  return (
    <section aria-labelledby="all">
      <h2 id="all" tabIndex={-1} data-autofocus className="outline-none mb-2 text-base font-bold">{t.stations}</h2>
      <nav aria-label={t.regionLabel} className="mb-2 flex flex-wrap gap-1.5">
        {regions.map((r) => (
          <Link
            key={r.key}
            href={r.href}
            scroll={false}
            aria-current={r.key === region ? "page" : undefined}
            className={`flex items-center rounded-full border px-3 py-1 text-sm font-medium ${touch} ${r.key === region ? "border-sky-700 bg-sky-700 text-white" : "border-slate-400 dark:border-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"}`}
          >
            {r.label}&nbsp;<span className="tabular-nums opacity-80">{r.count}</span>
          </Link>
        ))}
      </nav>
      {region !== "nonthaburi" && <p className="mb-2 text-xs text-slate-700 dark:text-slate-300">{t.regionNote}</p>}
      {rows.length === 0 && <p className="text-sm text-slate-700 dark:text-slate-300">{t.noRegionStations}</p>}
      {groups.map((g, i) => {
        const active = g.key === activeGroup;
        return (
          // The "show on map" link is a sibling of <summary>, never inside it: interactive content in a
          // summary is invalid and screen readers swallow it. The pill is overlaid on the summary's right edge.
          <div key={g.key} className="relative mb-1">
            <details open={i === 0 || active || worstRank(g.rows) >= severityRank("critical") || g.rows.some((r) => r.id === selectedId)}>
              <summary className={`flex cursor-pointer items-center py-2 pr-36 text-sm font-semibold text-slate-700 dark:text-slate-300 ${touch}`}>
                <span>
                  {g.label} <span className="font-normal tabular-nums text-slate-600 dark:text-slate-400">{g.rows.length}</span>
                </span>
              </summary>
              <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white/70 dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800/70">
                {g.rows.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={r.href}
                      scroll={false}
                      aria-current={r.id === selectedId ? "true" : undefined}
                      className={`flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 ${r.id === selectedId ? "bg-sky-50 dark:bg-sky-950" : ""}`}
                    >
                      <span className="min-w-0">
                        <span className="block font-medium">{r.name}</span>
                        {(r.river || r.note) && <span className="block text-xs text-slate-600 dark:text-slate-400">{[r.river, r.note].filter(Boolean).join(" · ")}</span>}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        {r.level != null && <span className="text-sm tabular-nums">{r.level.toFixed(2)} m</span>}
                        <StatusBadge status={r.status} label={t.status[r.status]} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
            <Link
              href={groupHref(active ? null : g.key)}
              scroll={false}
              aria-current={active ? "true" : undefined}
              aria-label={`${g.label}: ${active ? t.clearHighlight : t.showOnMap}`}
              className={`absolute right-0 top-1 flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium max-md:min-h-11 md:top-1.5 ${active ? "border-sky-700 bg-sky-700 text-white" : "border-slate-400 text-slate-800 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-100 dark:hover:bg-slate-700"}`}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              {active ? t.clearHighlight : t.showOnMap}
            </Link>
          </div>
        );
      })}
    </section>
  );
}
