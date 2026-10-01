"use client";

import { useEffect, useRef, useState } from "react";
import type { Dict } from "@/lib/i18n";

// Live HLS from the iTIC relay, played by the browser straight from their host: nothing passes through our server.
// hls.js is loaded on first use (its own chunk, never in the page bundle); browsers without MSE fall back to native HLS.
// ponytail: stops after 10 minutes and while the tab is hidden, like the still-frame players, to spare a public relay.
const MAX_SESSION_MS = 10 * 60_000;
const CONNECT_TIMEOUT_MS = 25_000;
const STALL_CHECK_MS = 3_000;
const STALL_AFTER_CHECKS = 3; // 9 s without the video clock moving
type State = "loading" | "playing" | "stalled" | "failed" | "paused";

export function CamVideo({ src, label, t }: { src: string; label: string; t: Dict }) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<State>("loading");
  const [attempt, setAttempt] = useState(0); // bumped by "try again"

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    setState("loading");
    let hls: import("hls.js").default | null = null;
    let gone = false;
    let mediaRetries = 0;
    // A few DOH streams raise MEDIA_ERR_DECODE on the <video> itself, partway in, without hls.js ever calling it fatal.
    // The documented cure is recoverMediaError(); after two goes the stream is called failed, not left frozen.
    const onVideoError = () => {
      if (hls && mediaRetries++ < 2) hls.recoverMediaError();
      else setState("failed");
    };
    el.addEventListener("error", onVideoError);
    const stop = setTimeout(() => {
      el.pause();
      setState("paused");
    }, MAX_SESSION_MS);
    // Whatever goes wrong inside the player, "connecting" must not last forever.
    const giveUp = setTimeout(() => setState((s) => (s === "loading" ? "failed" : s)), CONNECT_TIMEOUT_MS);
    const onPlaying = () => {
      clearTimeout(giveUp);
      setState("playing");
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") {
        hls?.stopLoad();
        el.pause();
      } else {
        hls?.startLoad();
        el.play().catch(() => {});
      }
    };
    // hls.js reports a buffer stall as non-fatal, and the <video> then just freezes on its last frame.
    // If the clock has not moved for a while when it should be playing, say so and nudge the loader.
    let lastTime = -1;
    let still = 0;
    const watchdog = setInterval(() => {
      if (document.visibilityState === "hidden" || el.paused || el.ended) {
        still = 0;
        return;
      }
      still = el.currentTime === lastTime ? still + 1 : 0;
      lastTime = el.currentTime;
      if (still >= STALL_AFTER_CHECKS) {
        setState((s) => (s === "playing" ? "stalled" : s));
        hls?.startLoad();
      }
    }, STALL_CHECK_MS);
    el.addEventListener("playing", onPlaying);
    document.addEventListener("visibilitychange", onHidden);
    (async () => {
      // hls.js first: Chrome now answers "maybe" to canPlayType for HLS, yet its native player failed on these streams
      // (MEDIA_ERR_SRC_NOT_SUPPORTED) while hls.js plays them. Native playback is only the fallback, for iPhones without MSE.
      const { default: Hls } = await import("hls.js");
      if (gone) return;
      if (Hls.isSupported()) {
        hls = new Hls({ capLevelToPlayerSize: true });
        let netRetries = 0;
        hls.on(Hls.Events.ERROR, (_e, d) => {
          if (!d.fatal) return; // stalls and single segment misses recover on their own
          if (d.type === Hls.ErrorTypes.NETWORK_ERROR && netRetries++ < 3) {
            // startLoad() does not re-fetch a playlist that never loaded, so a failed playlist is requested again.
            const retry = () => (d.details.startsWith("manifest") ? hls?.loadSource(src) : hls?.startLoad());
            setTimeout(retry, 1500 * netRetries);
          }
          else if (d.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries++ < 2) hls?.recoverMediaError();
          else setState("failed");
        });
        hls.loadSource(src);
        hls.attachMedia(el);
      } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
        el.src = src;
      } else {
        return setState("failed");
      }
      el.play().catch(() => {}); // muted, so autoplay is allowed; if not, the native controls start it
    })();
    return () => {
      gone = true;
      clearTimeout(stop);
      clearTimeout(giveUp);
      clearInterval(watchdog);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("error", onVideoError);
      document.removeEventListener("visibilitychange", onHidden);
      hls?.destroy();
      hls = null; // a queued retry then does nothing
      el.removeAttribute("src");
      el.load();
    };
  }, [src, attempt]);

  return (
    <figure className="flex flex-col gap-2">
      {/* The panel heading already names the camera; the video carries it as its aria-label. */}
      <div className="relative aspect-video w-full overflow-hidden rounded border border-slate-300 bg-black dark:border-slate-600">
        <video ref={video} muted playsInline controls aria-label={label} className="h-full w-full" />
        {state !== "playing" && (
          <p role="status" className="absolute inset-0 grid place-items-center bg-slate-50/95 px-3 text-center text-sm text-slate-700 dark:bg-slate-800/95 dark:text-slate-300">
            {state === "loading" ? t.camLoadingVideo : state === "failed" ? t.camVideoFailed : state === "stalled" ? t.camReconnecting : t.camPaused}
          </p>
        )}
      </div>
      {state !== "loading" && state !== "playing" && (
        <button
          type="button"
          onClick={() => setAttempt((a) => a + 1)}
          className="self-start rounded border border-slate-500 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-400 dark:hover:bg-slate-700 max-md:min-h-11"
        >
          {state === "paused" ? t.camPlay : t.camRetry}
        </button>
      )}
    </figure>
  );
}
