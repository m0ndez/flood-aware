import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { About } from "@/components/about";
import { AutoRefresh } from "@/components/auto-refresh";
import { CamPanel } from "@/components/cam-panel";
import { FloatingSheet } from "@/components/floating-sheet";
import { Legend } from "@/components/legend";
import { Verdict, headlineText } from "@/components/verdict";
import { StationDetail } from "@/components/station-detail";
import { StationList, type RegionTab, type StationRow } from "@/components/station-list";
import { StatusBadge, StatusIcon } from "@/components/status-badge";
import { StationMap, type MapCamera, type MapStation } from "@/components/station-map";
import { Outlook, WarningStrip } from "@/components/tmd-panels";
import { loadCameras } from "@/lib/cctv";
import { floodDates } from "@/lib/gibs";
import { dict, fmtTime, type Lang } from "@/lib/i18n";
import { MAP_COOKIE, parseMapStyle } from "@/lib/mapstyle";
import { REGIONS, type Region } from "@/lib/regions";
import { parseIct } from "@/lib/status";
import { countStatuses, headlineOf, worstOf } from "@/lib/verdict";
import { statusOf, trendOf, type Status } from "@/lib/status";
import { CORE_STATIONS, loadGraph, loadOverview, type Reading, type Station } from "@/lib/thaiwater";

