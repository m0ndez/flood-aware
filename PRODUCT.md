# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Two audiences, confirmed as equal in weight:

- **Residents of Nonthaburi and nearby provinces.** They open it on a phone, often under stress, in Thai, to answer "is it flooding near me, and is it getting worse?"
- **Officials, responders and other watchers** who follow many gauges across Nonthaburi, Central and Eastern provinces and want depth: levels, history, rain, forecasts, cameras.

Both must be served without one degrading the other. Thai is the primary language; English is a supported second language (`?lang=en`).

## Product Purpose
A public, read-only flood dashboard. It shows current river and canal levels against bank level, recent rain, rain forecasts, rain radar, satellite flood extent and live municipal camera frames on one fullscreen map, for Nonthaburi first, then Bang Na–Samut Prakan and the Central and Eastern provinces around it (not the whole country). Success is that either audience reaches a trustworthy answer quickly without having to read the whole map.

It is a personal portfolio/demo project. Nobody relies on it for decisions today, but it is built as if someone might.

## Positioning
One fullscreen map that joins river gauges, rain radar, forecasts, satellite flood extent and live cameras, and is honest under uncertainty: stale or missing data is never shown as normal, and it never claims to be an official warning service. Other flood maps either show a single source or show a clean "all clear" when data is missing.

## Operating Context
- Everything is in Thai local time (ICT, UTC+7); upstream timestamps carry no offset and are parsed as ICT.
- Data freshness differs by source: river gauges about every 10 to 60 minutes, rain gauges hourly, TMD radar every 15 minutes (about 12 to 20 minutes old on arrival), rain forecasts hourly, satellite flood layer daily and about a day old, municipal camera frames every 1 to 20 seconds depending on the source. The server caches most of it for about 10 minutes; the page reloads itself every 10 minutes.
- The primary place of use is a phone, one-handed, often outdoors or during an event. Desktop is the second place, used for scanning many stations.
- Status comes from ThaiWater's own bank-capacity level (normal, watch, over bank) plus a stale rule: data older than 3 hours, or with a future timestamp, is shown as stale.

## Capabilities and Constraints
Confirmed and built:
- Station list and detail (level, % of bank, margin to bank, 24 h average trend, nearest rain gauge, 4-day chart with bank line, hourly and 7-day rain forecast) for 14 hand-picked Nonthaburi stations plus derived Central and Eastern stations, grouped by province, and a Bang Na–Samut Prakan view that adds about 40 BMA canal, pumping-station and gate gauges (amber at most: BMA marks are operating levels, not banks; no history chart).
- A flooded-road reports layer and list (Longdo/iTIC) and a flood news list from Thai outlets' own feeds, with a fixed row of official-body links.
- Map layers: three base maps (standard, satellite, dark; dark also themes the UI), TMD radar with a RainViewer fallback, NASA GIBS flood extent, CCTV cameras (Mueang Nonthaburi and Pak Kret stills through our proxy; about 75 Highways and iTIC road cameras as live HLS video straight from the iTIC relay), my-location and drop-a-pin tools.
- TMD warnings strip (only when a recent warning mentions the area) and a 7-day TMD outlook per province.
- The default view is "all areas" (every station, with the CCTV and flooded-road layers on from the start); Nonthaburi, Bang Na, Central and Eastern are shortcuts. State lives in the URL (`station`, `region` (`all` by default, or `nonthaburi`, `bangna`, `central`, `eastern`), `group`, `cam`, `lang`; BMA stations have negative ids); the map style is a cookie.

Constraints:
- No accounts and no database. It is deployed on Vercel (flood-aware-mu.vercel.app), reading public feeds on the server and caching them for a few minutes.
- All data is read from public, mostly undocumented feeds that can change without notice (the ThaiWater v3 JSON, TMD RADARGIS, municipal camera servers).
- ThaiWater has no official warning thresholds for the Nonthaburi gauges, so bank level is the only threshold.
- Camera sources only serve still frames, so "live" means polling; the municipal Mueang server is a slideshow (one frame per 10 to 20 seconds).

Open, undecided:
- Whether, where and under whose name it is ever published.
- Licensing for every third-party source before any public release (RainViewer is personal and educational use only; Esri tiles, TMD radar and the cameras have no terms that permit redistribution that were found).

## Brand Commitments
Name in use: "Flood Aware: Central & Eastern Thailand" in English and "เฝ้าระวังน้ำท่วม ภาคกลาง–ตะวันออก" in Thai (renamed from "Nonthaburi Flood Monitor" when coverage grew; the repo and URL are `flood-aware`). No organisation, logo, colour identity or voice guide exists yet; none is binding.

## Evidence on Hand
- Live data from the sources above, verified working during development.
- No user research, testimonials, usage numbers or case studies exist, and none should be invented.
- No real TMD warning has been observed in the feeds yet (only a 2022 storm item and empty current feeds), so the warning strip's active state has never been seen with live data.
- No cameras were found outside Mueang Nonthaburi and Pak Kret; Bang Bua Thong, Bang Yai, Sai Noi, Bang Kruai and river piers have none.

## Product Principles
- **Never show unconfirmed data as safe.** Stale, missing, future-dated or failed data reads as stale or unknown, never as normal, and a failed fetch is said out loud.
- **Answer first, depth on demand.** A resident should get a trustworthy answer without reading the whole map, and an official should be able to go as deep as the data allows.
- **Every number carries its source and age.** Values come with the time they were measured, and layers say where they come from and what they cannot show (cloud-covered satellite pixels, an empty radar in dry weather).
- **Not an official warning.** The product states this plainly, links to the official source, and does not invent thresholds, advice or claims.
- **Shareable by link.** A view is its URL, so a station, region or camera can be sent to someone.

## Accessibility & Inclusion
No formal standard is mandated yet. Practice so far, to be preserved: status is never colour alone (each state has its own shape and a text label), text contrast has been audited against WCAG AA in all three map styles, the station list is a full keyboard alternative to the map, and the interface works in Thai and English. Phone use under stress is the design target for touch size and reading effort.
