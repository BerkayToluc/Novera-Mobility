"use client";

import { useEffect, useSyncExternalStore } from "react";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import trMessages from "../messages/tr/errors.json";
import enMessages from "../messages/en/errors.json";
import "@fontsource-variable/manrope/wght.css";
import "./globals.css";

const MESSAGES = { tr: trMessages.ServerError, en: enMessages.ServerError };

// Which language and theme the visitor was using. The root layout is what failed, so there is
// no provider and no cookie reader here: both are read from the address and the cookie in the
// browser. The server snapshot is the default (Turkish, light), and React swaps in the real
// values once it hydrates.
const subscribe = () => () => {};
const readLocale = () => (window.location.pathname.startsWith("/en") ? "en" : "tr");
const readTheme = () => {
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
  return parseTheme(match?.[1]);
};

// The last resort (ARCHITECTURE ADR-23): it replaces the whole document, so it is plain on
// purpose, using only the design tokens and no components that need a provider.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const locale = useSyncExternalStore(subscribe, readLocale, () => "tr" as const);
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as const);
  const t = MESSAGES[locale];

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={locale} data-theme={theme}>
      <body className="flex min-h-dvh items-center justify-center bg-canvas px-4 text-fg">
        <title>{t.title}</title>
        <meta name="robots" content="noindex" />
        <main className="flex max-w-xl flex-col items-start gap-6 py-16">
          <p className="text-label text-fg-muted">{t.code}</p>
          <h1 className="text-h1 text-fg">{t.title}</h1>
          <p className="text-body text-fg-muted">{t.description}</p>
          <button
            type="button"
            onClick={() => retry()}
            className="inline-flex min-h-12 items-center rounded-control bg-primary px-6 text-label text-on-primary hover:bg-primary-hover"
          >
            {t.retry}
          </button>
          {error.digest && (
            <p className="text-small text-fg-muted">
              {t.reference}: <code>{error.digest}</code>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
