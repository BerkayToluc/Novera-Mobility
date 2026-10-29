"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

// Shown when the API answers `409 STALE_WRITE`: the record changed while the form was open (ADMIN.md §3.4, ADR-24).
// What the person typed is NOT thrown away; the banner offers to load the current record next to it. It is an alert, so a
// screen reader announces it when it appears.
export function StaleWriteBanner({ onReload }: { onReload: () => void }) {
  const t = useTranslations("Admin.stale");
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-card border border-warning bg-surface p-4 md:flex-row md:items-center md:justify-between md:p-6">
      <div className="flex flex-col gap-1">
        <p className="text-label text-fg">{t("title")}</p>
        <p className="text-body text-fg-muted">{t("text")}</p>
      </div>
      <Button type="button" variant="outline" className="shrink-0" onClick={onReload}>
        {t("reload")}
      </Button>
    </div>
  );
}
