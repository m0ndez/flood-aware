import { getFrame } from "@/lib/cctv";

const STATUS = { not_found: 404, busy: 503, upstream: 502 } as const;

export async function GET(_req: Request, ctx: RouteContext<"/api/cam/[code]/[n]">) {
  const { code, n } = await ctx.params;
  const frame = await getFrame(code, /^\d{1,2}$/.test(n) ? Number(n) : -1);
  if ("error" in frame) return new Response(frame.error, { status: STATUS[frame.error] });
  return new Response(frame.buf, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "no-store", // the player polls; a browser-cached frame would freeze it
      "x-frame-at": String(frame.at),
    },
  });
}
