import { loadRadarImage } from "@/lib/radar";

export async function GET(_req: Request, ctx: RouteContext<"/api/radar/[stamp]">) {
  const { stamp } = await ctx.params;
  const buf = await loadRadarImage(stamp);
  if (!buf) return new Response("not found", { status: 404 });
  return new Response(buf, {
    headers: { "content-type": "image/png", "cache-control": "public, max-age=900, immutable" },
  });
}
