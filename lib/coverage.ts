import { distanceKm } from "./geo.ts";

// What a thin area really has, said out loud: gauges per province, how many of them are not updating, and how many
// sit near the place people mean. A sparse area must read as "little is monitored", never as "all clear".
export type CoverageItem = { province: string; lat: number; lon: number; stale: boolean };
export type Coverage = { provinces: { name: string; n: number; stale: number }[]; near: number };

export function coverageOf(items: CoverageItem[], center: { lat: number; lon: number }, radiusKm: number): Coverage {
  const by = new Map<string, { name: string; n: number; stale: number }>();
  let near = 0;
  for (const it of items) {
    const p = by.get(it.province) ?? { name: it.province, n: 0, stale: 0 };
    p.n++;
    if (it.stale) p.stale++;
    by.set(it.province, p);
    if (!it.stale && distanceKm(center.lat, center.lon, it.lat, it.lon) <= radiusKm) near++; // only working gauges count as covering
  }
  return { provinces: [...by.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)), near };
}
