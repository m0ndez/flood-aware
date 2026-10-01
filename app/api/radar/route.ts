import { connection } from "next/server";
import { loadLatestRadar } from "@/lib/radar";

// Metadata for the newest TMD radar frame. 502 lets the client fall back to RainViewer.
export async function GET() {
  await connection();
  const f = await loadLatestRadar();
  if (!f) return new Response("radar unavailable", { status: 502 });
  return Response.json({ stamp: f.stamp, time: f.time, bounds: f.bounds });
}
