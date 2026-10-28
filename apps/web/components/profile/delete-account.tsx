"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { deleteAccount } from "@/lib/account-client";
import { AuthRateLimitedError, AuthUnavailableError } from "@/lib/auth-client";
import { rateLimitMessage } from "@/lib/rate-limit";

// Deleting an account cannot be undone, so it asks once more in a modal dialog that
// starts on "Cancel": a stray Enter or tap does not destroy anything. A stolen session cookie must not be
// enough either, so a password account types its password and a Google-only account types its e-mail.
export function DeleteAccount({ hasPassword, email }: { hasPassword: boolean; email: string }) {
  const t = useTranslations("Profile.settings.danger");
  const errorT = useTranslations("Auth.errors");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState("");
  const [proofError, setProofError] = useState<string | null>(null);

  function close() {
    dialogRef.current?.close();
    setError(null);
    setProof("");
    setProofError(null);
  }

  async function confirm() {
    setError(null);
    if (proof === "") {
      setProofError(errorT("required"));
      return;
    }
    setProofError(null);
    setPending(true);
    try {
      const deleted = await deleteAccount(hasPassword ? { currentPassword: proof } : { confirmEmail: proof });
      if (!deleted) {
        setProofError(hasPassword ? t("passwordIncorrect") : t("emailMismatch"));
        return;
      }
      // The account and its session are gone: back to the home page, and the header asks the server again.
      router.push("/");
      router.refresh();
    } catch (failure) {
      if (failure instanceof AuthRateLimitedError) setError(rateLimitMessage(limitT, failure.retryAfter));
      else setError(failure instanceof AuthUnavailableError ? errorT("unavailable") : errorT("generic"));
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
          setProof("");
          setProofError(null);
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
          {hasPassword ? (
            <Field label={t("passwordLabel")} error={proofError ?? undefined}>
              {(props) => (
                <PasswordInput
                  autoComplete="current-password"
                  showLabel={t("show")}
                  hideLabel={t("hide")}
                  value={proof}
                  onChange={(event) => setProof(event.target.value)}
                  {...props}
                />
              )}
            </Field>
          ) : (
            <Field label={t("emailLabel", { email })} error={proofError ?? undefined}>
              {(props) => <Input type="email" autoComplete="off" value={proof} onChange={(event) => setProof(event.target.value)} {...props} />}
            </Field>
          )}
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
