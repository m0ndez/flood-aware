# Nonthaburi Flood Monitor

A public, read-only flood dashboard on one fullscreen map: river and canal levels against bank level, rain, forecasts, rain radar, satellite flood extent and live camera frames. Thai first (`?lang=en` for English). It starts on Nonthaburi and extends to the Central and Eastern provinces around it.

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
| Cameras | Nonthaburi City Municipality, Pak Kret municipality | Informal public feeds, still frames only, no stated terms |

**Before any real deployment:** every third-party source above needs its terms and permission checked, the camera sources in particular. This repository does not grant any rights to that data.

## Layout

`app/` page and API routes (camera and radar proxies) · `components/` UI · `lib/` data layers and pure logic with tests · `PRODUCT.md` product context.
