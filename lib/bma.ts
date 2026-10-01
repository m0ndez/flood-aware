import { cacheLife } from "next/cache";
import { BMA_ENDPOINTS, firstWorking, type BmaSourceId } from "./bma-source.ts";
import { inArea, parseBma, selectBma, type BmaStation } from "./bma-parse.ts";

export type { BmaStation } from "./bma-parse.ts";
export type BmaResult = { stations: BmaStation[]; fetchedAt: number; source: BmaSourceId };

// Bangkok Metropolitan Administration canal, pump and gate levels. Undocumented but official and open (no auth).
// Credit "weather.bangkok.go.th" (BMA Drainage and Sewerage Department).
// An honest bot UA with a contact URL, like lib/news.ts.
const UA = "Mozilla/5.0 (compatible; FloodAwareBot/1.0; +https://github.com/m0ndez/flood-aware)";

async function fetchBma(): Promise<BmaResult> {
  "use cache: remote";
  cacheLife({ stale: 120, revalidate: 300, expire: 1800 });
  // The response is about 2 MB for the whole city. Only the trimmed area selection leaves this function, so the raw
  // body is never cached or returned. See lib/bma-source.ts for why there are two sources.
  const { value: all, source } = await firstWorking(
    BMA_ENDPOINTS,
    async (url) => {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { "user-agent": UA, accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    (json) => {
      const stations = parseBma(json);
      return stations.some((s) => inArea(s)) ? stations : null;
    },
  );
  const fetchedAt = Date.now();
  return { stations: selectBma(all, fetchedAt), fetchedAt, source };
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
