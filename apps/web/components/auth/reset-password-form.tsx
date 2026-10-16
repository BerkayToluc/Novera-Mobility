"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Link } from "@/i18n/navigation";
import { AuthRateLimitedError, AuthUnavailableError, ResetLinkInvalidError, resetPassword } from "@/lib/auth-client";
import { PASSWORD_MIN_LENGTH, resetPasswordSchema, type ResetPasswordInput } from "@/lib/auth-schemas";
import { FormError } from "./form-error";
import { useAuthErrorMessages } from "./use-auth-messages";

// The token comes from the link in the e-mail. A link that is wrong, used or too old is told apart
// from a failure of the service, because only the first needs a new link.
export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("Auth");
  const messages = useAuthErrorMessages();
  const schema = useMemo(() => resetPasswordSchema(messages), [messages]);
  const [formError, setFormError] = useState<string | null>(null);
  const [linkInvalid, setLinkInvalid] = useState(token === "");
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { password: "" },
  });

  async function onSubmit(values: ResetPasswordInput) {
    setFormError(null);
    try {
      await resetPassword(token, values.password);
      setDone(true);
    } catch (error) {
      if (error instanceof ResetLinkInvalidError) setLinkInvalid(true);
      else if (error instanceof AuthRateLimitedError) setFormError(t("errors.rateLimited"));
      else if (error instanceof AuthUnavailableError) setFormError(t("errors.unavailable"));
      else setFormError(t("errors.generic"));
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-5">
        <p role="status" className="rounded-control bg-surface-muted p-4 text-body text-fg">
          {t("reset.done")}
        </p>
        <Button asChild size="lg">
          <Link href="/giris">{t("reset.toLogin")}</Link>
        </Button>
      </div>
    );
  }

  if (linkInvalid) {
    return (
      <div className="flex flex-col gap-5">
        <p role="alert" className="rounded-control border border-error p-3 text-small text-error">
          {t("reset.invalidLink")}
        </p>
        <Button asChild size="lg">
          <Link href="/sifre-sifirla">{t("reset.requestNew")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <FormError message={formError} />
      <Field
        label={t("reset.newPassword")}
        hint={t("fields.passwordHint", { count: PASSWORD_MIN_LENGTH })}
        error={errors.password?.message}
      >
        {(props) => (
          <PasswordInput
            autoComplete="new-password"
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
            {...props}
            {...register("password")}
          />
        )}
      </Field>
      <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? t("reset.submitting") : t("reset.submit")}
      </Button>
    </form>
  );
}
