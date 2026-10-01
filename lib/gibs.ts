// NASA GIBS flood layer: keyless, daily, about 250 m. Regional scale, not street level.
// Measured over Nonthaburi: the 1-Day layer is clearer than the 3-Day composite, and today's date
// is mostly unprocessed, so offer yesterday and the two days before.
export const FLOOD_LAYER = "MODIS_Combined_Flood_1-Day";

export function floodTemplate(date: string): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${FLOOD_LAYER}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`;
}

export const FLOOD_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Latest first: yesterday, then back two more UTC days.
export function floodDates(nowMs: number): string[] {
  return [1, 2, 3].map((d) => new Date(nowMs - d * 86_400_000).toISOString().slice(0, 10));
}

// GIBS colormap MODIS_Flood.xml. Grey (cloud) is shown in the legend on purpose: it is most of the picture in monsoon.
export const FLOOD_CLASSES = [
  { key: "flood", color: "#fa1e24" },
  { key: "recurring", color: "#ffff00" },
  { key: "water", color: "#32d2f5" },
  { key: "cloud", color: "#afafaf" },
] as const;
