# Flood Aware: Central & Eastern Thailand

(Started as the Nonthaburi Flood Monitor; the repo and URL are `flood-aware`.)

A public, read-only flood dashboard on one fullscreen map: river and canal levels against bank level, rain, forecasts, rain radar, satellite flood extent and live camera frames. Thai first (`?lang=en` for English). It starts on Nonthaburi and covers Bang Na–Samut Prakan and the Central and Eastern provinces around it. It does not cover the north, northeast or south.

**It is a personal portfolio/demo, not an official warning service.** Stale, missing or failed data is shown as stale, never as normal. For real warnings follow the authorities (e.g. tmd.go.th).

## Run it

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # node --test lib/*.test.ts
pnpm build
```

Next.js 16 (Cache Components, App Router), React 19, Tailwind 4, Leaflet. No database, no accounts. See `AGENTS.md` before changing Next.js code: this version differs from older ones.

Optional environment variables (server only, `.env.local`): `TMD_UID`, `TMD_UKEY` (TMD's published shared demo credentials are used if unset).

## Data sources

| What | Source | Notes |
|---|---|---|
| Gauges, rain, history | ThaiWater v3 (HII) | Undocumented public JSON, can change without notice |
| Rain forecast | Open-Meteo | CC BY 4.0, non-commercial |
| Warnings, 7-day outlook | TMD (data.tmd.go.th) | Warning matching is a keyword filter and can miss items |
| Radar | TMD RADARGIS, RainViewer fallback | TMD has no published terms; RainViewer is personal/educational use only |
| Flood extent | NASA GIBS (MODIS) | About 250 m, a day old, cloud shows as grey |
| Base maps | OpenStreetMap, Esri World Imagery and Dark Gray | Attribution is shown on the map |
| News | RSS feeds of Thai PBS, Thairath, Matichon, Khaosod, Thai Post, The Standard, The Bangkok Insight, Bangkok Post | Headline, outlet and link only, never article text or images. Thai headlines are not translated. Keyword filter, so it can miss or include stories. Press reports, not official bulletins; official bodies are plain links. Daily News skipped (its robots.txt disallows feeds) |
| Bang Na canals, pumps and gates | BMA Drainage and Sewerage Dept. (weather.bangkok.go.th/Klongmap/GetDataForUpdate) | Undocumented official endpoint, no stated terms: **get BMA's permission before a public launch**. About 2 MB and 5 s, so it is trimmed and cached on the server. BMA's "critical" mark is a canal's operating level, so these stations show amber at most and never count as "over bank". No history chart. The tide table in the same response is not shown: it does not say where it is measured |
| Flooded roads | Longdo Traffic / iTIC event feed (event.longdo.com/feed/json) | Reports from drivers and agencies, not measurements. Only reports that have not ended and started within 48 h; reporter handles are never republished |
| Cameras | Nonthaburi City Municipality, Pak Kret municipality, Department of Highways (via iTIC Foundation, listed by Longdo Traffic) | Informal public feeds with no stated terms. Municipal (26 stations, 36 cameras) and Pak Kret (all 52 cameras on the operator's viewer, most of them junctions) are still frames through our proxy; about 75 Highways and iTIC cameras (Nonthaburi, Bang Na, Samut Prakan, Ayutthaya, Nakhon Pathom, Chachoengsao and others) are live HLS video played by the browser (`hls.js`) straight from the iTIC relay, so they cost our server nothing. Most are road cameras. The 83 Chonburi cameras in Longdo's list are left out because they all point at one placeholder loop, and two Highways streams that fail to decode are left out too |

**Before any real deployment:** every third-party source above needs its terms and permission checked, the camera sources in particular. This repository does not grant any rights to that data.

## Deploying

Runs on Vercel (`vercel.json` pins functions to Singapore, the closest region to the Thai sources). Needs Node 22 or newer. Things to know:

- **Persistent caching:** the data layer uses `use cache: remote` so the 10-minute cache survives between serverless invocations. Without it every request re-downloads about 6 MB of feeds.
- **Unreachable from cloud networks:** TMD radar and the Pak Kret cameras do not answer from Vercel. Radar falls back to RainViewer; the Mueang Nonthaburi cameras still work. Run locally to see everything.
- **Public proxies:** `/api/cam/*` and `/api/radar/*` have an in-memory per-client limiter (`lib/ratelimit.ts`), but **it does not hold on Vercel**: requests land on fresh serverless instances, and 260 rapid requests to production got no `429`. It works when self-hosted or run locally. On Vercel the real protection is the `s-maxage` header (one shared frame per viewer group) plus a Vercel Firewall rate-limit rule on `/api/cam/*`, which you need to add in the dashboard.
- **Map tiles:** OpenStreetMap's tile policy allows light, attributed use only. Move the standard style to a hosted provider before real traffic (see `lib/mapstyle.ts`).
- **RainViewer** is free for personal or educational use only: fine for this non-commercial portfolio, not for a product.

## Layout

`app/` page and API routes (camera and radar proxies) · `components/` UI · `lib/` data layers and pure logic with tests (parsers are tested against real frozen responses in `lib/fixtures/`) · `PRODUCT.md` product context.
