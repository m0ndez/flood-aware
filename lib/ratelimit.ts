// Fixed-window counter per key. In-memory, so each process counts on its own. That works for one long-lived server
// (local, Docker, a VPS) but NOT on Vercel: measured on production, 260 rapid requests got no 429 because they landed
// on different serverless instances. There the backstop is the CDN cache in front (s-maxage on the proxy routes) and a
// Vercel Firewall rate-limit rule, which has to be configured in the dashboard.
export function makeLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, { n: number; reset: number }>();
  return function check(key: string): { ok: true } | { ok: false; retryAfterS: number } {
    const t = now();
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset <= t) hits.delete(k); // bounded memory
    const h = hits.get(key);
    if (!h || h.reset <= t) {
      hits.set(key, { n: 1, reset: t + windowMs });
      return { ok: true };
    }
    if (h.n >= limit) return { ok: false, retryAfterS: Math.max(1, Math.ceil((h.reset - t) / 1000)) };
    h.n++;
    return { ok: true };
  };
}

// Vercel sets x-vercel-forwarded-for itself (not client-controllable there); elsewhere fall back to the first
// x-forwarded-for hop. Unknown clients share one bucket, which fails safe.
export function clientKey(headers: Headers): string {
  return headers.get("x-vercel-forwarded-for")?.split(",")[0].trim() || headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}
