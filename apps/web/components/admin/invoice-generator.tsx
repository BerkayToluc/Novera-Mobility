"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { generateInvoices } from "@/lib/invoice-actions";
import { rateLimitMessage } from "@/lib/rate-limit";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast";

// Making a month's invoices (V2-37, docs/ADMIN.md §3.15). The month is chosen, the window asks before anything is made (an invoice cannot
// be taken back from here), and the answer says how many were made. A month that already has its invoices is refused by the API, and the
// screen says so instead of making a second set.
export function InvoiceGenerator({ periods, defaultPeriod }: { periods: Array<{ value: string; label: string }>; defaultPeriod: string }) {
  const t = useTranslations("Admin.invoices");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [period, setPeriod] = useState(defaultPeriod);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const label = periods.find((entry) => entry.value === period)?.label ?? period;

  async function generate() {
    setPending(true);
    const result = await generateInvoices(period);
    setPending(false);
    setOpen(false);
    if (result.status === "ok") {
      toast.show(result.created === 0 ? t("toast.none", { period: label }) : t("toast.created", { count: result.created, period: label }));
      router.refresh();
    } else if (result.status === "already") {
      toast.show(t("errors.already", { period: label }), "error");
    } else if (result.status === "future") {
      toast.show(t("errors.future"), "error");
    } else if (result.status === "rate_limited") {
      toast.show(rateLimitMessage(limitT, result.retryAfter), "error");
    } else {
      toast.show(t("errors.unavailable"), "error");
    }
  }

  return (
    <section aria-labelledby="invoice-generate" className="flex max-w-2xl flex-col gap-4 rounded-card border border-border p-4 md:p-6">
      <h2 id="invoice-generate" className="text-h3 text-fg">
        {t("generate.title")}
      </h2>
      <p className="text-body text-fg-muted">{t("generate.text")}</p>
      <div className="flex flex-wrap items-end gap-4">
        <Field label={t("generate.period")} className="w-full md:w-64">
          {(controlProps) => (
            <Select value={period} onChange={(event) => setPeriod(event.target.value)} {...controlProps}>
              {periods.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button type="button" disabled={pending} onClick={() => setOpen(true)}>
          {t("generate.button")}
        </Button>
      </div>

      <ConfirmDialog
        open={open}
        title={t("generate.dialogTitle", { period: label })}
        text={t("generate.dialogText")}
        confirmLabel={t("generate.confirm")}
        cancelLabel={t("generate.keep")}
        tone="primary"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => void generate()}
      />
    </section>
  );
}
