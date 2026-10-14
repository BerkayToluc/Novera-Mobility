"use client";

import { useState, useTransition } from "react";
import { Laptop, Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { changePassword, revokeOtherSessions } from "@/lib/account-actions";

// Security (SPEC §2.9, v0.8): change the password, and see where the account is signed in. Both
// are simulated while the API has no such calls (the sessions are a made-up list).
export function SecuritySection({ othersRevoked }: { othersRevoked: boolean }) {
  const t = useTranslations("Profile.settings.security");
  const authT = useTranslations("Auth");
  const errorT = useTranslations("Auth.errors");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [fieldError, setFieldError] = useState<"short" | "same" | "mismatch" | "current" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [revoked, setRevoked] = useState(othersRevoked);
  const [revoking, startRevoke] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaved(false);
    setFormError(null);
    const problem = current === "" ? "current" : next.length < 8 ? "short" : next === current ? "same" : next !== repeat ? "mismatch" : null;
    setFieldError(problem);
    if (problem) return;
    startTransition(async () => {
      const result = await changePassword(current, next);
      if (!result.ok) {
        setFormError(result.reason === "unavailable" ? errorT("unavailable") : errorT("generic"));
        return;
      }
      setSaved(true);
      setCurrent("");
      setNext("");
      setRepeat("");
    });
  }

  const sessions = [
    { id: "this", icon: Laptop, name: t("sessions.this"), when: t("sessions.now"), current: true },
    ...(revoked ? [] : [{ id: "phone", icon: Smartphone, name: t("sessions.phone"), when: t("sessions.twoDays"), current: false }]),
  ];

  const show = t("show");
  const hide = t("hide");

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <h3 className="text-label text-fg">{t("password.title")}</h3>
        <FormError message={formError} />
        {saved && (
          <p role="status" className="rounded-control bg-surface-muted p-3 text-small text-fg">
            {t("password.saved")}
          </p>
        )}
        <Field label={t("password.current")} error={fieldError === "current" ? authT("errors.required") : undefined}>
          {(props) => (
            <PasswordInput autoComplete="current-password" showLabel={show} hideLabel={hide} value={current} onChange={(e) => setCurrent(e.target.value)} {...props} />
          )}
        </Field>
        <Field
          label={t("password.new")}
          hint={t("password.hint")}
          error={fieldError === "short" ? t("password.short") : fieldError === "same" ? t("password.same") : undefined}
        >
          {(props) => (
            <PasswordInput autoComplete="new-password" showLabel={show} hideLabel={hide} value={next} onChange={(e) => setNext(e.target.value)} {...props} />
          )}
        </Field>
        <Field label={t("password.repeat")} error={fieldError === "mismatch" ? t("password.mismatch") : undefined}>
          {(props) => (
            <PasswordInput autoComplete="new-password" showLabel={show} hideLabel={hide} value={repeat} onChange={(e) => setRepeat(e.target.value)} {...props} />
          )}
        </Field>
        <Button type="submit" disabled={pending} aria-busy={pending} className="self-start">
          {pending ? t("password.saving") : t("password.save")}
        </Button>
      </form>

      <section aria-labelledby="sessions-title" className="flex flex-col gap-3">
        <h3 id="sessions-title" className="text-label text-fg">
          {t("sessions.title")}
        </h3>
        <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
          {sessions.map(({ id, icon: Icon, name, when, current: isCurrent }) => (
            <li key={id} className="flex items-center gap-4 px-4 py-3">
              <Icon aria-hidden="true" className="size-5 shrink-0 text-fg-muted" />
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="text-body text-fg">
                  {name}
                  {isCurrent && <span className="ml-2 rounded-full bg-selected px-2 py-0.5 text-small text-on-selected">{t("sessions.thisDevice")}</span>}
                </p>
                <p className="text-small text-fg-muted">{when}</p>
              </div>
            </li>
          ))}
        </ul>
        {!revoked && (
          <Button
            type="button"
            variant="outline"
            disabled={revoking}
            aria-busy={revoking}
            className="self-start"
            onClick={() =>
              startRevoke(async () => {
                const result = await revokeOtherSessions();
                if (result.ok) setRevoked(true);
              })
            }
          >
            {t("sessions.revoke")}
          </Button>
        )}
      </section>
    </div>
  );
}
