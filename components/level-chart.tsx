import { parseIct } from "@/lib/status";
import type { Dict, Lang } from "@/lib/i18n";
import { fmtTime } from "@/lib/i18n";
import type { Point } from "@/lib/thaiwater";

const W = 600;
const H = 240;
// The 600-unit viewBox is shown at about 380 px on a phone (scale 0.63), so 17 units renders near 10.5 px.
const FONT = 17;
const PAD = { l: 58, r: 12, t: 22, b: 36 };
const MIN_SPAN_M = 0.5; // a few centimetres of wobble must not fill the whole plot

export function LevelChart({ points, bankM, lang, t }: { points: Point[]; bankM: number | null; lang: Lang; t: Dict }) {
  if (points.length < 2) return <p className="text-sm text-slate-600 dark:text-slate-400">{t.noChart}</p>;

  const xs = points.map((p) => parseIct(p.t));
  const vs = points.map((p) => p.v);
  const rawLo = Math.min(...vs, bankM ?? Infinity);
  const rawHi = Math.max(...vs, bankM ?? -Infinity);
  const pad = Math.max(0, MIN_SPAN_M - (rawHi - rawLo)) / 2;
  const lo = rawLo - pad;
  const hi = rawHi + pad;
  const span = hi - lo;
  const x0 = xs[0];
  const xSpan = xs[xs.length - 1] - x0 || 1;
  const px = (x: number) => PAD.l + ((x - x0) / xSpan) * (W - PAD.l - PAD.r);
  const py = (v: number) => PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b);
  const line = points.map((p, i) => `${px(xs[i]).toFixed(1)},${py(p.v).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${t.chart}: ${last.v.toFixed(2)} m`}
        className="w-full"
      >
        <text x={PAD.l - 6} y={py(hi) + 6} textAnchor="end" fontSize={FONT} className="fill-slate-600 dark:fill-slate-400">{hi.toFixed(2)}</text>
        <text x={PAD.l - 6} y={py(lo) + 6} textAnchor="end" fontSize={FONT} className="fill-slate-600 dark:fill-slate-400">{lo.toFixed(2)}</text>
        <line x1={PAD.l} x2={W - PAD.r} y1={py(lo)} y2={py(lo)} className="stroke-slate-300 dark:stroke-slate-600" />
        {bankM != null && (
          <>
            <line x1={PAD.l} x2={W - PAD.r} y1={py(bankM)} y2={py(bankM)} className="stroke-red-700 dark:stroke-red-400" strokeDasharray="6 4" />
            <text x={W - PAD.r} y={py(bankM) - 6} textAnchor="end" fontSize={FONT} className="fill-red-700 dark:fill-red-400">
              {t.bankLine} {bankM.toFixed(2)}
            </text>
          </>
        )}
        <polyline points={line} fill="none" className="stroke-sky-700 dark:stroke-sky-400" strokeWidth="2" strokeLinejoin="round" />
        <text x={PAD.l} y={H - 10} fontSize={FONT} className="fill-slate-600 dark:fill-slate-400">{fmtTime(xs[0], lang)}</text>
        <text x={W - PAD.r} y={H - 10} textAnchor="end" fontSize={FONT} className="fill-slate-600 dark:fill-slate-400">{fmtTime(xs[xs.length - 1], lang)}</text>
      </svg>
    </figure>
  );
}
