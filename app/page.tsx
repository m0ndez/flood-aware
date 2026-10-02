import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { About } from "@/components/about";
import { AutoRefresh } from "@/components/auto-refresh";
import { LangSync } from "@/components/lang-sync";
import { CamPanel } from "@/components/cam-panel";
import { FloatingSheet } from "@/components/floating-sheet";
import { NewsSection } from "@/components/news-section";
import { Legend } from "@/components/legend";
import { Verdict, headlineText } from "@/components/verdict";
import { StationDetail } from "@/components/station-detail";
import { StationList, type RegionTab, type StationRow } from "@/components/station-list";
import { StatusBadge, StatusIcon } from "@/components/status-badge";
import { LinesSkeleton, NewsSkeleton, PageSkeleton } from "@/components/skeleton";
import { StationMap, type MapCamera, type MapRoad, type MapStation } from "@/components/station-map";
import { Outlook, WarningStrip } from "@/components/tmd-panels";
import { RoadsSection } from "@/components/roads-section";
import { BmaDetail } from "@/components/bma-detail";
import { bmaId, bmaReading, bmaStation, bmaUiStatus, isBmaId } from "@/lib/bma-adapt";
import { loadBma } from "@/lib/bma";
import { ageOf } from "@/lib/news-parse";
import { currentRoads, roadsInBox } from "@/lib/roads-parse";
import { loadRoads } from "@/lib/roads";
import { loadCameras } from "@/lib/cctv";
import { floodDates } from "@/lib/gibs";
import { dict, fmtTime, type Lang } from "@/lib/i18n";
import { MAP_COOKIE, parseMapStyle } from "@/lib/mapstyle";
import { coverageOf } from "@/lib/coverage";
import { BANGNA_CENTER, REGIONS, REGION_BOX } from "@/lib/regions";
import { EXTRA_KEYWORDS } from "@/lib/warnings";
import { countStatuses, headlineOf, worstOf } from "@/lib/verdict";
import { parseIct, trendOf } from "@/lib/status";
import { groupKeyOf, makeHref, makeStatusFor, resolveView } from "@/lib/view-state";
import { CORE_STATIONS, loadGraph, loadOverview, type Reading, type Station } from "@/lib/thaiwater";

const COVERAGE_KM = 5;
const ROADS_ON_MAP = 150;

