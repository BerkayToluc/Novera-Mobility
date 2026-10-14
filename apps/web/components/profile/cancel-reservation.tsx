"use client";

import { useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cancelReservation } from "@/app/[locale]/profil/rezervasyonlar/actions";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

// "İptal et" on a booking that is still ahead (SPEC §2.9, v0.8): it asks once more in a modal
// dialog that starts on "Vazgeç", says whether the cancellation is free (until 24 hours before
// pick-up) and tells that the points are not earned. Simulated: there is no cancellation call yet.
export function CancelReservation({
  id,
  carName,
  free,
}: {
  id: string;
  carName: string;
  free: boolean;
}) {
  const t = useTranslations("Profile.bookings.cancel");
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await cancelReservation(id);
      if (!result.ok) {
        setError(t(result.reason === "not_cancellable" ? "notCancellable" : "unavailable"));
        return;
      }
      dialogRef.current?.close();
      // The page reads the bookings on the server: ask it again.
      router.refresh();
    });
  }

  const titleId = `cancel-${id}`;
  return (
    <>
      <Button
        variant="outline"
        aria-haspopup="dialog"
        onClick={() => {
          setError(null);
          dialogRef.current?.showModal();
        }}
      >
        <X aria-hidden="true" className="size-4" />
        {t("button")}
        <span className="sr-only"> {carName}</span>
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-11/12 max-w-md rounded-card border border-border bg-surface p-6 text-fg backdrop:bg-band/70 md:p-8"
      >
        <div className="flex flex-col gap-4">
          <h2 id={titleId} className="text-h3 text-fg">
            {t("title", { car: carName })}
          </h2>
          <p className="text-body text-fg-muted">{free ? t("free") : t("late")}</p>
          <p className="text-body text-fg-muted">{t("points")}</p>
          <FormError message={error} />
          <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
            <Button variant="outline" onClick={() => dialogRef.current?.close()} autoFocus>
              {t("keep")}
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={pending} aria-busy={pending}>
              {pending ? t("cancelling") : t("confirm")}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
