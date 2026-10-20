"use client";

import { useState, useTransition } from "react";
import { Laptop, Smartphone } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { changePassword, revokeOtherSessions } from "@/lib/account-actions";
import { AuthRateLimitedError, requestPasswordReset } from "@/lib/auth-client";
import type { AccountSession } from "@/lib/account-sessions";

// Security (SPEC §2.9, v0.8): change the password, and see where the account is signed in
// (`POST /me/password`, `GET /me/sessions`). `sessions` is null when the list could not be loaded.
export function SecuritySection({
  sessions: initialSessions,
  hasPassword,
  email,
}: {
  sessions: AccountSession[] | null;
  hasPassword: boolean;
  email: string;
}) {
  const format = useFormatter();
  const t = useTranslations("Profile.settings.security");
  const authT = useTranslations("Auth");
  const errorT = useTranslations("Auth.errors");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [fieldError, setFieldError] = useState<"short" | "same" | "mismatch" | "current" | "incorrect" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [sessions, setSessions] = useState(initialSessions);
  const [revoking, startRevoke] = useTransition();
  const [revokeError, setRevokeError] = useState<string | null>(null);

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
        if (result.reason === "incorrect") setFieldError("incorrect");
        else if (result.reason === "rate_limited") setFormError(errorT("rateLimited"));
        else setFormError(result.reason === "unavailable" ? errorT("unavailable") : errorT("generic"));
        return;
      }
      setSaved(true);
      setCurrent("");
      setNext("");
      setRepeat("");
    });
  }

  // An account opened with Google has no password yet: it sets one through the e-mailed reset link.
  const [linkSent, setLinkSent] = useState(false);
  const [sendingLink, startSendLink] = useTransition();
  function sendLink() {
    setFormError(null);
    startSendLink(async () => {
      try {
        await requestPasswordReset({ email });
        setLinkSent(true);
      } catch (failure) {
        setFormError(failure instanceof AuthRateLimitedError ? errorT("rateLimited") : errorT("unavailable"));
      }
    });
  }

  const others = sessions?.some((entry) => !entry.current) ?? false;

  const show = t("show");
  const hide = t("hide");

  return (
    <div className="flex flex-col gap-8">
      {!hasPassword ? (
        <div className="flex flex-col gap-3">
          <h3 className="text-label text-fg">{t("setPassword.title")}</h3>
          <p className="max-w-prose text-body text-fg-muted">{t("setPassword.text")}</p>
          <FormError message={formError} />
          {linkSent ? (
            <p role="status" className="rounded-control bg-surface-muted p-3 text-small text-fg">
              {t("setPassword.sent", { email })}
            </p>
          ) : (
            <Button type="button" disabled={sendingLink} aria-busy={sendingLink} className="self-start" onClick={sendLink}>
              {sendingLink ? t("setPassword.sending") : t("setPassword.send")}
            </Button>
          )}
        </div>
      ) : (
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <h3 className="text-label text-fg">{t("password.title")}</h3>
        <FormError message={formError} />
        {saved && (
          <p role="status" className="rounded-control bg-surface-muted p-3 text-small text-fg">
            {t("password.saved")}
          </p>
        )}
        <Field label={t("password.current")} error={fieldError === "current" ? authT("errors.required") : fieldError === "incorrect" ? t("password.incorrect") : undefined}>
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
      )}

      <section aria-labelledby="sessions-title" className="flex flex-col gap-3">
        <h3 id="sessions-title" className="text-label text-fg">
          {t("sessions.title")}
        </h3>
        {sessions === null ? (
          <p role="alert" className="rounded-control border border-error p-3 text-small text-error">
            {t("sessions.error")}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
            {sessions.map((entry) => {
              const Icon = /iphone|android|mobile/i.test(entry.device ?? "") ? Smartphone : Laptop;
              return (
                <li key={entry.id} className="flex items-center gap-4 px-4 py-3">
                  <Icon aria-hidden="true" className="size-5 shrink-0 text-fg-muted" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="text-body text-fg">
                      {entry.device ?? t("sessions.unknown")}
                      {entry.current && (
                        <span className="ml-2 rounded-full bg-selected px-2 py-0.5 text-small text-on-selected">{t("sessions.thisDevice")}</span>
                      )}
                    </p>
                    <p className="text-small text-fg-muted">
                      {entry.current
                        ? t("sessions.now")
                        : t("sessions.since", { date: format.dateTime(new Date(entry.createdAt), { dateStyle: "long" }) })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {revokeError && <FormError message={revokeError} />}
        {others && (
          <Button
            type="button"
            variant="outline"
            disabled={revoking}
            aria-busy={revoking}
            className="self-start"
            onClick={() =>
              startRevoke(async () => {
                setRevokeError(null);
                const result = await revokeOtherSessions();
                if (result.ok) setSessions((current) => current?.filter((entry) => entry.current) ?? current);
                else setRevokeError(errorT(result.reason === "unavailable" ? "unavailable" : "generic"));
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
