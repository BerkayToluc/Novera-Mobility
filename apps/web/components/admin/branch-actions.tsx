"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { useRouter } from "@/i18n/navigation";
import type { AdminBranchDetail, BranchUsage } from "@/lib/admin-branches";
import { closeBranch, reopenBranch } from "@/lib/admin-branch-actions";
import { rateLimitMessage } from "@/lib/rate-limit";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast";

// Closing a branch and opening it again (V2-27, ADMIN.md §3.1). A branch is never deleted: it leaves the site and cannot be
// booked, and past bookings keep its name. While it is still in use, the closing is refused and the reasons are listed with
// their numbers ("3 bookings to come, 4 cars"), so the person knows what to do first. The page already knows the numbers,
// so the reasons are on screen before the button is pressed; the API's answer is the one that counts.
export function BranchActions({ branch }: { branch: AdminBranchDetail }) {
  const t = useTranslations("Admin.branches");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<BranchUsage | null>(null);

  const closed = branch.status === "CLOSED";
  // What the page believes keeps the branch open; a refusal from the API replaces it with the numbers of that moment.
  const usage = refusal ?? branch.usage;
  const inUse = usage.reservations > 0 || usage.holds > 0 || usage.vehicles > 0;

  async function close() {
    setPending(true);
    const result = await closeBranch(branch.id);
    setPending(false);
    setOpen(false);
    if (result.status === "ok") {
      toast.show(t("toast.closed"));
      router.refresh();
    } else if (result.status === "in_use") {
      setRefusal(result.usage);
    } else if (result.status === "rate_limited") {
      toast.show(rateLimitMessage(limitT, result.retryAfter), "error");
    } else {
      toast.show(t("errors.unavailable"), "error");
    }
  }

  async function reopen() {
    setPending(true);
    const result = await reopenBranch(branch.id);
    setPending(false);
    if (result.status === "ok") {
      toast.show(t("toast.reopened"));
      router.refresh();
    } else {
      toast.show(result.status === "rate_limited" ? rateLimitMessage(limitT, result.retryAfter) : t("errors.unavailable"), "error");
    }
  }

  return (
    <section aria-labelledby="branch-actions" className="flex max-w-2xl flex-col gap-4 border-t border-border pt-6">
      <h2 id="branch-actions" className="text-h3 text-fg">
        {t("actions.title")}
      </h2>

      {closed ? (
        <>
          <p className="text-body text-fg-muted">{t("actions.closedText")}</p>
          <Button type="button" variant="outline" className="self-start" disabled={pending} onClick={() => void reopen()}>
            {t("actions.reopen")}
          </Button>
        </>
      ) : (
        <>
          <p className="text-body text-fg-muted">{t("actions.openText")}</p>
          {inUse && (
            <StateMessage tone={refusal ? "error" : "empty"} title={t("actions.blockedTitle")} text={t("actions.blockedText")}>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-fg">
                {usage.reservations > 0 && <li>{t("usage.reservations", { count: usage.reservations })}</li>}
                {usage.holds > 0 && <li>{t("usage.holds", { count: usage.holds })}</li>}
                {usage.vehicles > 0 && <li>{t("usage.vehicles", { count: usage.vehicles })}</li>}
              </ul>
            </StateMessage>
          )}
          <Button type="button" variant="destructive" className="self-start" disabled={pending} onClick={() => setOpen(true)}>
            {t("actions.close")}
          </Button>
        </>
      )}

      <ConfirmDialog
        open={open}
        title={t("closeDialog.title", { name: branch.name })}
        text={t("closeDialog.text")}
        confirmLabel={t("closeDialog.confirm")}
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => void close()}
      />
    </section>
  );
}
