// Three base maps. "dark" also switches the floating UI to its dark theme (see app/globals.css).
export type MapStyle = "standard" | "satellite" | "dark";
export const MAP_STYLES: MapStyle[] = ["standard", "satellite", "dark"];
export const MAP_COOKIE = "map";

export function parseMapStyle(v: unknown): MapStyle {
  return v === "satellite" || v === "dark" ? v : "standard";
}

export type BaseLayer = { url: string; attribution: string; maxZoom: number; maxNativeZoom?: number; subdomains?: string; className?: string };

// Keyless tile servers, fine for a local PoC, each needing the attribution shown on the map:
//  - Esri World Imagery and Dark Gray Canvas (each with a labels layer): Esri's terms allow development use with
//    attribution; a public product needs a check.
//  - CARTO dark_all was tried first and dropped: it now answers 200 with an "API KEY REQUIRED" watermark tile, so a
//    status-code check passes while the map is unusable. Stadia answers 401. Always look at a tile, not its status.
// Layers are listed bottom first; the labels layer sits on top.
export const BASE_LAYERS: Record<MapStyle, BaseLayer[]> = {
  standard: [
    { url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 18, className: "basemap-muted" },
  ],
  satellite: [
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
      maxZoom: 19,
      maxNativeZoom: 18, // beyond this Esri returns a "data not yet available" tile
    },
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      attribution: "",
      maxZoom: 19,
      maxNativeZoom: 18,
    },
  ],
  dark: [
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      attribution: "Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community",
      maxZoom: 18,
      maxNativeZoom: 16, // the dark canvas stops at level 16
    },
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      attribution: "",
      maxZoom: 18,
      maxNativeZoom: 16,
    },
  ],
};
