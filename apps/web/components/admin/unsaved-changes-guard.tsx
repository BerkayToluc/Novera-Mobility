"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "./confirm-dialog";

// Asks before a page with unsaved changes is left (ADMIN.md §3.4). Two ways out are covered: closing or reloading the tab
// (the browser's own prompt, which cannot be worded) and following a link of the site (our window, with the action named).
// The browser's Back button inside the app cannot be intercepted in Next's router; that one is not covered.
export function UnsavedChangesGuard({ dirty }: { dirty: boolean }) {
  const t = useTranslations("Admin.unsaved");
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);
  // Set while leaving after the person agreed, so the tab's own prompt does not come on top.
  const leaving = useRef(false);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      event.preventDefault();
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      // Another site, or a place on this same page, is not "leaving".
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      // The capture phase: this runs before the link's own handler, which never sees the click.
      event.preventDefault();
      event.stopPropagation();
      setTarget(url.pathname + url.search + url.hash);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  return (
    <ConfirmDialog
      open={target !== null}
      title={t("title")}
      text={t("text")}
      confirmLabel={t("leave")}
      cancelLabel={t("stay")}
      onCancel={() => setTarget(null)}
      onConfirm={() => {
        const destination = target;
        leaving.current = true;
        setTarget(null);
        if (destination) router.push(destination);
      }}
    />
  );
}
