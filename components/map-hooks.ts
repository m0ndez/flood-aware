import { useEffect, useRef, useState } from "react";
import { addFlood } from "@/components/flood-layer";
import { camIcon, clusterIcon, roadIcon, stationIcon } from "@/components/map-icons";
import type { MapCamera, MapRef, MapRoad, MapStation } from "@/components/map-types";
import { addRadar } from "@/components/radar-layer";
import { addTmdRadar } from "@/components/tmd-radar-layer";
import { cluster } from "@/lib/cluster";
import { fmtTime, type Dict, type Lang } from "@/lib/i18n";
import { BASE_LAYERS, type MapStyle } from "@/lib/mapstyle";

// One hook per map concern. Each reads the Leaflet handle from the ref inside its effect (the handle only exists
// after the init effect has loaded Leaflet), and each cleans up exactly what it added.

// Keep markers clear of the floating card (desktop, left) or the bottom sheet (mobile, at half height).
export function viewPadding() {
  return window.matchMedia("(min-width: 768px)").matches
    ? { paddingTopLeft: [450, 60] as [number, number], paddingBottomRight: [60, 40] as [number, number] }
    : { paddingTopLeft: [24, 64] as [number, number], paddingBottomRight: [24, Math.round(window.innerHeight * 0.5) + 16] as [number, number] };
}

// Basemap. Added at the back so radar, flood and markers always stay on top after a switch.
export function useBasemap(mapRef: MapRef, ready: boolean, style: MapStyle) {
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    const layers = BASE_LAYERS[style].map((d) =>
      m.L.tileLayer(d.url, { attribution: d.attribution, maxZoom: d.maxZoom, maxNativeZoom: d.maxNativeZoom, className: d.className, ...(d.subdomains ? { subdomains: d.subdomains } : {}) }).addTo(m.map),
    );
    [...layers].reverse().forEach((l) => l.bringToBack()); // first layer ends lowest, labels above imagery
    return () => layers.forEach((l) => l.remove());
  }, [mapRef, ready, style]);
}

export function useStationMarkers(mapRef: MapRef, ready: boolean, o: { stations: MapStation[]; selectedId: number | null; highlightIds: number[]; open: (href: string) => void }) {
  const { stations, selectedId, highlightIds, open } = o;
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    m.layer.clearLayers();
    const hl = new Set(highlightIds);
    for (const s of stations) {
      const spot = hl.has(s.id);
      const marker = m.L.marker([s.lat, s.lon], {
        icon: stationIcon(m.L, s.status, s.id === selectedId, spot),
        title: s.label,
        alt: s.label,
        opacity: hl.size === 0 || spot || s.id === selectedId ? 1 : 0.35, // dimmed, but still clickable
        zIndexOffset: s.id === selectedId ? 1000 : spot ? 500 : 0,
      })
        .on("click", () => open(s.href))
        .addTo(m.layer);
      // Markers are unlabelled, so the open station carries its name: no matching shapes against the list.
      if (s.id === selectedId) marker.bindTooltip(s.name, { permanent: true, direction: "top", offset: [0, -22], className: "station-name" });
    }
  }, [mapRef, ready, stations, selectedId, highlightIds, open]);
}

export function useCameraMarkers(mapRef: MapRef, ready: boolean, o: { cctv: boolean; cameras: MapCamera[]; selectedCam: string | null; zoom: number; t: Dict; open: (href: string) => void }) {
  const { cctv, cameras, selectedCam, zoom, t, open } = o;
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
        .on("click", () => open(c.href)) // the card shows the frames
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
  }, [mapRef, ready, cctv, cameras, selectedCam, zoom, t, open]);
}

