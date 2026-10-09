"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AuthUnavailableError } from "@/lib/auth-client";
import { updateProfile } from "@/lib/account-client";
import { profileSchema, type ProfileInput } from "@/lib/profile-schemas";
import type { SessionUser } from "@/lib/session";

export function AccountForm({ user }: { user: SessionUser }) {
  const t = useTranslations("Profile.account");
  const errorT = useTranslations("Auth.errors");
  const schema = useMemo(() => profileSchema({ required: errorT("required") }), [errorT]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const emailId = useId();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { firstName: user.firstName, lastName: user.lastName },
  });

  // Registered here, in field order, so focus goes to the first invalid field.
  const fields = { firstName: register("firstName"), lastName: register("lastName") };

  async function onSubmit(values: ProfileInput) {
    setFormError(null);
    setSaved(false);
    try {
      await updateProfile(values);
      setSaved(true);
    } catch (error) {
      setFormError(error instanceof AuthUnavailableError ? errorT("unavailable") : errorT("generic"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-xl flex-col gap-5">
      <FormError message={formError} />
      {saved && (
        <p role="status" className="rounded-control bg-surface-muted p-3 text-small text-fg">
          {t("saved")}
        </p>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t("firstName")} error={errors.firstName?.message}>
          {(props) => <Input autoComplete="given-name" {...props} {...fields.firstName} />}
        </Field>
        <Field label={t("lastName")} error={errors.lastName?.message}>
          {(props) => <Input autoComplete="family-name" {...props} {...fields.lastName} />}
        </Field>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={emailId} className="text-label text-fg">
          {t("email")}
        </label>
        {/* Read-only, not disabled: it stays focusable and readable, but cannot be edited. */}
        <Input id={emailId} type="email" value={user.email} readOnly className="bg-surface-muted" />
        <p className="text-small text-fg-muted">{t("emailNote")}</p>
      </div>
      <Button type="submit" size="lg" className="self-start" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
