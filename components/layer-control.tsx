"use client";

import { useState } from "react";
import type { Dict, Lang } from "@/lib/i18n";
import { MAP_STYLES, type MapStyle } from "@/lib/mapstyle";
import { FLOOD_CLASSES } from "@/lib/gibs";

type Toggle = { checked: boolean; set: (v: boolean) => void };

// Floating layer switcher: always open on desktop, behind a button on mobile.
// The status line stays in the DOM so its aria-live announcements are never lost.
export function LayerControl({
  radar,
  flood,
  cctv,
  roads,
  hasCctv,
  mapStyle,
  onMapStyle,
  radarSrc,
  floodDates,
  floodDate,
  setFloodDate,
  message,
  note,
  lang,
  t,
}: {
  radar: Toggle;
  flood: Toggle;
  cctv: Toggle;
  roads: Toggle;
  hasCctv: boolean;
  mapStyle: MapStyle;
  onMapStyle: (v: MapStyle) => void;
  radarSrc: "tmd" | "rainviewer" | null; // which radar is on screen, for the legend
  floodDates: string[];
  floodDate: string;
  setFloodDate: (d: string) => void;
  message: string;
  note: string; // standing scope note (what the cameras cover): one line until opened
  lang: Lang;
  t: Dict;
}) {
  const [open, setOpen] = useState(false);
  const box = "flex min-h-9 items-center gap-2 text-sm md:min-h-8";
  return (
    <div className="absolute right-3 top-3 z-30 flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="layer-panel"
        aria-label={t.layers}
        className="grid size-11 place-items-center rounded-xl bg-white/90 dark:bg-slate-900/90 shadow-lg dark:ring-1 dark:ring-white/10 backdrop-blur-xl md:hidden"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
          <path d="m12 3 9 5-9 5-9-5z" />
          <path d="m3 13 9 5 9-5" />
        </svg>
      </button>
      <fieldset id="layer-panel" className={`${open ? "block" : "hidden"} rounded-xl bg-white/90 dark:bg-slate-900/90 px-3 py-2 shadow-lg dark:ring-1 dark:ring-white/10 backdrop-blur-xl md:block`}>
        <legend className="sr-only">{t.layers}</legend>
        <div role="radiogroup" aria-label={t.mapStyle} className="mb-2 flex gap-1 border-b border-slate-200 pb-2 dark:border-slate-700">
          {MAP_STYLES.map((v) => (
            <label key={v} className="flex-1">
              <input type="radio" name="map-style" value={v} checked={mapStyle === v} onChange={() => onMapStyle(v)} className="peer sr-only" />
              <span className="block cursor-pointer rounded-lg border border-slate-300 px-2 py-1 text-center text-xs font-medium peer-checked:border-sky-700 peer-checked:bg-sky-700 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky-700 dark:border-slate-600 dark:peer-checked:border-sky-400 dark:peer-checked:bg-sky-500 dark:peer-checked:text-slate-950">
                {t.styleName[v]}
              </span>
            </label>
          ))}
        </div>
        <label className={box}>
          <input type="checkbox" className="size-6" checked={radar.checked} onChange={(e) => radar.set(e.target.checked)} /> {t.layerRadar}
        </label>
        {radarSrc && (
          <div className="mb-1 ml-6 text-xs text-slate-700 dark:text-slate-300">
            <div
              className="h-2 w-40 rounded"
              style={{ background: radarSrc === "tmd" ? "linear-gradient(to right,#00e600,#ffff00,#ff9900,#ff0000,#ff00ff)" : "linear-gradient(to right,#9bd0ff,#2f6fe0,#0a2a8a)" }}
              aria-hidden="true"
            />
            <div className="flex w-40 justify-between"><span>{t.radarLight}</span><span>{t.radarHeavy}</span></div>
          </div>
        )}
        <label className={box}>
          <input type="checkbox" className="size-6" checked={flood.checked} onChange={(e) => flood.set(e.target.checked)} /> {t.layerFlood}
        </label>
        {flood.checked && (
          <div className="mb-1 ml-6 max-w-56 text-xs text-slate-700 dark:text-slate-300">
            <label className="flex items-center gap-1.5">
              <span className="sr-only">{t.floodDate}</span>
              <select value={floodDate} onChange={(e) => setFloodDate(e.target.value)} className="rounded border border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-900 px-1.5 py-0.5">
                {floodDates.map((d) => <option key={d} value={d}>{new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`))}</option>)}
              </select>
            </label>
            <ul className="mt-1 grid grid-cols-2 gap-x-2" aria-label={t.legend}>
              {FLOOD_CLASSES.map((c) => (
                <li key={c.key} className="flex items-center gap-1">
                  <span className="inline-block size-2.5 rounded-sm border border-slate-500 dark:border-slate-400" style={{ background: c.color }} aria-hidden="true" />
                  {t.floodClass[c.key]}
                </li>
              ))}
            </ul>
            <p className="mt-1">{t.floodNote}</p>
          </div>
        )}
        {hasCctv && (
          <label className={box}>
            <input type="checkbox" className="size-6" checked={cctv.checked} onChange={(e) => cctv.set(e.target.checked)} /> {t.layerCctv}
          </label>
        )}
        <label className={box}>
          <input type="checkbox" className="size-6" checked={roads.checked} onChange={(e) => roads.set(e.target.checked)} /> {t.roads.layer}
        </label>
      </fieldset>
      {note && (
        <details className="group max-w-64 rounded-lg bg-white/90 px-2.5 text-xs text-slate-800 shadow backdrop-blur-xl dark:bg-slate-900/90 dark:text-slate-100 dark:ring-1 dark:ring-white/10">
          <summary className="flex min-h-8 cursor-pointer items-center truncate group-open:block group-open:py-1.5">{note}</summary>
        </details>
      )}
      <p aria-live="polite" className={`${message ? "" : "sr-only"} max-w-64 rounded-lg bg-white/90 dark:bg-slate-900/90 px-2.5 py-1 text-xs text-slate-800 dark:text-slate-100 shadow dark:ring-1 dark:ring-white/10 backdrop-blur-xl`}>
        {message}
      </p>
    </div>
  );
}
