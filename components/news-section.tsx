import { ExternalIcon } from "@/components/icons";
import { OFFICIAL_CHANNELS, NEWS_SOURCES } from "@/lib/news-sources";
import { loadNews } from "@/lib/news";
import { ageOf } from "@/lib/news-parse";
import type { Dict, Lang } from "@/lib/i18n";

const NAME = new Map(NEWS_SOURCES.map((s) => [s.id, s.name]));
const LINK = "underline decoration-slate-400 underline-offset-2 hover:decoration-current dark:decoration-slate-500";
const MUTED = "text-slate-700 dark:text-slate-300";

// Press headlines as published (never translated) with the outlet and age, linking out. No article text or images.
// Official channels are plain links: none of them offers a feed, so nothing here pretends to be an official bulletin.
export async function NewsSection({ now, lang, t }: { now: number; lang: Lang; t: Dict }) {
  const news = await loadNews();
  const rtf = new Intl.RelativeTimeFormat(lang === "th" ? "th-TH" : "en", { numeric: "auto" });
  const n = t.news;
  return (
    <details open className="mt-3">
      <summary className="flex min-h-11 cursor-pointer items-center text-base font-bold md:min-h-9">{n.title}</summary>
      {!news ? (
        <p className={`text-sm ${MUTED}`}>{n.unavailable}</p>
      ) : (
        <>
          {news.items.length === 0 ? (
            <p className={`text-sm ${MUTED}`}>{n.none}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-200 dark:divide-slate-700">
              {news.items.map((it) => {
                const a = ageOf(it.time, now);
                return (
                  <li key={it.link}>
                    <a href={it.link} target="_blank" rel="noopener noreferrer" lang={it.lang} className="group block py-2.5">
                      <span className="line-clamp-2 text-sm font-medium leading-snug group-hover:underline group-focus-visible:underline">{it.title}</span>
                      <span className={`mt-1 flex items-center gap-1.5 text-xs ${MUTED}`}>
                        {NAME.get(it.source)?.[lang]} · {rtf.format(a.value, a.unit)}
                        <ExternalIcon size={12} className="ml-auto" />
                        <span className="sr-only">{n.opensNew}</span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
          <p className={`mt-1 text-xs ${MUTED}`}>
            {n.source}
            {lang === "en" && news.items.some((i) => i.lang === "th") && ` · ${n.thaiOnly}`}
            {news.failed.length > 0 && ` · ${n.partial.replace("{ok}", String(news.checked)).replace("{all}", String(news.checked + news.failed.length))}`}
          </p>
        </>
      )}
      <p className="mt-3 text-sm font-semibold">{n.official}</p>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {OFFICIAL_CHANNELS.map((c) => (
          <li key={c.id}>
            <a href={c.url} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-8 items-center ${LINK}`}>
              {c.name[lang]}
              <span className="sr-only"> {n.opensNew}</span>
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
