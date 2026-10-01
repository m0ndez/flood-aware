import type { Lang } from "./i18n.ts";
import { REGIONS, type Region } from "./regions.ts";
import { statusOf, type Status } from "./status.ts";
import type { Reading, Station } from "./stations.ts";

// The URL is the whole view state: ?station=&region=&group=&cam=&lang=. Everything here is pure so the rules that
// decide what a visitor sees (and what a bad or stale link falls back to) are testable without rendering.

export type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// A group is a list section (Upstream, a province...). Selecting one spotlights its stations on the map.
export const groupKeyOf = (s: Station) => (s.provinceCode ? `p${s.provinceCode}` : s.group);

export function resolveView(sp: SearchParams, stations: Station[]) {
  // No (valid) ?station= means the list view; a station in the URL opens its detail.
  const sel = stations.find((s) => s.id === Number(first(sp.station)));
  // The open station decides the region; otherwise ?region=, otherwise Nonthaburi. Unknown values fall back.
  const regionParam = first(sp.region);
  const region: Region = sel?.region ?? REGIONS.find((r) => r === regionParam) ?? "nonthaburi";
  const inRegion = stations.filter((s) => s.region === region);
  // A group from another region (or a made-up one) is ignored rather than highlighting nothing.
  const groupParam = first(sp.group);
  const activeGroup = groupParam && inRegion.some((s) => groupKeyOf(s) === groupParam) ? groupParam : null;
  return { sel, selectedId: sel?.id ?? null, region, inRegion, activeGroup };
}

export type HrefOptions = { lang?: Lang; cam?: string; region?: Region; group?: string | null };

// station=null is the list view. The active group rides along until a region change or a second tap on its header
// clears it (pass group: null). `group: undefined` keeps the current one.
export function makeHref(lang: Lang, activeGroup: string | null) {
  return (id: number | null, opts: HrefOptions = {}) => {
    const group = opts.group === undefined ? activeGroup : opts.group;
    return `/?${[
      id != null && `station=${id}`,
      id == null && opts.region && opts.region !== "nonthaburi" && `region=${opts.region}`,
      `lang=${opts.lang ?? lang}`,
      opts.cam && `cam=${encodeURIComponent(opts.cam)}`,
      group && `group=${group}`,
    ]
      .filter(Boolean)
      .join("&")}`;
  };
}

// Never show green when we can't confirm: a failed fetch, a missing reading or old data all read as stale.
export function makeStatusFor(failed: boolean, now: number) {
  return (r: Reading | undefined): Status => (!r || failed ? "stale" : statusOf(r.situation, r.datetime, now));
}
