"use client";

import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { LayerControl } from "@/components/layer-control";
import { addFlood } from "@/components/flood-layer";
import { addMapTools, type ToolLabels } from "@/components/map-tools";
import { addRadar } from "@/components/radar-layer";
import { addTmdRadar } from "@/components/tmd-radar-layer";
import { cluster } from "@/lib/cluster";
import { fmtTime, type Dict, type Lang } from "@/lib/i18n";
import { BASE_LAYERS, MAP_COOKIE, type MapStyle } from "@/lib/mapstyle";
import { STATUS_STYLE, type Status } from "@/lib/status";

export type MapStation = { id: number; lat: number; lon: number; status: Status; name: string; label: string; href: string };
export type MapCamera = { code: string; lat: number; lon: number; label: string; href: string };

type Leaflet = typeof import("leaflet");

// "hl" is a station in the spotlighted list group: bigger, with a white halo and a blue ring.
function icon(L: Leaflet, status: Status, selected: boolean, hl = false) {
  const { color, d } = STATUS_STYLE[status];
  const size = selected ? 40 : hl ? 40 : 30;
  const halo = hl ? '<circle cx="8" cy="8" r="11.5" fill="#fff" fill-opacity="0.92" stroke="#0369a1" stroke-width="1.6"/>' : "";
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<svg width="${size}" height="${size}" viewBox="${hl ? "-5 -5 26 26" : "-2 -2 20 20"}" aria-hidden="true">${halo}<path d="${d}" fill="${color}" fill-rule="evenodd" stroke="#fff" stroke-width="${selected ? 1.6 : 1}"/></svg>`,
  });
}

// Square badge with a camera glyph: a shape no status uses, so cameras never read as gauges.
function camIcon(L: Leaflet, selected: boolean) {
  const size = selected ? 34 : 26;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="4" fill="#1e293b" stroke="#fff" stroke-width="${selected ? 2 : 1.2}"/><path d="M5 8h3l1.5-2h5L16 8h3v9H5z" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="12.5" r="2.5" fill="none" stroke="#fff" stroke-width="1.5"/></svg>`,
  });
}

// Count badge: round, so it cannot be mistaken for a square camera badge or a status shape.
function clusterIcon(L: Leaflet, n: number) {
  const size = n < 10 ? 34 : n < 100 ? 40 : 46;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px" class="grid place-items-center rounded-full border-2 border-white bg-slate-800 text-sm font-bold text-white shadow-lg">${n}</div>`,
  });
}

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

// Keep markers clear of the floating card (desktop, left) or the bottom sheet (mobile, at half height).
function viewPadding() {
  return window.matchMedia("(min-width: 768px)").matches
    ? { paddingTopLeft: [450, 60] as [number, number], paddingBottomRight: [60, 40] as [number, number] }
    : { paddingTopLeft: [24, 64] as [number, number], paddingBottomRight: [24, Math.round(window.innerHeight * 0.5) + 16] as [number, number] };
}

