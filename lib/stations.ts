import type { Region } from "./regions.ts";

// "province" groups the derived Central/Eastern stations by their province instead of by role.
export type Group = "nonthaburi" | "upstream" | "downstream" | "nearby" | "province";
export type Bi = { th: string; en: string };
export type Station = {
  id: number;
  code: string;
  group: Group;
  region: Region;
  name: Bi;
  river: Bi; // empty strings when the feed has no river name
  province?: Bi; // set on derived stations
  provinceCode?: string; // set on derived stations; also their list/map group key
  thaiOnly?: boolean; // derived station whose feed entry has no English name
};

// The hand-picked Nonthaburi set, with English names. Everything else is derived from the feed (see parseOverview).
type Core = Omit<Station, "region">;
const CORE: Core[] = [
  { id: 26, code: "CPY014", group: "nonthaburi", name: { th: "สะพานนวลฉวี (ปากเกร็ด)", en: "Nuan Chawee Bridge (Pak Kret)" }, river: { th: "แม่น้ำเจ้าพระยา", en: "Chao Phraya River" } },
  { id: 24, code: "BKK018", group: "nonthaburi", name: { th: "คลองพระพิมล (ไทรน้อย)", en: "Khlong Phra Phimon (Sai Noi)" }, river: { th: "คลองพระพิมล", en: "Khlong Phra Phimon" } },
  { id: 49, code: "CPY012", group: "upstream", name: { th: "บางปะอิน", en: "Bang Pa-in" }, river: { th: "แม่น้ำเจ้าพระยา", en: "Chao Phraya River" } },
  { id: 39, code: "CPY011", group: "upstream", name: { th: "พระนครศรีอยุธยา", en: "Ayutthaya" }, river: { th: "แม่น้ำเจ้าพระยา", en: "Chao Phraya River" } },
  { id: 2609, code: "C.35", group: "upstream", name: { th: "บ้านป้อม", en: "Ban Pom" }, river: { th: "แม่น้ำเจ้าพระยา", en: "Chao Phraya River" } },
  { id: 2599, code: "C.12", group: "downstream", name: { th: "สามเสน", en: "Sam Sen" }, river: { th: "แม่น้ำเจ้าพระยา", en: "Chao Phraya River" } },
  { id: 4, code: "CPY015", group: "downstream", name: { th: "สะพานกรุงเทพ", en: "Krung Thep Bridge" }, river: { th: "แม่น้ำเจ้าพระยา", en: "Chao Phraya River" } },
  // Nearby klongs (Pathum Thani, Bangkok, Nakhon Pathom). Several already read over bank in the feed.
  { id: 1, code: "BKK021", group: "nearby", name: { th: "คลองลาดพร้าว วัดบางบัว", en: "Khlong Lat Phrao (Wat Bang Bua)" }, river: { th: "คลองบางบัว", en: "Khlong Bang Bua" } },
  { id: 11, code: "BKK001", group: "nearby", name: { th: "คลองลาดพร้าว ท้ายปตร.คลอง 2", en: "Khlong Lat Phrao (below Khlong 2 sluice)" }, river: { th: "คลองหกวา", en: "Khlong Hok Wa" } },
  { id: 8, code: "BKK020", group: "nearby", name: { th: "คลองลาดพร้าว ปากคลอง 2 สายใต้", en: "Khlong Lat Phrao (Khlong 2 South mouth)" }, river: { th: "คลองหกวา", en: "Khlong Hok Wa" } },
  { id: 27, code: "BKK002", group: "nearby", name: { th: "คลองเปรมประชากร หลักหก", en: "Khlong Prem Prachakon (Lak Hok)" }, river: { th: "คลองเปรมประชากร", en: "Khlong Prem Prachakon" } },
  { id: 5, code: "BKK003", group: "nearby", name: { th: "คลองมหาสวัสดิ์ (บางกรวย-สวนผัก)", en: "Khlong Mahasawat (Bang Kruai-Suan Phak)" }, river: { th: "คลองมหาสวัสดิ์", en: "Khlong Mahasawat" } },
  { id: 747, code: "BKK019", group: "nearby", name: { th: "คลองนราภิรมย์ (บางเลน)", en: "Khlong Nara Phirom (Bang Len)" }, river: { th: "คลองนราภิรมย์", en: "Khlong Nara Phirom" } },
  { id: 749, code: "VLGE20", group: "nearby", name: { th: "ศาลาดิน", en: "Sala Din" }, river: { th: "คลองหม่อมเจ้าเฉลิมศรี", en: "Khlong Mom Chao Chaloemsi" } },
];
export const CORE_STATIONS: Station[] = CORE.map((c) => ({ ...c, region: "nonthaburi" as const }));
export const DEFAULT_STATION = 26;

export type Rain = { name: Bi; km: number; h24: number; h1: number | null; datetime: string };
export type Reading = {
  id: number;
  lat: number;
  lon: number;
  levelMsl: number;
  datetime: string;
  situation: number; // ThaiWater situation_level 1-5
  bankPct: number | null; // % of bank capacity
  bankM: number | null; // min bank level, m MSL
};
export type Overview = { fetchedAt: number; readings: Reading[]; stations: Station[] };
export type Point = { t: string; v: number };
export type Graph = { points: Point[]; bankM: number | null };
