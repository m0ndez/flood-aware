import { cacheLife } from "next/cache";
import { inArea, parseBma, selectBma, type BmaStation } from "./bma-parse.ts";

export type { BmaStation } from "./bma-parse.ts";
export type BmaResult = { stations: BmaStation[]; fetchedAt: number };

// Bangkok Metropolitan Administration canal, pump and gate levels. Undocumented but official and open (no auth).
// Credit "weather.bangkok.go.th" (BMA Drainage and Sewerage Department).
const ENDPOINT = "https://weather.bangkok.go.th/Klongmap/GetDataForUpdate";
// An honest bot UA with a contact URL, like lib/news.ts.
const UA = "Mozilla/5.0 (compatible; FloodAwareBot/1.0; +https://github.com/m0ndez/flood-aware)";

async function fetchBma(): Promise<BmaResult> {
  "use cache: remote";
  cacheLife({ stale: 120, revalidate: 300, expire: 1800 });
  const res = await fetch(ENDPOINT, { signal: AbortSignal.timeout(15_000), headers: { "user-agent": UA, accept: "application/json" } });
  if (!res.ok) throw new Error(`BMA klongmap: HTTP ${res.status}`);
  // The response is about 2 MB for the whole city. Only the trimmed area selection leaves this function, so the raw
  // body is never cached or returned.
  const all = parseBma(await res.json());
  if (!all.some((s) => inArea(s))) throw new Error("BMA klongmap: no stations in area");
  const fetchedAt = Date.now();
  return { stations: selectBma(all, fetchedAt), fetchedAt };
}

// null = could not check; the UI must say so instead of implying "all clear".
export async function loadBma(): Promise<BmaResult | null> {
  try {
    return await fetchBma();
  } catch (e) {
    console.error("BMA fetch failed", e);
    return null;
  }
}
