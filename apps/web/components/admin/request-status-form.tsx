"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { rateLimitMessage } from "@/lib/rate-limit";
import { moveRequest } from "@/lib/request-actions";
import type { RequestStatus } from "@/lib/requests";
import { useToast } from "./toast";

// Moving a request on (V2-41, docs/ADMIN.md §3.19): the steps it can go to (the page read them from the API), a note for the timeline and who
// is on it. The note and the assignee are seen by the customer. A request that is over has nothing to choose, and says so. If someone else
// moved it in the meantime the API refuses and the page is read again.
export function RequestStatusForm({ number, next, assignee }: { number: string; next: readonly RequestStatus[]; assignee: string | null }) {
  const t = useTranslations("Admin.requests");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [who, setWho] = useState(assignee ?? "");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  if (next.length === 0) {
    return (
      <section aria-labelledby="request-move" className="flex max-w-2xl flex-col gap-3 border-t border-border pt-6">
        <h2 id="request-move" className="text-h3 text-fg">
          {t("move.title")}
        </h2>
        <p className="text-body text-fg-muted">{t("move.finished")}</p>
      </section>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const problems: Record<string, string> = {};
    if (!status) problems.status = t("move.errors.status");
    if (note.trim().length > 500) problems.note = t("move.errors.note");
    if (who.trim().length > 200) problems.assignee = t("move.errors.assignee");
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;

    setPending(true);
    const result = await moveRequest(number, { status: status as RequestStatus, note, assignee: who });
    setPending(false);
    if (result.status === "ok") {
      toast.show(t("move.toast", { number, status: t(`status.${status as RequestStatus}`) }));
      setStatus("");
      setNote("");
      router.refresh();
      return;
    }
    if (result.status === "invalid") {
      setErrors(Object.fromEntries(Object.keys(result.fields).map((name) => [name, t(`move.errors.${name === "assignee" ? "assignee" : name === "note" ? "note" : "status"}` as "move.errors.note")])));
      return;
    }
    if (result.status === "not_allowed") {
      setFormError(t("move.errors.notAllowed"));
      router.refresh();
    } else if (result.status === "not_found") setFormError(t("move.errors.notFound"));
    else if (result.status === "rate_limited") setFormError(rateLimitMessage(limitT, result.retryAfter));
    else setFormError(t("move.errors.unavailable"));
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate aria-labelledby="request-move" className="flex max-w-2xl flex-col gap-5 border-t border-border pt-6">
      <h2 id="request-move" className="text-h3 text-fg">
        {t("move.title")}
      </h2>
      <p className="text-body text-fg-muted">{t("move.text")}</p>
      <FormError message={formError} />
      <Field label={t("move.status")} error={errors.status}>
        {(controlProps) => (
          <Select {...controlProps} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">{t("move.choose")}</option>
            {next.map((value) => (
              <option key={value} value={value}>
                {t(`status.${value}`)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t("move.note")} hint={t("move.noteHint")} error={errors.note}>
        {(controlProps) => <Textarea rows={3} {...controlProps} value={note} onChange={(event) => setNote(event.target.value)} />}
      </Field>
      <Field label={t("move.assignee")} hint={t("move.assigneeHint")} error={errors.assignee}>
        {(controlProps) => <Input autoComplete="off" {...controlProps} value={who} onChange={(event) => setWho(event.target.value)} />}
      </Field>
      <Button type="submit" size="lg" className="self-start" disabled={pending} aria-busy={pending}>
        {pending ? t("move.sending") : t("move.button")}
      </Button>
    </form>
  );
}
