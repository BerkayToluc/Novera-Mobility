"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CurrencySwitcher } from "@/components/currency-switcher";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo } from "@/components/logo";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { BurgerButton } from "@/components/ui/burger-button";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import type { Currency } from "@/lib/currency";
import type { Theme } from "@/lib/theme";
import { MainNav } from "./main-nav";

// Matches Tailwind's `xl` breakpoint, where the inline menu takes over: six links do not fit
// beside the logo and the login button any narrower.
const DESKTOP_QUERY = "(min-width: 80rem)";

// A native modal <dialog>: the browser traps focus, closes it on Escape and makes
// the page behind it inert. It covers the header, so it repeats the logo and a
// close button in the same positions; the visitor sees the page chrome stay put.
export function MobileMenu({ initialTheme, initialCurrency }: { initialTheme: Theme; initialCurrency: Currency }) {
  const t = useTranslations("Header");
  const preferencesId = useId();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogId = useId();
  const [open, setOpen] = useState(false);

  function close() {
    dialogRef.current?.close();
  }

  // The `open` attribute is the single source of truth for the panel's state: it changes
  // for Escape, the close button and programmatic close alike, whereas the `close` event
  // is not delivered reliably in every browser.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const observer = new MutationObserver(() => setOpen(dialog.open));
    observer.observe(dialog, { attributes: true, attributeFilter: ["open"] });
    return () => observer.disconnect();
  }, []);

  // Navigating (including to the page already shown) must not leave the panel over the new page.
  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  // The panel is mobile-only: if the window grows to the desktop layout, close it
  // instead of leaving a hidden modal that keeps the page inert.
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) dialogRef.current?.close();
    };
    query.addEventListener("change", closeOnDesktop);
    return () => query.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <>
      <BurgerButton
        open={open}
        label={t("menuOpen")}
        aria-controls={dialogId}
        aria-haspopup="dialog"
        onClick={() => dialogRef.current?.showModal()}
        className="xl:hidden"
      />
      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-label={t("menuTitle")}
        // `open:flex`, not `flex`: a plain display value would defeat the closed dialog's display:none.
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none flex-col bg-canvas p-0 text-fg open:flex"
      >
        <div className="mx-auto flex h-16 w-full max-w-content shrink-0 items-center justify-between gap-4 px-4">
          <Link href="/" onClick={close} aria-label={t("homeLabel")} className="inline-flex min-h-11 items-center">
            <Logo className="h-9 w-auto" />
          </Link>
          {/* Focus starts here when the panel opens, so Escape/Enter closes it straight away. */}
          <BurgerButton open label={t("menuClose")} onClick={close} autoFocus />
        </div>
        <div className="mx-auto flex min-h-0 w-full max-w-content flex-1 flex-col gap-8 overflow-y-auto px-4 pb-8 pt-4">
          <MainNav label={t("navLabel")} orientation="vertical" onNavigate={close} />
          <Button asChild size="lg" className="w-full">
            <Link href="/giris" onClick={close}>
              {t("login")}
            </Link>
          </Button>
          {/* The header shows currency, language and theme from md up; on a phone they live here. */}
          <section aria-labelledby={preferencesId} className="flex flex-col gap-4 border-t border-border pt-6">
            <h2 id={preferencesId} className="text-label text-fg-muted">
              {t("preferences")}
            </h2>
            <div className="flex flex-col gap-2">
              <p className="text-small text-fg-muted">{t("currency")}</p>
              <CurrencySwitcher initialCurrency={initialCurrency} />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-small text-fg-muted">{t("language")}</p>
              <LocaleSwitcher />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-small text-fg-muted">{t("theme")}</p>
              <ThemeSwitcher initialTheme={initialTheme} />
            </div>
          </section>
        </div>
      </dialog>
    </>
  );
}
