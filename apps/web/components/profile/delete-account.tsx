"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { deleteAccount } from "@/lib/account-client";
import { AuthUnavailableError } from "@/lib/auth-client";

// Deleting an account cannot be undone, so it asks once more in a modal dialog that
// starts on "Cancel": a stray Enter or tap does not destroy anything.
export function DeleteAccount() {
  const t = useTranslations("Profile.settings.danger");
  const errorT = useTranslations("Auth.errors");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    dialogRef.current?.close();
    setError(null);
  }

  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await deleteAccount();
    } catch (failure) {
      setError(failure instanceof AuthUnavailableError ? errorT("unavailable") : errorT("generic"));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        aria-haspopup="dialog"
        onClick={() => {
          // Escape closes the dialog without going through close(), so clear any old failure here.
          setError(null);
          dialogRef.current?.showModal();
        }}
      >
        {t("delete")}
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby="delete-account-title"
        className="m-auto w-11/12 max-w-md rounded-card border border-border bg-surface p-6 text-fg backdrop:bg-band/70 md:p-8"
      >
        <div className="flex flex-col gap-4">
          <h2 id="delete-account-title" className="text-h3 text-fg">
            {t("confirmTitle")}
          </h2>
          <p className="text-body text-fg-muted">{t("confirmText")}</p>
          <FormError message={error} />
          <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
            <Button variant="outline" onClick={close} autoFocus>
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={pending} aria-busy={pending}>
              {pending ? t("deleting") : t("confirm")}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
