// Placeholder shapes while the server gathers gauges, BMA, road reports and news (a cold load can take several seconds).
// Neutral blocks only: no numbers, no status colours, nothing that could be read as data, let alone as "normal".
// The theme is a cookie read later on the server, so this uses neutral greys that hold on both light and dark.
const Bone = ({ className = "" }: { className?: string }) => <div aria-hidden="true" className={`animate-pulse rounded bg-slate-300 motion-reduce:animate-none ${className}`} />;

function NewsRows({ n }: { n: number }) {
  return (
    <ul className="flex flex-col divide-y divide-slate-200">
      {Array.from({ length: n }, (_, i) => (
        <li key={i} className="py-2.5">
          <Bone className="h-3.5 w-full" />
          <Bone className="mt-1.5 h-3.5 w-3/5" />
          <Bone className="mt-2 h-3 w-1/3" />
        </li>
      ))}
    </ul>
  );
}

// Fallback for the news block alone, which streams in after the rest of the sheet.
export function NewsSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="mt-3">
      <Bone className="mb-3 mt-3 h-5 w-40" />
      <NewsRows n={3} />
    </div>
  );
}

export function LinesSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-2 py-1">
      <Bone className="h-4 w-full" />
      <Bone className="h-4 w-4/5" />
    </div>
  );
}

// Whole page: the map area with its layer panel, and the sheet (bottom on a phone, left card on desktop) with a
// header, the verdict, the news, the area tabs and some station rows, in the order the real sheet has them.
export function PageSkeleton({ label }: { label: string }) {
  return (
    <main aria-busy="true" className="relative isolate h-dvh w-full overflow-hidden bg-slate-200 text-slate-900">
      <p role="status" className="sr-only">
        {label}
      </p>
      <div aria-hidden="true" className="absolute right-3 top-3 hidden w-48 flex-col gap-3 rounded-xl bg-white/90 p-3 shadow-lg md:flex">
        <Bone className="h-7 w-full rounded-full" />
        <Bone className="h-4 w-4/5" />
        <Bone className="h-4 w-3/5" />
        <Bone className="h-4 w-2/3" />
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 flex h-[45dvh] flex-col overflow-hidden rounded-t-2xl bg-white/90 px-4 pb-4 shadow-[0_-8px_30px_rgba(15,23,42,0.2)] md:absolute md:inset-x-auto md:bottom-auto md:left-4 md:top-4 md:h-auto md:max-h-[calc(100dvh-2rem)] md:w-[26rem] md:rounded-2xl md:pt-4 md:shadow-xl">
        <span aria-hidden="true" className="mx-auto my-2.5 h-1.5 w-10 shrink-0 rounded-full bg-slate-300 md:hidden" />
        <div aria-hidden="true" className="min-h-0 flex-1 overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <Bone className="h-6 w-4/5" />
              <Bone className="mt-2 hidden h-4 w-full md:block" />
              <Bone className="mt-1.5 hidden h-4 w-2/3 md:block" />
            </div>
            <Bone className="h-8 w-20 shrink-0 rounded-full" />
          </div>
          <div className="mt-4 flex items-start gap-3 border-b border-slate-200 pb-3">
            <Bone className="size-7 shrink-0 rounded-md" />
            <div className="flex-1">
              <Bone className="h-5 w-3/4" />
              <Bone className="mt-1.5 h-3.5 w-1/2" />
            </div>
          </div>
          <div className="mt-3 flex gap-3">
            <Bone className="h-4 w-16" />
            <Bone className="h-4 w-16" />
            <Bone className="h-4 w-16" />
          </div>
          <Bone className="mb-1 mt-5 h-5 w-40" />
          <NewsRows n={2} />
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Bone className="h-8 w-24 rounded-full" />
            <Bone className="h-8 w-20 rounded-full" />
            <Bone className="h-8 w-32 rounded-full" />
            <Bone className="h-8 w-24 rounded-full" />
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Bone key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
