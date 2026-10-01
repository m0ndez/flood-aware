import type { LatLng, LatLngBounds, Map as LeafletMap, Marker } from "leaflet";
import { nearest } from "@/lib/geo";

// "My location" and "Drop a pin". Everything stays in the browser: the position is never sent anywhere,
// and the pin lives in memory only (not in the URL), so reloading clears it.
type Leaflet = typeof import("leaflet");

export type ToolLabels = {
  locate: string;
  pin: string;
  myLocation: string;
  locating: string;
  denied: string;
  unavailable: string;
  timeout: string;
  pinHint: string;
  pinTitle: string;
  nearest: string;
  noStation: string;
  open: string;
  remove: string;
};
export type ToolStation = { lat: number; lon: number; label: string; href: string };

const ICON_LOCATE =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="8"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg>';
const ICON_PIN =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>';
// Violet teardrop: no status colour or shape is reused, so a pin never reads as a gauge or a camera.
const PIN_ICON_HTML =
  '<svg width="30" height="40" viewBox="0 0 24 32" aria-hidden="true"><path d="M12 31S2 20.5 2 11.5a10 10 0 1 1 20 0C22 20.5 12 31 12 31z" fill="#6d28d9" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="11.5" r="3.6" fill="#fff"/></svg>';

export function addMapTools(
  L: Leaflet,
  map: LeafletMap,
  o: {
    labels: () => ToolLabels;
    stations: () => ToolStation[];
    fit: (b: LatLngBounds) => void;
    open: (href: string) => void;
    say: (msg: string) => void;
  },
) {
  const here = L.layerGroup().addTo(map);
  let pin: Marker | undefined;
  let pinMode = false;

  const box = L.DomUtil.create("div", "leaflet-bar");
  L.DomEvent.disableClickPropagation(box);
  const btn = (svg: string, extra: string) => {
    const b = L.DomUtil.create(
      "button",
      `grid size-11 place-items-center md:size-[34px] bg-white text-slate-800 hover:bg-slate-100 aria-pressed:bg-violet-100 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:aria-pressed:bg-violet-900 ${extra}`,
      box,
    );
    b.type = "button";
    b.innerHTML = svg;
    return b;
  };
  const locateBtn = btn(ICON_LOCATE, "border-b border-slate-300 dark:border-slate-600");
  const pinBtn = btn(ICON_PIN, "");
  pinBtn.setAttribute("aria-pressed", "false");

  const relabel = () => {
    const l = o.labels();
    locateBtn.title = locateBtn.ariaLabel = l.locate;
    pinBtn.title = pinBtn.ariaLabel = l.pin;
  };
  relabel();

  function locate() {
    const l = o.labels();
    if (!("geolocation" in navigator)) return o.say(l.unavailable);
    o.say(l.locating);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll = L.latLng(pos.coords.latitude, pos.coords.longitude);
        const acc = Math.min(pos.coords.accuracy, 5000);
        here.clearLayers();
        L.circle(ll, { radius: acc, interactive: false, color: "#2563eb", weight: 1, fillColor: "#2563eb", fillOpacity: 0.12 }).addTo(here);
        L.circleMarker(ll, { radius: 8, interactive: false, color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }).addTo(here);
        o.fit(ll.toBounds(Math.max(acc * 2, 800)));
        o.say(`${o.labels().myLocation} (±${Math.round(acc)} m)`);
      },
      (err) => {
        const m = o.labels();
        o.say(err.code === err.PERMISSION_DENIED ? m.denied : err.code === err.TIMEOUT ? m.timeout : m.unavailable);
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  // Built with DOM nodes and textContent, so station names can never inject markup.
  function popupFor(ll: LatLng): HTMLElement {
    const l = o.labels();
    const el = document.createElement("div");
    el.className = "flex flex-col gap-1 text-sm";
    const add = (tag: string, text: string, cls = "") => {
      const n = document.createElement(tag);
      n.textContent = text;
      n.className = `m-0 ${cls}`; // Leaflet gives popup paragraphs a 17px margin
      el.append(n);
      return n;
    };
    add("p", l.pinTitle, "font-semibold");
    add("p", `${ll.lat.toFixed(5)}, ${ll.lng.toFixed(5)}`, "tabular-nums text-slate-700 dark:text-slate-300");
    const near = nearest(o.stations(), ll.lat, ll.lng);
    add("p", near ? `${l.nearest}: ${near.item.label} · ${near.km.toFixed(1)} km` : l.noStation);
    const row = document.createElement("div");
    row.className = "mt-1 flex gap-2";
    const action = (text: string, fn: () => void) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = text;
      b.className = "rounded border border-slate-400 px-2 py-1 hover:bg-slate-100 dark:border-slate-500 dark:hover:bg-slate-700";
      b.onclick = fn;
      row.append(b);
    };
    if (near) action(l.open, () => o.open(near.item.href));
    action(l.remove, () => {
      pin?.remove();
      pin = undefined;
    });
    el.append(row);
    return el;
  }

  function place(ll: LatLng) {
    pin?.remove();
    pin = L.marker(ll, {
      icon: L.divIcon({ className: "", iconSize: [30, 40], iconAnchor: [15, 38], popupAnchor: [0, -34], html: PIN_ICON_HTML }),
      title: o.labels().pinTitle,
      alt: o.labels().pinTitle,
      zIndexOffset: 1200,
    })
      .addTo(map)
      .bindPopup(popupFor(ll), { minWidth: 200 })
      .openPopup();
  }

  const onMapClick = (e: { latlng: LatLng }) => {
    setPinMode(false);
    place(e.latlng);
  };
  const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPinMode(false);
  function setPinMode(on: boolean) {
    if (on === pinMode) return;
    pinMode = on;
    pinBtn.setAttribute("aria-pressed", String(on));
    map.getContainer().style.cursor = on ? "crosshair" : "";
    if (on) {
      map.on("click", onMapClick);
      document.addEventListener("keydown", onKey);
      o.say(o.labels().pinHint);
    } else {
      map.off("click", onMapClick);
      document.removeEventListener("keydown", onKey);
      o.say(""); // drop the "tap the map" hint once the mode ends
    }
  }

  locateBtn.onclick = locate;
  pinBtn.onclick = () => setPinMode(!pinMode);

  const control = new L.Control({ position: "bottomright" });
  control.onAdd = () => box;
  control.addTo(map); // added after the zoom control, so it stacks just above it

  return {
    relabel,
    remove() {
      setPinMode(false);
      control.remove();
      here.remove();
      pin?.remove();
    },
  };
}
