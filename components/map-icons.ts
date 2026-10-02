import { STATUS_STYLE, type Status } from "@/lib/status";
import type { Leaflet } from "@/components/map-types";

// "hl" is a station in the spotlighted list group: bigger, with a white halo and a blue ring.
export function stationIcon(L: Leaflet, status: Status, selected: boolean, hl = false) {
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
export function camIcon(L: Leaflet, selected: boolean) {
  const size = selected ? 34 : 26;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="4" fill="#1e293b" stroke="#fff" stroke-width="${selected ? 2 : 1.2}"/><path d="M5 8h3l1.5-2h5L16 8h3v9H5z" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="12.5" r="2.5" fill="none" stroke="#fff" stroke-width="1.5"/></svg>`,
  });
}

// Count badge: round, so it cannot be mistaken for a square camera badge or a status shape.
export function clusterIcon(L: Leaflet, n: number) {
  const size = n < 10 ? 34 : n < 100 ? 40 : 46;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px" class="grid place-items-center rounded-full border-2 border-white bg-slate-800 text-sm font-bold text-white shadow-lg">${n}</div>`,
  });
}

// Count badge for a group of flooded-road reports: square and amber with a dark outline, like the sign itself, so it
// cannot be mistaken for the round dark camera cluster.
export function roadClusterIcon(L: Leaflet, n: number) {
  const size = n < 10 ? 34 : n < 100 ? 40 : 46;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px" class="grid place-items-center rounded-md border-2 border-slate-900 bg-amber-400 text-sm font-bold text-slate-900 shadow-lg ring-2 ring-white">${n}</div>`,
  });
}

// Flooded-road report: amber road sign with a wave and a road bar, dark outline plus white halo so it holds on
// light, satellite and dark maps. Shape and glyph carry the meaning, not the amber alone.
export function roadIcon(L: Leaflet) {
  const size = 30;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" rx="2" fill="#fff"/><rect x="3" y="3" width="18" height="18" rx="1.5" fill="#fbbf24" stroke="#0f172a" stroke-width="2"/><path d="M5.5 10.5q1.6-2 3.2 0t3.2 0 3.2 0 3.2 0M5.5 14q1.6-2 3.2 0t3.2 0 3.2 0 3.2 0" fill="none" stroke="#0f172a" stroke-width="1.7" stroke-linecap="round"/><path d="M6 18.5h12" stroke="#0f172a" stroke-width="2" stroke-dasharray="3 2"/></svg>`,
  });
}