export default function Page({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<p className="grid h-dvh place-items-center text-slate-700 dark:text-slate-300">{dict.th.loading}</p>}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [sp, jar] = await Promise.all([searchParams, cookies()]); // both are request-time reads: do not queue them
  const lang: Lang = sp.lang === "en" ? "en" : "th";
  const t = dict[lang];
  const mapStyle = parseMapStyle(jar.get(MAP_COOKIE)?.value); // theme preference, see lib/mapstyle.ts
  const wanted = Number(Array.isArray(sp.station) ? sp.station[0] : sp.station);

  // The station list is derived from the feed (Central and Eastern), so load it before validating ?station=.
  const { data, failed, now } = await loadOverview();
  const stations: Station[] = data?.stations ?? CORE_STATIONS;
  // No (valid) ?station= means the list view; a station in the URL opens its detail.
  const sel = stations.find((s) => s.id === wanted);
  const selectedId = sel?.id ?? null;
  // The open station decides the region; otherwise ?region=, otherwise Nonthaburi.
  const regionParam = Array.isArray(sp.region) ? sp.region[0] : sp.region;
  const region: Region = sel?.region ?? REGIONS.find((r) => r === regionParam) ?? "nonthaburi";
  // A group is a list section (Upstream, a province...). Selecting one spotlights its stations on the map.
  const groupKeyOf = (s: Station) => (s.provinceCode ? `p${s.provinceCode}` : s.group);
  const inRegion = stations.filter((s) => s.region === region);
  const groupParam = Array.isArray(sp.group) ? sp.group[0] : sp.group;
  const activeGroup = inRegion.some((s) => groupKeyOf(s) === groupParam) ? (groupParam as string) : null;
  // station=null is the list view. Everything is shareable through the URL; the active group rides along
  // until a region change or a second tap on its header clears it.
  const href = (id: number | null, opts: { lang?: Lang; cam?: string; region?: Region; group?: string | null } = {}) =>
    `/?${[
      id != null && `station=${id}`,
      id == null && opts.region && opts.region !== "nonthaburi" && `region=${opts.region}`,
      `lang=${opts.lang ?? lang}`,
      opts.cam && `cam=${encodeURIComponent(opts.cam)}`,
      (opts.group === undefined ? activeGroup : opts.group) && `group=${opts.group === undefined ? activeGroup : opts.group}`,
    ]
      .filter(Boolean)
      .join("&")}`;

  const [graph, cameras] = await Promise.all([selectedId != null ? loadGraph(selectedId, stations) : Promise.resolve(null), loadCameras()]);
  const cam = cameras.find((c) => c.code === sp.cam); // only listed camera codes are honoured
  const byId = new Map<number, Reading>((data?.readings ?? []).map((r) => [r.id, r]));
  // Never show green when we can't confirm: upstream failure forces every station to stale.
  const statusFor = (r: Reading | undefined): Status =>
    !r || failed ? "stale" : statusOf(r.situation, r.datetime, now);

  // The map shows the chosen region (plus the open station, wherever it is).
  const inView = stations.filter((s) => s.region === region || s.id === selectedId);
  const mapStations: MapStation[] = inView.flatMap((s) => {
    const r = byId.get(s.id);
    return r ? [{ id: s.id, lat: r.lat, lon: r.lon, status: statusFor(r), name: s.name[lang], label: `${s.name[lang]} · ${t.status[statusFor(r)]}`, href: href(s.id, { cam: cam?.code }) }] : [];
  });

  const mapCameras: MapCamera[] = cameras.map((c) => ({
    code: c.code,
    lat: c.lat,
    lon: c.lon,
    label: `${t.camTitle} ${c.code} ${c.name}`,
    href: href(selectedId, { cam: c.code }),
  }));

  const highlightIds = activeGroup ? inRegion.filter((s) => groupKeyOf(s) === activeGroup).map((s) => s.id) : [];
  const rows: StationRow[] = inRegion
    .map((s) => {
      const r = byId.get(s.id);
      return {
        id: s.id,
        group: s.group,
        groupKey: groupKeyOf(s),
        province: s.province?.[lang],
        name: s.name[lang],
        river: s.river[lang],
        note: lang === "en" && s.thaiOnly ? t.thaiNameOnly : undefined,
        level: r?.levelMsl ?? null,
        status: statusFor(r),
        href: href(s.id, { cam: cam?.code }),
      };
    });
  const regions: RegionTab[] = REGIONS.map((k) => ({
    key: k,
    label: t.region[k],
    href: href(null, { region: k, group: null, cam: cam?.code }), // a region change clears the highlight
    count: stations.filter((s) => s.region === k).length,
  }));

  const selR = sel ? byId.get(sel.id) : undefined;
  const selStatus = statusFor(selR);
  const trend = graph ? trendOf(graph.points) : null;

  // Collapsed mobile sheet shows the selected station, or the first one when nothing is selected.
  // Outlook for the open station's province; the Nonthaburi view and list keep Nonthaburi, other lists have none.
  const outlookFor = sel?.province ?? (region === "nonthaburi" ? { th: "นนทบุรี", en: "Nonthaburi" } : null);
  // The verdict: counts over the region on view, the worst status, and how fresh the newest reading is.
  // In the Nonthaburi view the headline is about the gauges inside Nonthaburi; upstream, downstream and nearby
  // klongs (Ayutthaya, Bangkok...) are counted on their own line so a red marker elsewhere is never read as local.
  const focus = region === "nonthaburi" ? rows.filter((r) => r.group === "nonthaburi") : rows;
  const counts = countStatuses(focus.map((r) => r.status));
  const surround = region === "nonthaburi" ? countStatuses(rows.map((r) => r.status)) : null;
  const headline = headlineOf(counts);
  const times = inRegion.flatMap((s) => (byId.get(s.id) ? [parseIct(byId.get(s.id)!.datetime)] : [])).filter(Number.isFinite);
  const asOf = times.length > 0 && !failed ? fmtTime(Math.max(...times), lang) : null;

  return (
    <main className={`${mapStyle === "dark" ? "dark bg-slate-950 text-slate-100" : "bg-white text-slate-900"} relative isolate h-dvh w-full overflow-hidden`}>
      {/* Banner: failure alert + TMD warnings. Above the sheet so it is never hidden. */}
      <div className="pointer-events-none absolute left-3 right-16 top-3 z-50 flex flex-col items-stretch gap-2 md:left-[28rem] md:right-60 md:items-center">
        {failed && (
          <p role="alert" className="pointer-events-auto rounded-lg border border-red-700 dark:border-red-500 bg-red-50 dark:bg-red-950 p-3 text-sm font-medium text-red-800 dark:text-red-200 shadow-lg md:max-w-xl">
            {data ? t.error : t.errorNone}
          </p>
        )}
        <div className="pointer-events-auto max-h-[35dvh] w-full overflow-y-auto md:max-w-xl">
          <Suspense fallback={null}>
            <WarningStrip now={now} lang={lang} t={t} />
          </Suspense>
        </div>
      </div>

      <FloatingSheet
        focusKey={`${selectedId ?? "list"}|${cam?.code ?? ""}`}
        initial={selectedId != null || cam ? "half" : "peek"}
        resizeLabel={t.sheetResize}
        stateLabels={t.sheetState}
        header={
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-balance text-lg font-bold leading-tight md:text-2xl">{t.title}</h1>
                <p className="hidden text-balance text-sm text-slate-700 dark:text-slate-300 md:block">{t.subtitle}</p>
              </div>
              <Link
                href={href(selectedId, { lang: lang === "th" ? "en" : "th", cam: cam?.code })}
                hrefLang={lang === "th" ? "en" : "th"}
                className="flex shrink-0 items-center rounded-full border border-slate-400 px-3 py-1 text-sm font-medium hover:bg-slate-100 dark:border-slate-500 dark:hover:bg-slate-700 max-md:min-h-11"
              >
                {t.switchLang}
              </Link>
            </div>
            {/* Collapsed phone sheet: the open station, otherwise the verdict for the area on screen. */}
            <p className="mt-1.5 hidden items-center justify-between gap-2 max-md:group-data-[detent=peek]:flex">
              {sel ? (
                <>
                  <span className="truncate text-sm font-medium">{sel.name[lang]}</span>
                  <StatusBadge status={selStatus} label={t.status[selStatus]} />
                </>
              ) : headline ? (
                <>
                  <span className="truncate text-sm font-semibold">{headlineText(headline, t)}</span>
                  <StatusIcon status={worstOf(counts)} size={20} />
                </>
              ) : null}
            </p>
          </>
        }
        footer={<About t={t} />}
      >
        {cam && <CamPanel cam={cam} closeHref={href(selectedId)} lang={lang} t={t} />}
        {!sel && headline && <Verdict counts={counts} headline={headline} area={t.region[region]} surround={surround} asOf={asOf} t={t} />}
        {sel ? (
          <StationDetail
            name={sel.name[lang]}
            subtitle={[sel.river[lang], sel.province?.[lang], sel.code, lang === "en" && sel.thaiOnly ? t.thaiNameOnly : ""].filter(Boolean).join(" · ")}
            reading={selR}
            status={selStatus}
            graph={graph}
            trend={trend}
            failed={failed}
            now={now}
            backHref={href(null, { region: sel.region, cam: cam?.code })}
            lang={lang}
            t={t}
          />
        ) : (
          <StationList rows={rows} region={region} regions={regions} selectedId={selectedId} activeGroup={activeGroup} groupHref={(key) => href(null, { region, group: key, cam: cam?.code })} t={t} />
        )}
        {outlookFor && (
          <details className="mt-4 border-t border-slate-200 pt-1 dark:border-slate-700">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold md:min-h-9">{t.outlook.replace("{p}", outlookFor[lang])}</summary>
            <div className="mt-2">
              <Suspense fallback={<p className="text-sm text-slate-600 dark:text-slate-400">…</p>}>
                <Outlook provinceTh={outlookFor.th} lang={lang} t={t} />
              </Suspense>
            </div>
          </details>
        )}
      </FloatingSheet>

      <AutoRefresh />
      <StationMap stations={mapStations} cameras={mapCameras} selectedId={selectedId} selectedCam={cam?.code ?? null} mapStyle={mapStyle} highlightIds={highlightIds} regionKey={region} floodDates={floodDates(now)} lang={lang} t={t} />

      <div className="absolute bottom-6 left-[28rem] z-20 hidden rounded-xl bg-white/90 dark:bg-slate-900/90 px-3 py-2 shadow-lg dark:ring-1 dark:ring-white/10 backdrop-blur-xl md:block">
        <Legend t={t} />
      </div>
    </main>
  );
}
