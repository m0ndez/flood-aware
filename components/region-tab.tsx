"use client";

import Link, { useLinkStatus } from "next/link";
import type { ReactNode } from "react";

// Switching area renders the page on the server, which takes a moment the first time (up to about a second on the live
// site). Next keeps the old screen up meanwhile, so without a signal the click looks ignored. While this link is pending
// its pill turns selected and shows a small spinner, instantly, and a screen reader hears that it is loading.
function Pending({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <>
      <span data-pending aria-hidden="true" className="ml-1.5 size-3 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
      <span role="status" className="sr-only">
        {label}
      </span>
    </>
  );
}

export function RegionTab({ href, active, loadingLabel, className, children }: { href: string; active: boolean; loadingLabel: string; className: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      // has-[[data-pending]]: the pill takes the selected look the moment the click lands, before the server answers.
      className={`${className} has-[[data-pending]]:border-sky-700 has-[[data-pending]]:bg-sky-700 has-[[data-pending]]:text-white`}
    >
      {children}
      <Pending label={loadingLabel} />
    </Link>
  );
}