export function StationMap({
  stations,
  cameras,
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
  const mapRef = useRef<{ L: Leaflet; map: LeafletMap; layer: LayerGroup; camLayer: LayerGroup } | null>(null);
  const fitted = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  // The picker switches the basemap at once (optimistic) and refreshes the page so the server re-renders the theme.
  const [style, setStyle] = useOptimistic(mapStyle);
  const [, startTransition] = useTransition();
  const pickStyle = (v: MapStyle) =>
    startTransition(() => {
      setStyle(v);
      document.cookie = `${MAP_COOKIE}=${v}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    });
  const [zoom, setZoom] = useState(10);
  const [toolMsg, setToolMsg] = useState("");
  const live = useRef({ t, stations }); // latest props for the tools, which are created once
  const toolsRef = useRef<ReturnType<typeof addMapTools> | null>(null);
  const [radar, setRadar] = useState(false);
  const [flood, setFlood] = useState(false);
  const [cctv, setCctv] = useState(selectedCam != null);
  const [radarMsg, setRadarMsg] = useState("");
  const [radarSrc, setRadarSrc] = useState<"tmd" | "rainviewer" | null>(null);
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
      mapRef.current = { L, map, layer: L.layerGroup().addTo(map), camLayer: L.layerGroup().addTo(map) };
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
      fitted.current = null;
      mapRef.current?.map.remove();
      mapRef.current = null;
    };
  }, []);

  // Basemap. Added at the back so radar, flood and markers always stay on top after a switch.
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    const layers = BASE_LAYERS[style].map((d) =>
      m.L.tileLayer(d.url, { attribution: d.attribution, maxZoom: d.maxZoom, maxNativeZoom: d.maxNativeZoom, className: d.className, ...(d.subdomains ? { subdomains: d.subdomains } : {}) }).addTo(m.map),
    );
    [...layers].reverse().forEach((l) => l.bringToBack()); // first layer ends lowest, labels above imagery
    return () => layers.forEach((l) => l.remove());
  }, [ready, style]);

  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    m.layer.clearLayers();
    const hl = new Set(highlightIds);
    for (const s of stations) {
      const spot = hl.has(s.id);
      const marker = m.L.marker([s.lat, s.lon], {
        icon: icon(m.L, s.status, s.id === selectedId, spot),
        title: s.label,
        alt: s.label,
        opacity: hl.size === 0 || spot || s.id === selectedId ? 1 : 0.35, // dimmed, but still clickable
        zIndexOffset: s.id === selectedId ? 1000 : spot ? 500 : 0,
      })
        .on("click", () => router.push(s.href, { scroll: false }))
        .addTo(m.layer);
      // Markers are unlabelled, so the open station carries its name: no matching shapes against the list.
      if (s.id === selectedId) marker.bindTooltip(s.name, { permanent: true, direction: "top", offset: [0, -22], className: "station-name" });
    }
  }, [ready, stations, selectedId, highlightIds, router]);

  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    m.camLayer.clearLayers();
    if (!cctv) return;
    const marker = (c: MapCamera) =>
      m.L.marker([c.lat, c.lon], {
        icon: camIcon(m.L, c.code === selectedCam),
        title: c.label,
        alt: c.label,
        zIndexOffset: c.code === selectedCam ? 900 : 500,
      })
        .on("click", () => router.push(c.href, { scroll: false })) // the card shows the frames
        .addTo(m.camLayer);
    const sel = cameras.find((c) => c.code === selectedCam); // the open camera is never swallowed by a cluster
    for (const g of cluster(cameras.filter((c) => c !== sel), zoom)) {
      if (g.items.length === 1) {
        marker(g.items[0]);
        continue;
      }
      const label = t.camCluster.replace("{n}", String(g.items.length));
      m.L.marker([g.lat, g.lon], { icon: clusterIcon(m.L, g.items.length), title: label, alt: label, zIndexOffset: 600 })
        .on("click", () => m.map.fitBounds(g.items.map((i) => [i.lat, i.lon] as [number, number]), { ...viewPadding(), maxZoom: 17 }))
        .addTo(m.camLayer);
    }
    if (sel) marker(sel);
  }, [ready, cctv, cameras, selectedCam, zoom, router, t]);

  // Fit once per region; selecting stations inside it keeps the user's zoom.
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m || fitted.current === regionKey || stations.length === 0) return;
    fitted.current = regionKey;
    m.map.invalidateSize();
    m.map.fitBounds(stations.map((s) => [s.lat, s.lon] as [number, number]), viewPadding());
  }, [ready, stations, regionKey]);

  // Spotlighting a group zooms to it; clearing it returns to the whole region. Reads the latest props via a ref
  // so only a change of the highlighted set (not every re-render) moves the map.
  const latest = useRef({ stations, highlightIds });
  const hlKey = highlightIds.join(",");
  const hadHl = useRef(false);
  useEffect(() => {
    latest.current = { stations, highlightIds };
  });
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    const { stations: all, highlightIds: ids } = latest.current;
    const pts = all.filter((s) => ids.includes(s.id)).map((s) => [s.lat, s.lon] as [number, number]);
    if (pts.length > 0) m.map.fitBounds(pts, { ...viewPadding(), maxZoom: 14 }); // maxZoom: one station should not zoom to street level
    else if (hadHl.current && all.length > 0) m.map.fitBounds(all.map((s) => [s.lat, s.lon] as [number, number]), viewPadding());
    hadHl.current = pts.length > 0;
  }, [ready, hlKey]);

  // A station picked from the list may sit under the card; pan only as far as needed.
  useEffect(() => {
    const m = mapRef.current;
    const s = stations.find((x) => x.id === selectedId);
    if (!ready || !m || !s) return;
    // Zoomed out over the region: go to the station. Already close: just nudge it clear of the card or sheet.
    if (m.map.getZoom() < 11) m.map.fitBounds([[s.lat, s.lon]], { ...viewPadding(), maxZoom: 12 });
    else m.map.panInside([s.lat, s.lon], viewPadding());
  }, [ready, stations, selectedId]);

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
      open: (href) => router.push(href, { scroll: false }),
      say: setToolMsg,
    });
    toolsRef.current = tools;
    return () => {
      tools.remove();
      toolsRef.current = null;
    };
  }, [ready, router]);

  // TMD radar first (real coverage of Thailand); RainViewer only if TMD fails.
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m || !radar) return;
    let dead = false;
    let layer: { remove(): unknown } | undefined;
    (async () => {
      try {
        const r = await addTmdRadar(m.L, m.map);
        if (dead) return void r.layer.remove();
        layer = r.layer;
        setRadarSrc("tmd");
        setRadarMsg(`${t.radarAt} ${fmtTime(r.time, lang)}${r.echoes ? "" : ` · ${t.radarNoEcho}`}`);
      } catch {
        try {
          const r = await addRadar(m.L, m.map);
          if (dead) return void r.layer.remove();
          layer = r.layer;
          setRadarSrc("rainviewer");
          setRadarMsg(`${t.radarFallback} · ${t.radarAt} ${fmtTime(r.time, lang)}`);
        } catch {
          if (!dead) {
            setRadarSrc(null);
            setRadarMsg(t.radarFail);
          }
        }
      }
    })();
    return () => {
      dead = true;
      layer?.remove();
    };
  }, [ready, radar, lang, t]);

  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m || !flood || !floodDate) return;
    const layer = addFlood(m.L, m.map, floodDate);
    return () => void layer.remove();
  }, [ready, flood, floodDate]);

  const hasCams = cameras.length > 0;
  return (
    <div className="absolute inset-0">
      <LayerControl
        radar={{ checked: radar, set: setRadar }}
        flood={{ checked: flood, set: setFlood }}
        cctv={{ checked: cctv, set: setCctv }}
        hasCctv={hasCams}
        mapStyle={style}
        onMapStyle={pickStyle}
        radarSrc={radar ? radarSrc : null}
        floodDates={floodDates}
        floodDate={floodDate}
        setFloodDate={setFloodDate}
        lang={lang}
        message={[radar && radarMsg, flood && `${t.floodAt} ${floodDate}`, cctv && hasCams && t.camCoverage, toolMsg].filter(Boolean).join(" · ")}
        t={t}
      />
      <div ref={el} role="region" aria-label={t.mapLabel} className="absolute inset-0 isolate z-0" />
    </div>
  );
}
