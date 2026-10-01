"use client";

import { useEffect } from "react";
import type { Lang } from "@/lib/i18n";

// The root layout cannot see the ?lang= query (it renders once for every page), so <html lang> starts as "th".
// This keeps it truthful in English mode: screen readers pick their pronunciation from it.
export function LangSync({ lang }: { lang: Lang }) {
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}
