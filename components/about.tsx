import type { Dict } from "@/lib/i18n";

// Footer of the card: the disclaimer is always visible, the rest sits behind a disclosure.
export function About({ t }: { t: Dict }) {
  return (
    <div className="px-4 py-2 text-xs text-slate-700 dark:text-slate-300">
      <p className="font-medium">{t.disclaimer}</p>
      <details className="mt-1">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold md:min-h-8">{t.about}</summary>
        <div className="mt-1 max-h-32 space-y-1 overflow-y-auto">
          <p>
            {t.sources}:{" "}
            <a className="inline-block py-1.5 underline" href="https://www.thaiwater.net">ThaiWater / สสน. (HII)</a> ·{" "}
            <a className="inline-block py-1.5 underline" href="https://open-meteo.com">Open-Meteo.com</a> (CC BY 4.0) ·{" "}
            <a className="inline-block py-1.5 underline" href="https://data.tmd.go.th">กรมอุตุนิยมวิทยา / TMD (data.tmd.go.th)</a> ·{" "}
            <a className="inline-block py-1.5 underline" href="https://earthdata.nasa.gov/gibs">NASA GIBS (MODIS)</a> ·{" "}
            <a className="inline-block py-1.5 underline" href="https://radargis.tmd.go.th">TMD RADARGIS</a> ·{" "}
            <a className="inline-block py-1.5 underline" href="https://www.rainviewer.com">RainViewer</a> · เทศบาลนครนนทบุรี · เทศบาลนครปากเกร็ด ·{" "}
            <a className="inline-block py-1.5 underline" href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>
          </p>
          <p><a className="inline-block py-1.5 underline" href="https://www.tmd.go.th">{t.warnLink}</a></p>
          <p>{t.refresh}</p>
        </div>
      </details>
    </div>
  );
}
