"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";

// Catches anything unexpected inside the profile pages; expected failures (the API being
// unreachable) are handled in the page itself.
export default function ProfileError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("Profile.error");

  return (
    <StateMessage tone="error" title={t("title")} text={t("text")}>
      <Button onClick={() => retry()}>{t("retry")}</Button>
    </StateMessage>
  );
}
