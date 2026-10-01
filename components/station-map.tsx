"use client";

import "leaflet/dist/leaflet.css";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { LayerControl } from "@/components/layer-control";
import { addMapTools, type ToolLabels } from "@/components/map-tools";
import { useBasemap, useCameraMarkers, useFloodLayer, usePanToSelected, useRadarLayer, useRegionFit, useRoadMarkers, useSpotlightFit, useStationMarkers, viewPadding } from "@/components/map-hooks";
import type { MapCamera, MapHandle, MapRoad, MapStation } from "@/components/map-types";
import type { Dict, Lang } from "@/lib/i18n";
import { MAP_COOKIE, type MapStyle } from "@/lib/mapstyle";

export type { MapCamera, MapRoad, MapStation } from "@/components/map-types";

const toolLabels = (t: Dict): ToolLabels => ({
  locate: t.toolLocate,
  pin: t.toolPin,
  myLocation: t.toolMyLocation,
  locating: t.toolLocating,
  denied: t.toolDenied,
  unavailable: t.toolUnavailable,
  timeout: t.toolTimeout,
  pinHint: t.toolPinHint,
  pinTitle: t.toolPinTitle,
  nearest: t.toolNearest,
  noStation: t.toolNoStation,
  open: t.toolOpen,
  remove: t.toolRemove,
});

export function StationMap({
  stations,
  cameras,
  roads,
  roadsDefaultOn,
  selectedId,
  selectedCam,
  mapStyle,
  highlightIds,
  regionKey,
  floodDates,
  lang,
  t,
}: {
  stations: MapStation[];
  cameras: MapCamera[];
  roads: MapRoad[]; // flooded-road reports, already capped by the caller
  roadsDefaultOn: boolean;
  selectedId: number | null;
  selectedCam: string | null;
  mapStyle: MapStyle; // from the "map" cookie, read on the server
  highlightIds: number[]; // stations of the list group the user picked; the rest are dimmed
  regionKey: string; // the map refits when this changes
  floodDates: string[]; // newest first, computed on the server
  lang: Lang;
  t: Dict;
}) {
  const router = useRouter();
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapHandle | null>(null);
  const [ready, setReady] = useState(false);
  // The picker switches the basemap at once (optimistic) and refreshes the page so the server re-renders the theme.
  const [style, setStyle] = useOptimistic(mapStyle);
  const [, startTransition] = useTransition();
  const pickStyle = (v: MapStyle) =>
    startTransition(() => {
      setStyle(v);
      document.cookie = `${MAP_COOKIE}=${v}; path=/; max-age=31536000; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
      router.refresh();
    });
  const [zoom, setZoom] = useState(10);
  const [toolMsg, setToolMsg] = useState("");
  const live = useRef({ t, stations }); // latest props for the tools, which are created once
  const toolsRef = useRef<ReturnType<typeof addMapTools> | null>(null);
  const [radar, setRadar] = useState(false);
  const [flood, setFlood] = useState(false);
  const [cctv, setCctv] = useState(selectedCam != null);
  // The default follows the view (on in Bang Na), and a manual toggle holds until the view changes.
  const [roadsPick, setRoadsPick] = useState<{ region: string; on: boolean } | null>(null);
  const roadsOn = roadsPick?.region === regionKey ? roadsPick.on : roadsDefaultOn;
  const setRoadsOn = (on: boolean) => setRoadsPick({ region: regionKey, on });
  const [floodDate, setFloodDate] = useState(floodDates[0] ?? "");

  useEffect(() => {
    let dead = false;
    let ro: ResizeObserver | undefined;
    (async () => {
      // Leaflet touches `window` on import, so load it client-side only.
      const L = (await import("leaflet")).default;
      if (dead || !el.current) return;
      // Fullscreen map: wheel zoom is expected, and the zoom control moves out from under the floating UI.
      const map = L.map(el.current, { zoomControl: false }).setView([13.9, 100.5], 10);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapRef.current = { L, map, layer: L.layerGroup().addTo(map), camLayer: L.layerGroup().addTo(map), roadLayer: L.layerGroup().addTo(map) };
      // The container grows when streamed panels (e.g. forecast) land; Leaflet must re-measure.
      ro = new ResizeObserver(() => map.invalidateSize());
      ro.observe(el.current);
      map.on("zoomend", () => setZoom(map.getZoom()));
      setZoom(map.getZoom());
      setReady(true);
    })();
    return () => {
      dead = true;
      ro?.disconnect();
      mapRef.current?.map.remove();
      mapRef.current = null;
    };
  }, []);

  const open = useCallback((href: string) => router.push(href, { scroll: false }), [router]);
  useBasemap(mapRef, ready, style);
  useStationMarkers(mapRef, ready, { stations, selectedId, highlightIds, open });
  useCameraMarkers(mapRef, ready, { cctv, cameras, selectedCam, zoom, t, open });
  useRoadMarkers(mapRef, ready, { on: roadsOn, roads, t });
  useRegionFit(mapRef, ready, stations, regionKey);
  useSpotlightFit(mapRef, ready, stations, highlightIds);
  usePanToSelected(mapRef, ready, stations, selectedId);
  const radarLayer = useRadarLayer(mapRef, ready, radar, lang, t);
  useFloodLayer(mapRef, ready, flood, floodDate);

  useEffect(() => {
    live.current = { t, stations };
    toolsRef.current?.relabel();
  }, [t, stations]);

  // Locate-me and drop-a-pin, created once so a language switch does not lose the pin.
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    const tools = addMapTools(m.L, m.map, {
      labels: () => toolLabels(live.current.t),
      stations: () => live.current.stations.map((s) => ({ lat: s.lat, lon: s.lon, label: s.label, href: s.href })),
      fit: (b) => m.map.fitBounds(b, { ...viewPadding(), maxZoom: 16 }),
      open,
      say: setToolMsg,
    });
    toolsRef.current = tools;
    return () => {
      tools.remove();
      toolsRef.current = null;
    };
  }, [ready, router, open]);

  const hasCams = cameras.length > 0;
  return (
    <div className="absolute inset-0">
      <LayerControl
        radar={{ checked: radar, set: setRadar }}
        flood={{ checked: flood, set: setFlood }}
        cctv={{ checked: cctv, set: setCctv }}
        roads={{ checked: roadsOn, set: setRoadsOn }}
        hasCctv={hasCams}
        mapStyle={style}
        onMapStyle={pickStyle}
        radarSrc={radar ? radarLayer.src : null}
        floodDates={floodDates}
        floodDate={floodDate}
        setFloodDate={setFloodDate}
        lang={lang}
        message={[radar && radarLayer.msg, flood && `${t.floodAt} ${floodDate}`, cctv && hasCams && t.camCoverage, toolMsg].filter(Boolean).join(" · ")}
        t={t}
      />
      <div ref={el} role="region" aria-label={t.mapLabel} className="absolute inset-0 isolate z-0" />
    </div>
  );
}
