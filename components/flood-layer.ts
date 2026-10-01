import type { Map as LeafletMap, TileLayer } from "leaflet";
import { FLOOD_DATE_RE, floodTemplate } from "@/lib/gibs";

type Leaflet = typeof import("leaflet");

// NASA GIBS MODIS flood tiles for one UTC day. Regional scale (about 250 m), cloud shows as grey.
export function addFlood(L: Leaflet, map: LeafletMap, date: string): TileLayer {
  if (!FLOOD_DATE_RE.test(date)) throw new Error("bad flood date");
  return L.tileLayer(floodTemplate(date), {
    opacity: 0.75,
    maxNativeZoom: 9, // GoogleMapsCompatible_Level9
    maxZoom: 18,
    attribution: 'Flood: <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a> / MODIS',
  }).addTo(map);
}