export default function Page({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<PageSkeleton label={dict.th.loading} />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const [sp, jar] = await Promise.all([searchParams, cookies()]); // both are request-time reads: do not queue them
  const lang: Lang = sp.lang === "en" ? "en" : "th";
  const t = dict[lang];
  const mapStyle = parseMapStyle(jar.get(MAP_COOKIE)?.value); // theme preference, see lib/mapstyle.ts
  // The station list is derived from the feed (Central and Eastern), so load it before validating ?station=.
  // BMA's canal and pumping-station feed runs in parallel; it is cached, and a failure only affects the Bang Na view.
  // Only the Bang Na view needs BMA, and its first (cold) fetch takes ~5 s: every other view gives it 1.5 s and moves on.
  // The fetch keeps running and fills the cache, so the next visit has it.
  // The combined "all" view (the default) and Bang Na list BMA stations; the Nonthaburi, Central and Eastern shortcuts do not.
  const regionQuery = Array.isArray(sp.region) ? sp.region[0] : sp.region;
  const needsBma = !["nonthaburi", "central", "eastern"].includes(regionQuery ?? "") || Number(Array.isArray(sp.station) ? sp.station[0] : sp.station) < 0;
  const soft = <T,>(p: Promise<T | null>, ms: number) => {
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([p, new Promise<null>((r) => (timer = setTimeout(() => r(null), ms)))]).finally(() => clearTimeout(timer));
  };
  const [{ data, failed, now }, bma, roadReports] = await Promise.all([loadOverview(), needsBma ? loadBma() : soft(loadBma(), 1_500), loadRoads()]);
  const bmaById = new Map((bma?.stations ?? []).map((s) => [bmaId(s), s]));
  const bmaStatus = new Map([...bmaById].map(([id, s]) => [id, bmaUiStatus(s, now)]));
  const stations: Station[] = [...(data?.stations ?? CORE_STATIONS), ...(bma?.stations ?? []).map(bmaStation)];
  const { sel, selectedId, region, inRegion, activeGroup } = resolveView(sp, stations);
  const href = makeHref(lang, activeGroup);

  const [graph, cameras] = await Promise.all([selectedId != null && !isBmaId(selectedId) ? loadGraph(selectedId, stations) : Promise.resolve(null), loadCameras()]);
  const cam = cameras.find((c) => c.code === sp.cam); // only listed camera codes are honoured
  const byId = new Map<number, Reading>([...(data?.readings ?? []), ...[...bmaById.values()].map((s) => bmaReading(s, bmaStatus.get(bmaId(s)) ?? "stale"))].map((r) => [r.id, r]));
  const thaiwaterStatus = makeStatusFor(failed, now);
  // A BMA reading has its own status (amber at most, see lib/bma-adapt.ts) and its own failure, independent of ThaiWater.
  const statusFor = (r: Reading | undefined) => (r && isBmaId(r.id) ? (bmaStatus.get(r.id) ?? "stale") : thaiwaterStatus(r));

  // The map shows the chosen region (plus the open station, wherever it is).
  const inView = stations.filter((s) => region === "all" || s.region === region || s.id === selectedId);
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
        gap: r?.bankM != null ? r.bankM - r.levelMsl : null, // + below the bank, - above it
        status: statusFor(r),
        mark: isBmaId(s.id),
        href: href(s.id, { cam: cam?.code }),
      };
    });
  const regions: RegionTab[] = REGIONS.map((k) => ({
    key: k,
    label: t.region[k],
    href: href(null, { region: k, group: null, cam: cam?.code }), // a region change clears the highlight
    // Bang Na's count includes BMA, which other views only wait 1.5 s for: no number is better than a wrong one.
    count: (k === "bangna" || k === "all") && !bma && !needsBma ? undefined : k === "all" ? stations.length : stations.filter((s) => s.region === k).length,
  }));

  // Flooded-road reports (Longdo/iTIC): the map layer covers all four views, the sheet lists the one on view.
  // null = the feed could not be read, which the list says out loud.
  const activeRoads = roadReports ? currentRoads(roadReports, now) : null;
  const roadTitle = (r: { title: string; titleEn: string }) => (lang === "en" && r.titleEn ? r.titleEn : r.title);
  const rtf = new Intl.RelativeTimeFormat(lang === "th" ? "th-TH" : "en", { numeric: "auto" });
  // The map layer covers the whole country the feed covers. The view on screen goes first, so a cap can never push its
  // own reports out in favour of newer ones elsewhere.
  const regionRoads = activeRoads ? roadsInBox(activeRoads, REGION_BOX[region]) : null;
  const regionRoadIds = new Set(regionRoads?.map((r) => r.id));
  const mapRoads: MapRoad[] = [...(regionRoads ?? []), ...(activeRoads ?? []).filter((r) => !regionRoadIds.has(r.id))].slice(0, ROADS_ON_MAP).map((r) => {
    const a = ageOf(r.start, now);
    return { id: r.id, lat: r.lat, lon: r.lon, title: roadTitle(r), place: r.place, ageText: rtf.format(a.value, a.unit), sourceLabel: t.roads.source[r.source] };
  });
  const roadsElsewhere = activeRoads ? activeRoads.length - (regionRoads?.length ?? 0) : 0;

  // A thin area says what it has: gauges per province, how many are not updating, and how many are near Bang Na.
  const coverage = (() => {
    // The combined view only needs to say when BMA data is second-hand; the Bang Na view also says how thin its cover is.
    if (region === "all") return bma?.source === "mirror" ? t.bma.viaMirror : undefined;
    if (region !== "bangna") return undefined;
    const c = coverageOf(
      inRegion.flatMap((s) => {
        const r = byId.get(s.id);
        return r ? [{ province: s.province?.[lang] ?? "", lat: r.lat, lon: r.lon, stale: statusFor(r) === "stale" }] : [];
      }),
      BANGNA_CENTER,
      COVERAGE_KM,
    );
    const k = t.coverage;
    const parts = c.provinces.map((p) => [k.province.replace("{p}", p.name).replace("{n}", String(p.n)), p.stale > 0 ? ` (${k.stale.replace("{s}", String(p.stale))})` : ""].join(""));
    parts.push((c.near > 0 ? k.near : k.nearNone).replace("{r}", String(COVERAGE_KM)).replace("{n}", String(c.near)));
    return `${k.lead}: ${parts.join(" · ")}${bma?.source === "mirror" ? ` · ${t.bma.viaMirror}` : ""}`;
  })();

  const selR = sel ? byId.get(sel.id) : undefined;
  const selStatus = statusFor(selR);
  const trend = graph ? trendOf(graph.points) : null;

  // Collapsed mobile sheet shows the selected station, or the first one when nothing is selected.
  // Outlook for the open station's province; the Nonthaburi view and list keep Nonthaburi, other lists have none.
  const outlookFor = (sel && isBmaId(sel.id) ? { th: "สมุทรปราการ", en: "Samut Prakan" } : sel?.province) ?? (region === "nonthaburi" ? { th: "นนทบุรี", en: "Nonthaburi" } : region === "bangna" ? { th: "สมุทรปราการ", en: "Samut Prakan" } : null);
  // The verdict: counts over the region on view, the worst status, and how fresh the newest reading is.
  // In the Nonthaburi view the headline is about the gauges inside Nonthaburi; upstream, downstream and nearby
  // klongs (Ayutthaya, Bangkok...) are counted on their own line so a red marker elsewhere is never read as local.
  // In the Bang Na view the headline is about the ThaiWater gauges (which can say "over bank"); the BMA canals, pumps and
  // gates, amber at most, are a separate labelled line so their routine "above mark" readings do not drive the headline.
  const thaiwaterRows = rows.filter((r) => !r.mark);
  const bangnaSplit = (region === "bangna" || region === "all") && thaiwaterRows.length > 0 && thaiwaterRows.length < rows.length;
  const focus = region === "nonthaburi" ? rows.filter((r) => r.group === "nonthaburi") : bangnaSplit ? thaiwaterRows : rows;
  const counts = countStatuses(focus.map((r) => r.status));
  const surround = region === "nonthaburi" || bangnaSplit ? countStatuses(rows.map((r) => r.status)) : null;
  const headline = headlineOf(counts);
  const times = inRegion.flatMap((s) => (byId.get(s.id) ? [parseIct(byId.get(s.id)!.datetime)] : [])).filter(Number.isFinite);
  const asOf = times.length > 0 && !failed ? fmtTime(Math.max(...times), lang) : null;

  return (
    <main className={`${mapStyle === "dark" ? "dark bg-slate-950 text-slate-100" : "bg-white text-slate-900"} relative isolate h-dvh w-full overflow-hidden`}>
      {/* Banner: failure alert + TMD warnings. Above the sheet so it is never hidden. */}
      <div className="pointer-events-none absolute left-3 right-16 top-3 z-50 flex flex-col items-stretch gap-2 md:left-[28rem] md:right-60 md:items-center">
        {(region === "bangna" || region === "all") && needsBma && !bma && ( // without needsBma we only gave BMA 1.5 s, so a miss is not a failure
          <p role="alert" className="pointer-events-auto rounded-lg border border-red-700 dark:border-red-500 bg-red-50 dark:bg-red-950 p-3 text-sm font-medium text-red-800 dark:text-red-200 shadow-lg md:max-w-xl">
            {t.bma.unavailable}
          </p>
        )}
        {failed && (
          <p role="alert" className="pointer-events-auto rounded-lg border border-red-700 dark:border-red-500 bg-red-50 dark:bg-red-950 p-3 text-sm font-medium text-red-800 dark:text-red-200 shadow-lg md:max-w-xl">
            {data ? t.error : t.errorNone}
          </p>
        )}
        <div className="pointer-events-auto max-h-[35dvh] w-full overflow-y-auto md:max-w-xl">
          <Suspense fallback={null}>
            <WarningStrip now={now} lang={lang} t={t} extra={EXTRA_KEYWORDS[region === "all" ? "bangna" : region]} />
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
        {!sel && headline && <Verdict counts={counts} headline={headline} area={t.region[region]} surround={surround} surroundText={bangnaSplit ? t.verdict.surroundBma : undefined} asOf={asOf} t={t} />}
        {!sel && (
          <Suspense fallback={<NewsSkeleton label={t.loading} />}>
            <NewsSection now={now} lang={lang} t={t} />
          </Suspense>
        )}
        {sel && isBmaId(sel.id) && bmaById.get(sel.id) ? (
          <BmaDetail s={bmaById.get(sel.id)!} name={sel.name[lang]} status={selStatus} mirror={bma?.source === "mirror"} backHref={href(null, { region: sel.region, cam: cam?.code })} lang={lang} t={t} />
        ) : sel ? (
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
          <StationList rows={rows} region={region} regions={regions} selectedId={selectedId} activeGroup={activeGroup} groupHref={(key) => href(null, { region, group: key, cam: cam?.code })} coverage={coverage} t={t} />
        )}
        {!sel && <RoadsSection roads={regionRoads?.slice(0, 8).map((r) => ({ id: r.id, title: roadTitle(r), place: r.place, start: r.start, source: r.source })) ?? null} total={regionRoads?.length ?? 0} elsewhere={roadsElsewhere} now={now} lang={lang} t={t} />}
        {outlookFor && (
          <details className="mt-4 border-t border-slate-200 pt-1 dark:border-slate-700">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold md:min-h-9">{t.outlook.replace("{p}", outlookFor[lang])}</summary>
            <div className="mt-2">
              <Suspense fallback={<LinesSkeleton />}>
                <Outlook provinceTh={outlookFor.th} lang={lang} t={t} />
              </Suspense>
            </div>
          </details>
        )}
      </FloatingSheet>

      <AutoRefresh />
      <LangSync lang={lang} />
      <StationMap stations={mapStations} cameras={mapCameras} selectedId={selectedId} selectedCam={cam?.code ?? null} mapStyle={mapStyle} highlightIds={highlightIds} roads={mapRoads} regionKey={region} floodDates={floodDates(now)} lang={lang} t={t} />

      <div className="absolute bottom-6 left-[28rem] z-20 hidden rounded-xl bg-white/90 dark:bg-slate-900/90 px-3 py-2 shadow-lg dark:ring-1 dark:ring-white/10 backdrop-blur-xl md:block">
        <Legend t={t} />
      </div>
    </main>
  );
}
