"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { saveNotifications } from "@/lib/account-actions";
import type { Notifications } from "@/lib/notifications";

// Which e-mails the account gets (SPEC §2.9, v0.8): reminders before a trip, and campaigns. One form,
// one Save, like the defaults above it.
export function NotificationsForm({ initial }: { initial: Notifications }) {
  const t = useTranslations("Profile.settings.notifications");
  const errorT = useTranslations("Auth.errors");
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(key: keyof Notifications, value: boolean) {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveNotifications(values);
      if (!result.ok) {
        setError(result.reason === "unavailable" ? errorT("unavailable") : errorT("generic"));
        return;
      }
      setSaved(true);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormError message={error} />
      {saved && (
        <p role="status" className="rounded-control bg-surface-muted p-3 text-small text-fg">
          {t("saved")}
        </p>
      )}
      <Checkbox checked={values.reminders} onChange={(event) => change("reminders", event.target.checked)}>
        {t("reminders")}
      </Checkbox>
      <Checkbox checked={values.campaigns} onChange={(event) => change("campaigns", event.target.checked)}>
        {t("campaigns")}
      </Checkbox>
      <Button type="submit" disabled={pending} aria-busy={pending} className="self-start">
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