// Flooded-road reports. Text is untrusted, so the popup is built from DOM nodes (textContent), never HTML strings.
export function useRoadMarkers(mapRef: MapRef, ready: boolean, o: { on: boolean; roads: MapRoad[]; t: Dict }) {
  const { on, roads, t } = o;
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m) return;
    m.roadLayer.clearLayers();
    if (!on) return;
    const line = (tag: string, text: string, cls: string) => {
      const e = document.createElement(tag);
      e.className = cls;
      e.textContent = text;
      return e;
    };
    for (const r of roads) {
      const body = document.createElement("div");
      body.className = "max-w-60 text-sm text-slate-900";
      body.append(
        line("p", r.title, "font-semibold leading-snug"),
        ...(r.place ? [line("p", r.place, "mt-0.5 text-xs text-slate-700")] : []),
        line("p", `${r.sourceLabel} · ${r.ageText}`, "mt-1 text-xs text-slate-700"),
        line("p", t.roads.caveat, "mt-1 text-xs italic text-slate-700"),
      );
      m.L.marker([r.lat, r.lon], { icon: roadIcon(m.L), title: r.title, alt: r.title, zIndexOffset: 700 })
        .bindPopup(body, { autoPanPadding: [24, 80] })
        .addTo(m.roadLayer);
    }
    return () => void m.roadLayer.clearLayers();
  }, [mapRef, ready, on, roads, t]);
}

// Fit once per region (and once per map instance); selecting stations inside it keeps the user's zoom.
export function useRegionFit(mapRef: MapRef, ready: boolean, stations: MapStation[], regionKey: string) {
  const fitted = useRef<{ map: unknown; region: string } | null>(null);
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m || stations.length === 0) return;
    if (fitted.current?.map === m.map && fitted.current.region === regionKey) return;
    fitted.current = { map: m.map, region: regionKey };
    m.map.invalidateSize();
    m.map.fitBounds(stations.map((s) => [s.lat, s.lon] as [number, number]), viewPadding());
  }, [mapRef, ready, stations, regionKey]);
}

// Spotlighting a group zooms to it; clearing it returns to the whole region. Reads the latest props via a ref
// so only a change of the highlighted set (not every re-render) moves the map.
export function useSpotlightFit(mapRef: MapRef, ready: boolean, stations: MapStation[], highlightIds: number[]) {
  const latest = useRef({ stations, highlightIds });
  const hadHl = useRef(false);
  const hlKey = highlightIds.join(",");
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
  }, [mapRef, ready, hlKey]);
}

// A station picked from the list may sit under the card; pan only as far as needed.
export function usePanToSelected(mapRef: MapRef, ready: boolean, stations: MapStation[], selectedId: number | null) {
  useEffect(() => {
    const m = mapRef.current;
    const s = stations.find((x) => x.id === selectedId);
    if (!ready || !m || !s) return;
    // Zoomed out over the region: go to the station. Already close: just nudge it clear of the card or sheet.
    if (m.map.getZoom() < 11) m.map.fitBounds([[s.lat, s.lon]], { ...viewPadding(), maxZoom: 12 });
    else m.map.panInside([s.lat, s.lon], viewPadding());
  }, [mapRef, ready, stations, selectedId]);
}

// TMD radar first (real coverage of Thailand); RainViewer only if TMD fails. Returns the status line and the source.
export function useRadarLayer(mapRef: MapRef, ready: boolean, enabled: boolean, lang: Lang, t: Dict) {
  const [msg, setMsg] = useState("");
  const [src, setSrc] = useState<"tmd" | "rainviewer" | null>(null);
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m || !enabled) return;
    let dead = false;
    let layer: { remove(): unknown } | undefined;
    (async () => {
      try {
        const r = await addTmdRadar(m.L, m.map);
        if (dead) return void r.layer.remove();
        layer = r.layer;
        setSrc("tmd");
        setMsg(`${t.radarAt} ${fmtTime(r.time, lang)}${r.echoes ? "" : ` · ${t.radarNoEcho}`}`);
      } catch {
        try {
          const r = await addRadar(m.L, m.map);
          if (dead) return void r.layer.remove();
          layer = r.layer;
          setSrc("rainviewer");
          setMsg(`${t.radarFallback} · ${t.radarAt} ${fmtTime(r.time, lang)}`);
        } catch {
          if (!dead) {
            setSrc(null);
            setMsg(t.radarFail);
          }
        }
      }
    })();
    return () => {
      dead = true;
      layer?.remove();
    };
  }, [mapRef, ready, enabled, lang, t]);
  return { msg, src };
}

export function useFloodLayer(mapRef: MapRef, ready: boolean, enabled: boolean, date: string) {
  useEffect(() => {
    const m = mapRef.current;
    if (!ready || !m || !enabled || !date) return;
    const layer = addFlood(m.L, m.map, date);
    return () => void layer.remove();
  }, [mapRef, ready, enabled, date]);
}
