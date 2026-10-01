import { connection } from "next/server";
import { loadLatestRadar } from "@/lib/radar";
import { clientKey, makeLimiter } from "@/lib/ratelimit";

const limit = makeLimiter(60, 60_000);

// Metadata for the newest TMD radar frame. 502 lets the client fall back to RainViewer.
export async function GET(req: Request) {
  await connection();
  const rl = limit(clientKey(req.headers));
  if (!rl.ok) return new Response("rate limited", { status: 429, headers: { "retry-after": String(rl.retryAfterS) } });
  const f = await loadLatestRadar();
  if (!f) return new Response("radar unavailable", { status: 502, headers: { "cache-control": "no-store" } });
  return Response.json({ stamp: f.stamp, time: f.time, bounds: f.bounds });
}
