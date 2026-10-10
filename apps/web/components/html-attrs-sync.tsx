"use client";

import { useEffect } from "react";
import type { Theme } from "@/lib/theme";

// When a page calls notFound(), Next sends a bare `<html id="__next_error__">` shell and
// recovers on the client, so the `lang` and `data-theme` set by the root layout are missing
// from the document. This puts them back once the page hydrates; without it a screen reader
// would read the 404 in the wrong language and a chosen theme would not apply.
export function HtmlAttrsSync({ lang, theme }: { lang: string; theme: Theme }) {
  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.setAttribute("data-theme", theme);
  }, [lang, theme]);

  return null;
}
