"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// The bottom banner (ADR-19). Accept, Reject and Settings look the same on purpose: nothing
// nudges the visitor towards "accept". It is a region, not a modal, so the page stays usable;
// `data-consent-banner` lets the stylesheet keep focused elements clear of it.
export function ConsentBanner({
  onAccept,
  onReject,
  onSettings,
}: {
  onAccept: () => void;
  onReject: () => void;
  onSettings: () => void;
}) {
  const t = useTranslations("Consent.banner");

  return (
    <section
      role="region"
      aria-label={t("label")}
      data-consent-banner
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-strong bg-surface"
    >
      <div className="mx-auto flex max-w-content flex-col gap-4 px-4 py-4 md:px-8 xl:flex-row xl:items-center xl:justify-between xl:gap-10">
        <div className="flex max-w-prose flex-col gap-1">
          <h2 className="text-label text-fg">{t("title")}</h2>
          <p className="text-small text-fg-muted">
            {t("text")}{" "}
            <Link href="/cerez-politikasi" className="text-link underline underline-offset-4">
              {t("policy")}
            </Link>
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-2">
          <Button variant="outline" onClick={onAccept}>
            {t("accept")}
          </Button>
          <Button variant="outline" onClick={onReject}>
            {t("reject")}
          </Button>
          <Button variant="outline" onClick={onSettings}>
            {t("settings")}
          </Button>
        </div>
      </div>
    </section>
  );
}
