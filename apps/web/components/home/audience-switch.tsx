"use client";

import { useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useRouter } from "@/i18n/navigation";
import { AUDIENCES, DEFAULT_AUDIENCE, type Audience } from "@/lib/audience";

// The URL is the source of truth (a shared link opens the same tab); the optimistic value
// only keeps the control from lagging behind the click while the server renders the page.
export function AudienceSwitch({ value }: { value: Audience }) {
  const t = useTranslations("HomePage");
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(value);

  return (
    <SegmentedControl
      variant="bare"
      label={t("audienceLabel")}
      options={AUDIENCES.map((audience) => ({ value: audience, label: t(`audiences.${audience}`) }))}
      value={shown}
      onChange={(next) =>
        startTransition(() => {
          setShown(next);
          router.replace(
            { pathname: "/", query: next === DEFAULT_AUDIENCE ? {} : { tip: next } },
            { scroll: false },
          );
        })
      }
    />
  );
}
