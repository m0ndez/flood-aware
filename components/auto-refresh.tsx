"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-render the server data every 10 minutes (the server cache lifetime) WITHOUT a page reload, so the sheet
// detent, scroll position, open sections, dropped pin and playing camera all survive. It replaces
// <meta http-equiv="refresh">, which reset all of that silently and fails Lighthouse. Paused while the tab is hidden.
const EVERY_MS = 10 * 60_000;

export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      last = Date.now();
      router.refresh();
    };
    const id = setInterval(tick, EVERY_MS);
    // Coming back to a tab that slept past the interval: catch up straight away.
    const onVisible = () => document.visibilityState === "visible" && Date.now() - last > EVERY_MS && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);
  return null;
}
