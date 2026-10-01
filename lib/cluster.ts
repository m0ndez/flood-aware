export type Pt = { lat: number; lon: number };
export type Cluster<T extends Pt> = { lat: number; lon: number; items: T[] };

// Web Mercator world pixels at a zoom, same maths as Leaflet's default CRS.
function worldPx(lat: number, lon: number, zoom: number) {
  const size = 256 * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return { x: ((lon + 180) / 360) * size, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size };
}

// Above this zoom every item is shown on its own, so near-identical cameras are always reachable.
export const MAX_CLUSTER_ZOOM = 16;

// Greedy radius clustering: an item joins the first cluster whose centre is within radiusPx, else starts one.
// A fixed grid was tried first and split items sitting across a cell edge (Nonthaburi's longitude lands on one at z4).
// ponytail: result depends on item order and is O(items x clusters), fine for tens of cameras.
// Swap in leaflet.markercluster only if spiderfy or hundreds of markers are actually needed.
export function cluster<T extends Pt>(items: T[], zoom: number, radiusPx = 40): Cluster<T>[] {
  if (zoom > MAX_CLUSTER_ZOOM) return items.map((i) => ({ lat: i.lat, lon: i.lon, items: [i] }));
  const out: { x: number; y: number; items: T[] }[] = [];
  for (const i of items) {
    const p = worldPx(i.lat, i.lon, zoom);
    const hit = out.find((c) => Math.hypot(c.x - p.x, c.y - p.y) < radiusPx);
    if (hit) {
      const n = hit.items.length;
      hit.x = (hit.x * n + p.x) / (n + 1);
      hit.y = (hit.y * n + p.y) / (n + 1);
      hit.items.push(i);
    } else out.push({ ...p, items: [i] });
  }
  return out.map((c) => ({
    lat: c.items.reduce((sum, i) => sum + i.lat, 0) / c.items.length,
    lon: c.items.reduce((sum, i) => sum + i.lon, 0) / c.items.length,
    items: c.items,
  }));
}
