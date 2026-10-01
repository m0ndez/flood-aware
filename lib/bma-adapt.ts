import { bmaStatus, type BmaStation } from "./bma-parse.ts";
import type { Reading, Station } from "./stations.ts";
import type { Status } from "./status.ts";

// BMA gauges ride the same list, map and verdict as the ThaiWater ones. Their ids are negative (the water_id negated),
// so they can never collide with a ThaiWater id and `?station=-43` is a shareable link like any other.
// A BMA mark is the canal's own operating level, not a bank: about a quarter of the stations in the area sit above it
// as a matter of course. So BMA never shows red and never counts as "over bank": amber is the most it can say.
export const BMA_PROVINCE_CODE = "bma";
export const BMA_GROUP = { th: "สถานีคลองและสถานีสูบน้ำของ กทม. (BMA)", en: "BMA canals and pumping stations" };
export const isBmaId = (id: number) => id < 0;
export const bmaId = (s: Pick<BmaStation, "id">) => -s.id;

export function bmaStation(s: BmaStation): Station {
  return {
    id: bmaId(s),
    code: `BMA${s.id}`,
    group: "province",
    region: "bangna",
    name: { th: s.nameTh, en: s.nameEn || s.nameTh },
    river: { th: "", en: "" },
    province: BMA_GROUP,
    provinceCode: BMA_PROVINCE_CODE,
    thaiOnly: !s.nameEn,
  };
}

const ict = (ms: number) => new Date(ms + 7 * 3600_000).toISOString().slice(0, 16).replace("T", " "); // "YYYY-MM-DD HH:MM", local Thai time

// bankM carries the warning mark (where amber starts), so the list's "margin" reads as margin to that mark.
export function bmaReading(s: BmaStation, status: Status): Reading {
  return { id: bmaId(s), lat: s.lat, lon: s.lon, levelMsl: s.level, datetime: ict(s.at), situation: status === "watch" ? 4 : 3, bankPct: null, bankM: s.warning ?? s.critical };
}

// critical is folded into watch: see above.
export function bmaUiStatus(s: BmaStation, now: number): Status {
  const st = bmaStatus(s, now);
  return st === "critical" ? "watch" : st;
}
