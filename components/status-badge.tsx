import { STATUS_STYLE, type Status } from "@/lib/status";

const tone = (s: Status) => `var(--st-${s})`; // see app/globals.css: lighter shades in the dark theme

export function StatusIcon({ status, size = 16 }: { status: Status; size?: number }) {
  const { d } = STATUS_STYLE[status];
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      <path d={d} style={{ fill: tone(status) }} fillRule="evenodd" />
    </svg>
  );
}

export function StatusBadge({ status, label }: { status: Status; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold"
      style={{ color: tone(status), borderColor: tone(status) }}
    >
      <StatusIcon status={status} />
      {label}
    </span>
  );
}
