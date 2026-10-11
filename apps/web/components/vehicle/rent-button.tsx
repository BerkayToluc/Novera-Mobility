"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { startRental } from "@/app/[locale]/araclar/actions";

// "Kirala" (SPEC §2.3): holds the car for 15 minutes, then opens the booking summary. If the car
// was taken in the meantime the card says so in place, and the rest of the results stay usable.
export function RentButton({ params, carName }: { params: Record<string, string>; carName: string }) {
  const t = useTranslations("Vehicle.rent");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<"taken" | "unavailable" | null>(null);

  function rent() {
    setFailure(null);
    startTransition(async () => {
      const result = await startRental(params);
      if (!result.ok) {
        setFailure(result.reason);
        return;
      }
      router.push({ pathname: "/rezervasyon", query: result.query });
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" size="lg" onClick={rent} disabled={pending} aria-busy={pending} className="relative z-10 w-full">
        {pending ? t("holding") : t("button")}
        <span className="sr-only">: {carName}</span>
      </Button>
      {failure && (
        <p role="alert" className="text-small text-error">
          {t(failure)}
        </p>
      )}
    </div>
  );
}
