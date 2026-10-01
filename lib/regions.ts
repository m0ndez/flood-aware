// Which provinces belong to which view, and which of ThaiWater's ~800 gauges are worth showing.
// Codes are the standard Thai province codes (verified against the feed's geocode.province_code).
export type Region = "nonthaburi" | "central" | "eastern";
export const REGIONS: Region[] = ["nonthaburi", "central", "eastern"];

// Chao Phraya basin and the provinces around Bangkok.
const CENTRAL = new Set(["10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "73"]);
// Eastern provinces (Nakhon Nayok drains east, so it sits here).
const EASTERN = new Set(["20", "21", "22", "23", "24", "25", "26", "27"]);

export function regionOfProvince(code: string): "central" | "eastern" | null {
  return CENTRAL.has(code) ? "central" : EASTERN.has(code) ? "eastern" : null;
}

export type Candidate = { id: number; provinceCode: string; isKey: boolean; situation: number; fresh: boolean };

export const PER_PROVINCE = 4;
export const DERIVED_CAP = 70;

// Key stations, plus anything at watch (4) or over bank (5). Fresh data first, then key, then severity.
// Capped per province so one flooded province (Ayutthaya has 21 of 22 gauges high) cannot crowd out the rest,
// and overall so the map stays readable. Stations already in the hardcoded list are skipped.
export function pickDerived(cands: Candidate[], skip: Set<number>, perProvince = PER_PROVINCE, cap = DERIVED_CAP): number[] {
  const ranked = cands
    .filter((c) => !skip.has(c.id) && regionOfProvince(c.provinceCode) && (c.isKey || c.situation >= 4))
    .sort((a, b) => Number(b.fresh) - Number(a.fresh) || Number(b.isKey) - Number(a.isKey) || b.situation - a.situation || a.id - b.id);
  const perProv = new Map<string, number>();
  const out: number[] = [];
  for (const c of ranked) {
    const n = perProv.get(c.provinceCode) ?? 0;
    if (n >= perProvince) continue;
    perProv.set(c.provinceCode, n + 1);
    out.push(c.id);
    if (out.length >= cap) break;
  }
  return out;
}
