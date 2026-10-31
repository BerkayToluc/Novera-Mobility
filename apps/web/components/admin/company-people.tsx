"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { inviteUser, resendInvite } from "@/lib/admin-company-actions";
import { EMPTY_INVITE_FORM, inviteFormSchema, type AdminCompanyUser, type InviteFormValues } from "@/lib/admin-companies";
import { rateLimitMessage } from "@/lib/rate-limit";
import { StatusChip } from "./status-chip";
import { useToast } from "./toast";

const INVITE_FIELDS = ["email", "firstName", "lastName", "title"] as const;

// The people of a company and the invitation of a new one (V2-33, ADMIN.md §3.3). A person who has not set a password yet is
// "waiting"; the invitation's link lives seven days, and sending it again makes the old link stop working.
export function CompanyPeople({ companyId, users }: { companyId: string; users: AdminCompanyUser[] }) {
  const t = useTranslations("Admin.companies");
  const locale = useLocale();
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "Europe/Istanbul" });

  return (
    <section aria-labelledby="company-people" className="flex max-w-2xl flex-col gap-6 border-t border-border pt-6">
      <div className="flex flex-col gap-1">
        <h2 id="company-people" className="text-h3 text-fg">
          {t("people.title")}
        </h2>
        <p className="text-body text-fg-muted">{t("people.intro")}</p>
      </div>

      {users.length === 0 ? (
        <p className="rounded-card border border-border p-4 text-body text-fg-muted">{t("people.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {users.map((user) => (
            <Person key={user.id} companyId={companyId} user={user} format={(iso) => day.format(new Date(iso))} />
          ))}
        </ul>
      )}

      <InviteForm companyId={companyId} />
    </section>
  );
}

function Person({ companyId, user, format }: { companyId: string; user: AdminCompanyUser; format: (iso: string) => string }) {
  const t = useTranslations("Admin.companies");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function resend() {
    setPending(true);
    const result = await resendInvite(companyId, user.id);
    setPending(false);
    switch (result.status) {
      case "ok":
        toast.show(t("toast.resent"));
        router.refresh();
        return;
      case "settled":
        toast.show(t("errors.settled"), "error");
        router.refresh();
        return;
      case "rate_limited":
        toast.show(rateLimitMessage(limitT, result.retryAfter), "error");
        return;
      case "not_found":
        toast.show(t("errors.personNotFound"), "error");
        return;
      default:
        toast.show(t("errors.unavailable"), "error");
    }
  }

  const name = `${user.firstName} ${user.lastName}`;
  return (
    <li className="flex flex-col gap-3 rounded-card border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label text-fg">{name}</p>
        <StatusChip tone={user.status === "ACTIVE" ? "success" : user.invite?.expired ? "error" : "warning"}>
          {user.status === "ACTIVE" ? t("people.active") : user.invite?.expired ? t("people.expired") : t("people.pending")}
        </StatusChip>
      </div>
      <p className="break-all text-body text-fg-muted">
        {user.email}
        {user.title ? ` · ${user.title}` : ""}
      </p>
      {user.status === "PENDING" && (
        <div className="flex flex-wrap items-center gap-3">
          {user.invite && <p className="text-small text-fg-muted">{user.invite.expired ? t("people.expiredOn", { date: format(user.invite.expiresAt) }) : t("people.validUntil", { date: format(user.invite.expiresAt) })}</p>}
          <Button type="button" variant="outline" disabled={pending} aria-label={t("people.resendFor", { name })} onClick={() => void resend()}>
            {t("people.resend")}
          </Button>
        </div>
      )}
    </li>
  );
}

function InviteForm({ companyId }: { companyId: string }) {
  const t = useTranslations("Admin.companies");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema({ email: t("errors.inviteEmail"), firstName: t("errors.firstName"), lastName: t("errors.lastName"), title: t("errors.title") })),
    defaultValues: EMPTY_INVITE_FORM,
  });

  async function onSubmit(values: InviteFormValues) {
    setFormError(null);
    const result = await inviteUser(companyId, values);
    switch (result.status) {
      case "ok":
        toast.show(t("toast.invited"));
        reset(EMPTY_INVITE_FORM);
        router.refresh();
        return;
      case "taken":
        setError("email", { message: t("errors.emailTaken") });
        return;
      case "invalid": {
        let shown = false;
        for (const field of Object.keys(result.fields)) {
          if ((INVITE_FIELDS as readonly string[]).includes(field)) {
            setError(field as (typeof INVITE_FIELDS)[number], { message: t(`errors.${field === "email" ? "inviteEmail" : field}` as "errors.firstName") });
            shown = true;
          }
        }
        setFormError(shown ? null : t("errors.generic"));
        return;
      }
      case "not_found":
        setFormError(t("errors.notFound"));
        return;
      case "rate_limited":
        setFormError(rateLimitMessage(limitT, result.retryAfter));
        return;
      default:
        setFormError(t("errors.unavailable"));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-labelledby="invite-title" className="flex flex-col gap-4 rounded-card border border-border p-4">
      <h3 id="invite-title" className="text-label text-fg">
        {t("invite.title")}
      </h3>
      <p className="text-small text-fg-muted">{t("invite.hint")}</p>
      <FormError message={formError} />
      <Field label={t("invite.email")} error={errors.email?.message}>
        {(controlProps) => <Input type="email" autoComplete="off" maxLength={120} {...controlProps} {...register("email")} />}
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("invite.firstName")} error={errors.firstName?.message}>
          {(controlProps) => <Input autoComplete="off" maxLength={60} {...controlProps} {...register("firstName")} />}
        </Field>
        <Field label={t("invite.lastName")} error={errors.lastName?.message}>
          {(controlProps) => <Input autoComplete="off" maxLength={60} {...controlProps} {...register("lastName")} />}
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("invite.personTitle")} error={errors.title?.message}>
          {(controlProps) => <Input autoComplete="off" maxLength={80} {...controlProps} {...register("title")} />}
        </Field>
        <Field label={t("invite.locale")} hint={t("invite.localeHint")}>
          {(controlProps) => (
            <Select {...controlProps} {...register("locale")}>
              <option value="tr">{t("invite.localeTr")}</option>
              <option value="en">{t("invite.localeEn")}</option>
            </Select>
          )}
        </Field>
      </div>
      <Button type="submit" size="lg" className="self-start" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? t("invite.sending") : t("invite.submit")}
      </Button>
    </form>
  );
}
