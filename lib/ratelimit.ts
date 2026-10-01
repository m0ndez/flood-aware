// Fixed-window counter per key. In-memory, so each serverless instance counts on its own: it cannot stop a determined
// flood, but it stops one client from turning a public proxy into a steady stream against a third party's small server,
// and it is free. The real backstop is a CDN cache in front (see s-maxage on the proxy routes) and a Vercel WAF rule.
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
