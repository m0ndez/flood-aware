// Which provinces belong to which view, and which of ThaiWater's ~800 gauges are worth showing.
// Codes are the standard Thai province codes (verified against the feed's geocode.province_code).
export type Region = "nonthaburi" | "bangna" | "central" | "eastern";
export const REGIONS: Region[] = ["nonthaburi", "bangna", "central", "eastern"];

// Chao Phraya basin and the provinces around Bangkok (Samut Prakan, 11, and east Bangkok belong to "bangna").
const CENTRAL = new Set(["10", "12", "13", "14", "15", "16", "17", "18", "19", "73"]);
// Eastern provinces (Nakhon Nayok drains east, so it sits here).
const EASTERN = new Set(["20", "21", "22", "23", "24", "25", "26", "27"]);

// Bang Na and Samut Prakan: all of Samut Prakan, plus the Bangkok districts east and south of the river (Bang Na,
// Phra Khanong, Prawet, Lat Krabang). The box edge is a judgement call, not an administrative boundary.
export const BANGNA_BOX = { south: 13.5, north: 13.8, west: 100.52, east: 100.95 };
// Where each view looks for flooded-road reports. Rough boxes around the views, not boundaries.
export type Box = { south: number; north: number; west: number; east: number };
export const REGION_BOX: Record<Region, Box> = {
  nonthaburi: { south: 13.6, north: 14.2, west: 100.2, east: 100.8 },
  bangna: BANGNA_BOX,
  central: { south: 12.9, north: 16.3, west: 99.3, east: 101.4 },
  eastern: { south: 11.9, north: 14.6, west: 100.9, east: 103.3 },
};

export const BANGNA_CENTER = { lat: 13.668, lon: 100.605 };
const inBangnaBox = (lat: number, lon: number) => lat >= BANGNA_BOX.south && lat <= BANGNA_BOX.north && lon >= BANGNA_BOX.west && lon <= BANGNA_BOX.east;

export function regionOf(provinceCode: string, lat: number, lon: number): "bangna" | "central" | "eastern" | null {
  if (provinceCode === "11" || (provinceCode === "10" && inBangnaBox(lat, lon))) return "bangna";
  return CENTRAL.has(provinceCode) ? "central" : EASTERN.has(provinceCode) ? "eastern" : null;
}

export type Candidate = { id: number; provinceCode: string; lat: number; lon: number; isKey: boolean; situation: number; fresh: boolean };

export const PER_PROVINCE = 4;
export const DERIVED_CAP = 70;

// Key stations, plus anything at watch (4) or over bank (5). Fresh data first, then key, then severity.
// Capped per province so one flooded province (Ayutthaya has 21 of 22 gauges high) cannot crowd out the rest,
// and overall so the map stays readable. Stations already in the hardcoded list are skipped.
export function pickDerived(cands: Candidate[], skip: Set<number>, perProvince = PER_PROVINCE, cap = DERIVED_CAP): number[] {
  const ranked = cands
    .filter((c) => !skip.has(c.id) && regionOf(c.provinceCode, c.lat, c.lon) && (c.isKey || c.situation >= 4))
    .sort((a, b) => Number(b.fresh) - Number(a.fresh) || Number(b.isKey) - Number(a.isKey) || b.situation - a.situation || a.id - b.id);
  const perProv = new Map<string, number>();
  const out: number[] = [];
  for (const c of ranked) {
    const key = `${regionOf(c.provinceCode, c.lat, c.lon)}:${c.provinceCode}`; // Bangkok is split between two views
    const n = perProv.get(key) ?? 0;
    if (n >= perProvince) continue;
    perProv.set(key, n + 1);
    out.push(c.id);
    if (out.length >= cap) break;
  }
  return out;
}
