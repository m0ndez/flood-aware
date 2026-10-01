"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";

// Desktop (md+): a floating card on the left. Mobile: an Apple-Maps style bottom sheet with
// three detents. The handle cycles them on tap/Enter/Space and can be dragged by touch or mouse.
type Detent = "peek" | "half" | "full";
const ORDER: Detent[] = ["peek", "half", "full"];
const PEEK_PX = 96;
const CSS_H: Record<Detent, string> = { peek: `${PEEK_PX}px`, half: "50dvh", full: "90dvh" };
const pxOf = (d: Detent, vh: number) => (d === "peek" ? PEEK_PX : d === "half" ? vh * 0.5 : vh * 0.9);

export function FloatingSheet({
  header,
  footer,
  children,
  focusKey,
  initial,
  resizeLabel,
  stateLabels,
}: {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  /** Changes whenever the selection (station / camera) changes. */
  focusKey: string;
  initial: Detent;
  resizeLabel: string;
  stateLabels: Record<Detent, string>;
}) {
  const [detent, setDetent] = useState<Detent>(initial);
  const [dragH, setDragH] = useState<number | null>(null);
  const [seenKey, setSeenKey] = useState(focusKey);
  const sheet = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; h: number; moved: boolean } | null>(null);
  const lastDrag = useRef(0);
  const prevKey = useRef(focusKey);

  // A new selection (e.g. a marker tapped while collapsed) must show its content.
  if (seenKey !== focusKey) {
    setSeenKey(focusKey);
    if (detent === "peek") setDetent("half");
  }

  // Bring the new content into view and move focus to its heading so keyboard and
  // screen-reader users land on it, not on a link that has just disappeared.
  useEffect(() => {
    if (prevKey.current === focusKey) return;
    prevKey.current = focusKey;
    body.current?.scrollTo({ top: 0 });
    body.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
  }, [focusKey]);

  // Lets CSS keep the Leaflet zoom control and attribution above the sheet on mobile.
  const heightVar = dragH != null ? `${dragH}px` : CSS_H[detent];
  useEffect(() => {
    document.documentElement.style.setProperty("--sheet-h", heightVar);
    return () => {
      document.documentElement.style.removeProperty("--sheet-h");
    };
  }, [heightVar]);

  const clamp = (h: number) => Math.min(Math.max(h, PEEK_PX), window.innerHeight * 0.9);

  function down(e: PointerEvent<HTMLButtonElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, h: sheet.current?.getBoundingClientRect().height ?? PEEK_PX, moved: false };
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dy) < 6) return;
    d.moved = true;
    setDragH(clamp(d.h - dy));
  }
  function up(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    lastDrag.current = Date.now();
    const h = clamp(d.h - (e.clientY - d.y));
    const vh = window.innerHeight;
    setDetent(ORDER.reduce((best, c) => (Math.abs(pxOf(c, vh) - h) < Math.abs(pxOf(best, vh) - h) ? c : best)));
    setDragH(null);
  }
  function cancel() {
    drag.current = null;
    setDragH(null);
  }
  function cycle() {
    if (Date.now() - lastDrag.current < 400) return; // the click that follows a drag release
    setDetent(ORDER[(ORDER.indexOf(detent) + 1) % ORDER.length]);
  }

  const hideBody = detent === "peek" && dragH == null ? "max-md:invisible" : ""; // out of tab order while collapsed

  return (
    <div
      ref={sheet}
      data-detent={detent}
      style={{ "--sheet-h": heightVar } as CSSProperties}
      className={`group fixed inset-x-0 bottom-0 z-40 flex h-[var(--sheet-h)] flex-col overflow-hidden rounded-t-2xl bg-white/90 dark:bg-slate-900/90 shadow-[0_-8px_30px_rgba(15,23,42,0.2)] dark:ring-1 dark:ring-white/10 backdrop-blur-xl ${dragH == null ? "transition-[height] duration-200 ease-out" : ""} md:absolute md:inset-x-auto md:bottom-auto md:left-4 md:top-4 md:h-auto md:max-h-[calc(100dvh-2rem)] md:w-[26rem] md:rounded-2xl md:shadow-xl`}
    >
      <button
        type="button"
        onClick={cycle}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
        aria-label={`${resizeLabel}: ${stateLabels[detent]}`}
        className="relative flex h-7 w-full shrink-0 touch-none items-center justify-center after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] md:hidden"
      >
        <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-slate-400 dark:bg-slate-500" />
      </button>
      <div className="shrink-0 px-4 pb-2 md:pt-4">{header}</div>
      <div ref={body} className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 ${hideBody}`}>
        {children}
      </div>
      <div className={`shrink-0 border-t border-slate-200 dark:border-slate-700 ${hideBody}`}>{footer}</div>
    </div>
  );
}
