import { parseIct } from "./status.ts";

export type Warning = {
  issueNo: string;
  announced: string; // "YYYY-MM-DD HH:mm", Thai time
  titleTh: string;
  titleEn: string;
  descTh: string;
};

export const WARNING_MAX_AGE_MS = 72 * 3600_000;
const FUTURE_SKEW_MS = 3600_000;
// The TMD feed is national text with no province field, so relevance is a keyword match.
// It can miss a real warning, which is why the UI always carries a permanent link to TMD as well.
export const KEYWORDS = ["นนทบุรี", "กรุงเทพ", "ภาคกลาง", "เจ้าพระยา"];
// Added for the view on screen, so a Samut Prakan warning does not show on the Nonthaburi tab.
export const EXTRA_KEYWORDS: Record<string, string[]> = { bangna: ["สมุทรปราการ", "บางนา"] };

export function relevantWarnings(all: Warning[], now: number, extra: string[] = []): Warning[] {
  return all.filter((w) => {
    const t = parseIct(w.announced);
    if (Number.isNaN(t) || t > now + FUTURE_SKEW_MS || now - t > WARNING_MAX_AGE_MS) return false; // never show a stale or bogus item as news
    const text = `${w.titleTh} ${w.descTh}`;
    return [...KEYWORDS, ...extra].some((k) => text.includes(k));
  });
}
