"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { disableUser, enableUser } from "@/lib/admin-user-actions";
import type { AdminUserDetail } from "@/lib/admin-users";
import { rateLimitMessage } from "@/lib/rate-limit";
import { ConfirmDialog } from "./confirm-dialog";
import { useToast } from "./toast";

// Closing an account and opening it again (V2-34, ADMIN.md §3.11). Closing is asked about, in a window that says what it does and
// what it leaves (the bookings still to come are not cancelled, and how many there are); opening is one press. An administrator's
// account is not closed from here, so the screen says so instead of offering the button, and the API's answer is the one that counts.
export function UserActions({ user }: { user: AdminUserDetail }) {
  const t = useTranslations("Admin.users");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const closed = user.status === "DISABLED";
  const administrator = user.type === "ADMIN";

  async function run(action: (id: string) => Promise<Awaited<ReturnType<typeof disableUser>>>, done: string) {
    setPending(true);
    const result = await action(user.id);
    setPending(false);
    setOpen(false);
    switch (result.status) {
      case "ok":
        toast.show(done);
        router.refresh();
        return;
      case "forbidden":
        toast.show(t("errors.forbidden"), "error");
        return;
      case "not_found":
        toast.show(t("errors.notFound"), "error");
        return;
      case "rate_limited":
        toast.show(rateLimitMessage(limitT, result.retryAfter), "error");
        return;
      default:
        toast.show(t("errors.unavailable"), "error");
    }
  }

  return (
    <section aria-labelledby="user-actions" className="flex max-w-2xl flex-col gap-4 border-t border-border pt-6">
      <h2 id="user-actions" className="text-h3 text-fg">
        {t("actions.title")}
      </h2>

      {administrator ? (
        <p className="text-body text-fg-muted">{t("actions.adminText")}</p>
      ) : closed ? (
        <>
          <p className="text-body text-fg-muted">{t("actions.closedText")}</p>
          <Button type="button" className="self-start" disabled={pending} onClick={() => void run(enableUser, t("toast.enabled"))}>
            {t("actions.enable")}
          </Button>
        </>
      ) : (
        <>
          <p className="text-body text-fg-muted">{t("actions.openText")}</p>
          <Button type="button" variant="destructive" className="self-start" disabled={pending} onClick={() => setOpen(true)}>
            {t("actions.disable")}
          </Button>
        </>
      )}

      <ConfirmDialog
        open={open}
        title={t("disableDialog.title", { name: `${user.firstName} ${user.lastName}` })}
        text={[t("disableDialog.text"), t("disableDialog.upcoming", { count: user.reservations.upcoming })].join(" ")}
        confirmLabel={t("disableDialog.confirm")}
        cancelLabel={t("disableDialog.keep")}
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => void run(disableUser, t("toast.disabled"))}
      />
    </section>
  );
}
