import { loadRainNear } from "@/lib/thaiwater";
import { isStale } from "@/lib/status";
import type { Dict, Lang } from "@/lib/i18n";

// Streams in on its own: the national rain feed is large, so an opened station never waits for it.
export async function RainBox({ lat, lon, now, failed, lang, t }: { lat: number; lon: number; now: number; failed: boolean; lang: Lang; t: Dict }) {
  const rain = await loadRainNear(lat, lon);
  if (!rain) return <p className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">{t.rainUnavailable}</p>; // never shown as 0 mm
  const stale = failed || isStale(rain.datetime, now);
  return (
    <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
      <p className="font-semibold">{t.rainFrom}: {rain.name[lang]} ({rain.km.toFixed(1)} km)</p>
      {stale ? (
        <p>{t.status.stale}</p>
      ) : (
        <dl className="mt-1 grid grid-cols-2 gap-x-4">
          <div>
            <dt className="text-xs text-slate-600 dark:text-slate-400">{t.rain24}</dt>
            <dd className="text-base font-semibold tabular-nums">{rain.h24.toFixed(1)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-600 dark:text-slate-400">{t.rain1}</dt>
            <dd className="text-base font-semibold tabular-nums">{rain.h1 != null ? rain.h1.toFixed(1) : "–"}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
