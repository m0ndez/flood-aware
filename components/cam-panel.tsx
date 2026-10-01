import Link from "next/link";
import { CamFrame } from "@/components/cam-frame";
import { CamVideo } from "@/components/cam-video";
import type { Dict, Lang } from "@/lib/i18n";
import type { Camera } from "@/lib/cctv";

export function CamPanel({ cam, closeHref, lang, t }: { cam: Camera; closeHref: string; lang: Lang; t: Dict }) {
  const credit = { muni: t.camSourceMuni, pakkret: t.camSourcePakkret, doh: t.camSourceDoh }[cam.source];
  const rate = { muni: t.camRateMuni, pakkret: t.camRatePakkret, doh: t.camRateDoh }[cam.source];
  const gapMs = { muni: 500, pakkret: 800, doh: 0 }[cam.source]; // muni is usually slow enough to throttle itself, but when it answers fast, stay at 2 requests/s at most
  return (
    <section id="cam" aria-labelledby="cam-h" className="mb-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-800/70 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 id="cam-h" tabIndex={-1} data-autofocus className="outline-none text-base font-bold">{t.camTitle} · {cam.source === "doh" ? "" : `${cam.code} `}{cam.name}</h2>
        <Link href={closeHref} scroll={false} className="flex shrink-0 items-center rounded border border-slate-400 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-500 dark:hover:bg-slate-700 max-md:min-h-11">{t.close}</Link>
      </div>
      <div className="flex flex-col gap-4">
        {cam.hls ? (
          <CamVideo key={cam.code} src={cam.hls} label={cam.labels[0]} t={t} />
        ) : (
          cam.cams.map((_, i) => <CamFrame key={`${cam.code}/${i}`} code={cam.code} n={i} label={cam.labels[i]} gapMs={gapMs} lang={lang} t={t} />)
        )}
      </div>
      <p className="mt-3 text-xs text-slate-700 dark:text-slate-300">{rate}</p>
      <p className="text-xs text-slate-700 dark:text-slate-300">{credit}</p>
    </section>
  );
}
