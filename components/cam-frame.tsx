"use client";

import { useEffect, useRef, useState } from "react";
import { withTimeout } from "@/lib/abort";
import { fmtClock, type Dict, type Lang } from "@/lib/i18n";

// These sources only serve still frames (the municipal Milestone service has no video operation at all),
// so "live" means polling them back to back: about 1 fps for Pak Kret, one frame per 10-20 s for Mueang.
// ponytail: stops after 10 minutes and while the tab is hidden, to spare small public servers.
// Real video needs a stream URL (RTSP/HLS) from the owners.
const MAX_SESSION_MS = 10 * 60_000;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(id), resolve()), { once: true });
  });

export function CamFrame({ code, n, label, gapMs, lang, t }: { code: string; n: number; label: string; gapMs: number; lang: Lang; t: Dict }) {
  const [playing, setPlaying] = useState(true);
  const [frame, setFrame] = useState<{ src: string; at: number } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const url = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );

  useEffect(() => {
    if (!playing) return;
    const ctl = new AbortController();
    const deadline = performance.now() + MAX_SESSION_MS;
    (async () => {
      let fails = 0;
      while (!ctl.signal.aborted) {
        if (document.visibilityState === "hidden") {
          await sleep(1000, ctl.signal);
          continue;
        }
        if (performance.now() > deadline) return void setPlaying(false);
        const req = withTimeout(35_000, ctl.signal);
        try {
          // No cache option: the route sends max-age=0, so the browser revalidates every poll while the CDN shares frames.
          const res = await fetch(`/api/cam/${encodeURIComponent(code)}/${n}`, { signal: req.signal });
          if (!res.ok) throw new Error(String(res.status));
          const blob = await res.blob();
          if (ctl.signal.aborted) return;
          const next = URL.createObjectURL(blob);
          // Decode off-screen first, so the swap is instant and never flashes a half-painted frame.
          await Object.assign(new Image(), { src: next }).decode().catch(() => {});
          if (ctl.signal.aborted) return void URL.revokeObjectURL(next);
          const prev = url.current;
          url.current = next;
          setFrame({ src: next, at: Number(res.headers.get("x-frame-at")) || Date.now() });
          setRetrying(false);
          if (prev) URL.revokeObjectURL(prev);
          fails = 0;
          await sleep(gapMs, ctl.signal);
        } catch {
          if (ctl.signal.aborted) return;
          setRetrying(true); // keep the last frame on screen and say it is stale
          await sleep(Math.min(2000 * ++fails, 10_000), ctl.signal);
        } finally {
          req.done();
        }
      }
    })();
    return () => ctl.abort();
  }, [playing, code, n, gapMs]);

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-semibold">{label}</figcaption>
      {frame ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob URL from our own proxy, next/image can't optimise it
        <img src={frame.src} alt={label} width={800} height={450} className="w-full rounded border border-slate-300 dark:border-slate-600" />
      ) : (
        <div className="grid aspect-video w-full place-items-center rounded border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 text-center text-sm text-slate-600 dark:text-slate-400">
          {playing ? t.camLoading : t.camPaused}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-pressed={playing}
          className="rounded border border-slate-500 px-3 py-1.5 font-medium hover:bg-slate-100 dark:border-slate-400 dark:hover:bg-slate-700 max-md:min-h-11"
        >
          {playing ? t.camPause : t.camPlay}
        </button>
        <span role="status" className="text-slate-700 dark:text-slate-300">
          {playing && frame && !retrying && <><span className="font-semibold text-red-700 dark:text-red-300">● {t.camLive}</span> · </>}
          {playing && retrying && `${t.camReconnecting} · `}
          {!playing && frame && `${t.camPaused} · `}
          {frame && `${t.camFetched}: ${fmtClock(frame.at, lang)}`}
        </span>
      </div>
    </figure>
  );
}
