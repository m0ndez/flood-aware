import type { LayerGroup, Map as LeafletMap } from "leaflet";
import type { RefObject } from "react";
import type { Status } from "@/lib/status";

export type Leaflet = typeof import("leaflet");
export type MapStation = { id: number; lat: number; lon: number; status: Status; name: string; label: string; href: string };
export type MapCamera = { code: string; lat: number; lon: number; label: string; href: string };

export type MapRoad = { id: string; lat: number; lon: number; title: string; place: string; ageText: string; sourceLabel: string };

// What the init effect builds once Leaflet has loaded (it touches `window`, so it only exists client-side).
export type MapHandle = { L: Leaflet; map: LeafletMap; layer: LayerGroup; camLayer: LayerGroup; roadLayer: LayerGroup };
export type MapRef = RefObject<MapHandle | null>;
