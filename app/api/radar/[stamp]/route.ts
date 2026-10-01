import { clientKey, makeLimiter } from "@/lib/ratelimit";
import { loadRadarImage } from "@/lib/radar";

const limit = makeLimiter(120, 60_000);

export async function GET(req: Request, ctx: RouteContext<"/api/radar/[stamp]">) {
  const rl = limit(clientKey(req.headers));
  if (!rl.ok) return new Response("rate limited", { status: 429, headers: { "retry-after": String(rl.retryAfterS) } });
  const { stamp } = await ctx.params;
  const buf = await loadRadarImage(stamp);
  if (!buf) return new Response("not found", { status: 404 });
  return new Response(buf, {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=900, immutable" },
  });
}
