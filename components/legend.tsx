import { StatusIcon } from "@/components/status-badge";
import type { Dict } from "@/lib/i18n";
import type { Status } from "@/lib/status";

export function Legend({ t, className = "" }: { t: Dict; className?: string }) {
  return (
    <ul aria-label={t.legend} className={`flex flex-wrap gap-x-4 gap-y-1 text-sm ${className}`}>
      {(["normal", "watch", "critical", "stale"] as Status[]).map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <StatusIcon status={s} /> {t.status[s]}
        </li>
      ))}
    </ul>
  );
}
