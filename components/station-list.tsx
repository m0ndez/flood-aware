import Link from "next/link";
import { RegionTab } from "@/components/region-tab";
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
  level: number | null; // m above sea level: only a fallback when the gauge has no bank level
  gap: number | null; // m to the bank, + below it, - above it
  status: Status;
  mark?: boolean; // gap is the margin to a BMA mark, not to a bank
  href: string;
};
export type RegionTab = { key: Region; label: string; href: string; count?: number }; // undefined = not known yet, so no number is shown

const GROUPS: Group[] = ["nonthaburi", "upstream", "downstream", "nearby"];
const worstRank = (rows: StationRow[]) => Math.max(0, ...rows.map((r) => severityRank(r.status)));

// The one figure a row leads with: how far from the bank, and which side. Height above sea level can't be
// compared between gauges (every bank sits at a different height), so it is only a fallback.
function figure(r: StationRow, t: Dict): string {
  if (r.status === "stale") return "–"; // a stale reading must not read as a current margin
  // BMA amber starts AT its mark, so a margin of 0.00 reads as "above" it, not "0.00 below".
  if (r.gap != null) return (r.mark ? (r.gap <= 0 ? t.bma.rowAbove : t.bma.rowBelow) : r.gap < 0 ? t.rowAbove : t.rowBelow).replace("{n}", Math.abs(r.gap).toFixed(2));
  return r.level != null ? t.rowLevel.replace("{n}", r.level.toFixed(2)) : "–";
}

export function StationList({
  rows,
  region,
  regions,
  selectedId,
  activeGroup,
  groupHref,
  coverage,
  t,
}: {
  rows: StationRow[];
  region: Region;
  regions: RegionTab[];
  selectedId: number | null;
  activeGroup: string | null;
  groupHref: (key: string | null) => string; // null clears the highlight
  coverage?: string; // what this area does and does not monitor, when it is thin (see lib/coverage.ts)
  t: Dict;
}) {
  // Nonthaburi keeps its hand-made role order; Central and Eastern go worst province first, so red is never
  // hidden behind an alphabetical collapsed group. Rows inside a group are worst first too.
  const bySeverity = (a: StationRow, b: StationRow) => severityRank(b.status) - severityRank(a.status);
  const groups = (
    region === "nonthaburi"
      ? GROUPS.map((g) => ({ key: g as string, label: t.group[g], rows: rows.filter((r) => r.group === g) }))
      : [...Map.groupBy(rows, (r) => r.groupKey)]
          // The combined view mixes Nonthaburi's hand-made roles with provinces, so a role says which area it is in.
          .map(([key, rs]) => ({ key, label: rs[0].province ?? `${t.region.nonthaburi} · ${t.group[rs[0].group]}`, rows: rs }))
          .sort((a, b) => worstRank(b.rows) - worstRank(a.rows) || a.label.localeCompare(b.label))
  ).map((g) => {
    // A river shared by every row is said once in the heading instead of on each row.
    const rivers = new Set(g.rows.map((r) => r.river));
    return { ...g, rows: [...g.rows].sort(bySeverity), river: rivers.size === 1 && g.rows.length > 1 ? [...rivers][0] : "" };
  });
  const touch = "max-md:min-h-11";
  return (
    <section aria-labelledby="all">
      <h2 id="all" tabIndex={-1} data-autofocus className="outline-none mb-2 text-base font-bold">{t.stations}</h2>
      <nav aria-label={t.regionLabel} // Desktop: one scrolling row that stays at the top of the sheet. Phone: wraps, and scrolls away with the content.
      className="-mx-4 mb-2 flex flex-wrap gap-1.5 px-4 py-2 md:sticky md:top-0 md:z-10 md:flex-nowrap md:overflow-x-auto md:bg-white md:py-1.5 md:[scrollbar-width:none] dark:md:bg-slate-900">
        {regions.map((r) => (
          <RegionTab
            key={r.key}
            href={r.href}
            active={r.key === region}
            loadingLabel={t.loading}
            className={`flex shrink-0 items-center whitespace-nowrap rounded-full border px-3 py-1 text-sm font-medium ${touch} ${r.key === region ? "border-sky-700 bg-sky-700 text-white" : "border-slate-400 dark:border-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"}`}
          >
            {r.label}
            {r.count != null && <>&nbsp;<span className="tabular-nums opacity-80">{r.count}</span></>}
          </RegionTab>
        ))}
      </nav>
      {region !== "nonthaburi" && <p className="mb-2 text-xs text-slate-700 dark:text-slate-300">{t.regionNote}</p>}
      {coverage && <p className="mb-2 text-xs font-medium text-slate-800 dark:text-slate-200">{coverage}</p>}
      {rows.length === 0 && <p className="text-sm text-slate-700 dark:text-slate-300">{t.noRegionStations}</p>}
      {groups.map((g, i) => {
        const active = g.key === activeGroup;
        return (
          // The "show on map" link is a sibling of <summary>, never inside it: interactive content in a
          // summary is invalid and screen readers swallow it. The pill is overlaid on the summary's right edge.
          <div key={g.key} className="relative mb-1">
            <details open={i === 0 || active || worstRank(g.rows) >= severityRank("critical") || g.rows.some((r) => r.id === selectedId)}>
              <summary className={`flex cursor-pointer items-center py-2 pr-12 text-sm font-semibold text-slate-700 dark:text-slate-300 ${touch}`}>
                <span>
                  {g.label}
                  {g.river && <span className="font-normal text-slate-600 dark:text-slate-400"> · {g.river}</span>}{" "}
                  <span className="font-normal tabular-nums text-slate-600 dark:text-slate-400">{g.rows.length}</span>
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
                        {((!g.river && r.river) || r.note) && (
                          <span className="block text-xs text-slate-600 dark:text-slate-400">{[g.river ? "" : r.river, r.note].filter(Boolean).join(" · ")}</span>
                        )}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5">
                        <span className="text-sm tabular-nums">{figure(r, t)}</span>
                        <StatusBadge status={r.status} label={t.status[r.status]} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
            {/* One quiet icon per heading. Tapping it spotlights the group on the map; tapping again clears it. */}
            <Link
              href={groupHref(active ? null : g.key)}
              scroll={false}
              aria-current={active ? "true" : undefined}
              aria-label={`${g.label}: ${active ? t.clearHighlight : t.showOnMap}`}
              title={active ? t.clearHighlight : t.showOnMap}
              className={`absolute right-0 top-0.5 grid size-11 place-items-center rounded-full md:top-0 md:size-9 ${active ? "bg-sky-700 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
                <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
            </Link>
          </div>
        );
      })}
    </section>
  );
}
