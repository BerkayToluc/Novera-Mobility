"use client";

import { useTranslations } from "next-intl";
import { WavyText } from "@/components/layout/footer-link";
import { useConsent } from "./consent-provider";

// The footer's way back to the cookie window (ADR-19), so the choice can be changed any time.
export function CookiePreferencesButton({ className, wavy = false }: { className?: string; wavy?: boolean }) {
  const t = useTranslations("Consent");
  const { openSettings } = useConsent();

  return (
    <button type="button" onClick={openSettings} className={className}>
      {wavy ? <WavyText text={t("preferences")} /> : t("preferences")}
    </button>
  );
}
