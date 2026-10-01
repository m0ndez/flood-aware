// One drawn icon family: 24px grid, 1.8 stroke, round caps. Replaces ⚠ ‹ ▲ ▼ ▬ text glyphs.
type P = { size?: number; className?: string };
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export function WarnIcon({ size = 16, className }: P) {
  return (
    <svg width={size} height={size} className={`shrink-0 ${className ?? ""}`} {...base}>
      <path d="M12 3.5 22 20H2z" />
      <path d="M12 10v4.5M12 17.2v.1" />
    </svg>
  );
}

export function ChevronLeftIcon({ size = 16, className }: P) {
  return (
    <svg width={size} height={size} className={`shrink-0 ${className ?? ""}`} {...base}>
      <path d="m14.5 5-7 7 7 7" />
    </svg>
  );
}

export function TrendIcon({ dir, size = 16, className }: P & { dir: "rising" | "falling" | "steady" }) {
  return (
    <svg width={size} height={size} className={`shrink-0 ${className ?? ""}`} {...base}>
      {dir === "rising" && <path d="M12 19V5M6 11l6-6 6 6" />}
      {dir === "falling" && <path d="M12 5v14M6 13l6 6 6-6" />}
      {dir === "steady" && <path d="M5 12h14M14 7l5 5-5 5" />}
    </svg>
  );
}
