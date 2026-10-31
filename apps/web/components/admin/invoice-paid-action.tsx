"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { setInvoicePaid } from "@/lib/invoice-actions";
import type { Invoice } from "@/lib/invoices";
import { rateLimitMessage } from "@/lib/rate-limit";
import { useToast } from "./toast";

// Marking an invoice paid, or taking the mark back (V2-37, docs/ADMIN.md §3.15). The state shown on the customer's screen follows at once
// ("late" is worked out from the due day, so a paid invoice is never late). The version of the invoice travels with the call: an invoice
// that changed since this screen was drawn is not overwritten, the screen reloads instead.
export function InvoicePaidAction({ invoice }: { invoice: Invoice }) {
  const t = useTranslations("Admin.invoices");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const paid = invoice.status === "PAID";

  async function change() {
    setPending(true);
    const result = await setInvoicePaid(invoice.number, invoice.updatedAt, !paid);
    setPending(false);
    if (result.status === "ok") {
      toast.show(paid ? t("toast.unpaid", { number: invoice.number }) : t("toast.paid", { number: invoice.number }));
    } else if (result.status === "stale") {
      toast.show(t("errors.stale"), "error");
    } else if (result.status === "rate_limited") {
      toast.show(rateLimitMessage(limitT, result.retryAfter), "error");
    } else if (result.status === "not_found") {
      toast.show(t("errors.notFound"), "error");
    } else {
      toast.show(t("errors.unavailable"), "error");
    }
    router.refresh();
  }

  return (
    <section aria-labelledby="invoice-actions" className="flex max-w-2xl flex-col gap-4 border-t border-border pt-6 print:hidden">
      <h2 id="invoice-actions" className="text-h3 text-fg">
        {t("actions.title")}
      </h2>
      <p className="text-body text-fg-muted">{paid ? t("actions.paidText") : t("actions.unpaidText")}</p>
      <Button type="button" variant={paid ? "outline" : "primary"} className="self-start" disabled={pending} onClick={() => void change()}>
        {paid ? t("actions.markUnpaid") : t("actions.markPaid")}
      </Button>
    </section>
  );
}
