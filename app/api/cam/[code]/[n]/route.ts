import { getFrame } from "@/lib/cctv";
import { clientKey, makeLimiter } from "@/lib/ratelimit";

const STATUS = { not_found: 404, busy: 503, upstream: 502 } as const;
// A player polls about once a second per camera, and a visitor may have two open: 240 a minute is generous for
// that and still bounds what one client can push at a third party's server.
const limit = makeLimiter(240, 60_000);

export async function GET(req: Request, ctx: RouteContext<"/api/cam/[code]/[n]">) {
  const rl = limit(clientKey(req.headers));
  if (!rl.ok) return new Response("rate limited", { status: 429, headers: { "retry-after": String(rl.retryAfterS) } });
  const { code, n } = await ctx.params;
  const frame = await getFrame(code, /^\d{1,2}$/.test(n) ? Number(n) : -1);
  if ("error" in frame) return new Response(frame.error, { status: STATUS[frame.error], headers: { "cache-control": "no-store" } });
  return new Response(frame.buf, {
    headers: {
      "content-type": "image/jpeg",
      // Browsers always revalidate (max-age=0, so a polling player is never frozen on a cached frame), but the CDN may
      // share one frame between every viewer for ttlS seconds: that is what keeps N viewers from becoming N upstream hits.
      "cache-control": `public, max-age=0, s-maxage=${frame.ttlS}`,
      "x-frame-at": String(frame.at),
      // The upstream is failing and this is its last good picture: the player must not present it as live.
      ...(frame.stale && { "x-frame-stale": "1" }),
    },
  });
}
