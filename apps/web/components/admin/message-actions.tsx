"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { setMessageHandled } from "@/lib/admin-message-actions";
import type { AdminMessageDetail } from "@/lib/admin-messages";
import { rateLimitMessage } from "@/lib/rate-limit";
import { useToast } from "./toast";

// The "handled" mark of a contact message and taking it back (V2-32, ADMIN.md §3.2). Neither needs a question: both can be
// repeated, and the mark is taken back with one press. A message whose personal fields were erased has nothing left to answer,
// so it offers no mark.
export function MessageActions({ message }: { message: AdminMessageDetail }) {
  const t = useTranslations("Admin.messages");
  const limitT = useTranslations("RateLimit");
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const handled = message.handledAt !== null;

  async function set(next: boolean) {
    setPending(true);
    const result = await setMessageHandled(message.id, next);
    setPending(false);
    if (result.status === "ok") {
      toast.show(next ? t("toast.handled") : t("toast.undone"));
      router.refresh();
    } else if (result.status === "rate_limited") {
      toast.show(rateLimitMessage(limitT, result.retryAfter), "error");
    } else if (result.status === "not_found") {
      toast.show(t("errors.notFound"), "error");
    } else {
      toast.show(t("errors.unavailable"), "error");
    }
  }

  return (
    <section aria-labelledby="message-actions" className="flex max-w-2xl flex-col gap-4 border-t border-border pt-6">
      <h2 id="message-actions" className="text-h3 text-fg">
        {t("actions.title")}
      </h2>
      {message.anonymized ? (
        <p className="text-body text-fg-muted">{t("actions.erasedText")}</p>
      ) : handled ? (
        <>
          <p className="text-body text-fg-muted">{t("actions.handledText")}</p>
          <Button type="button" variant="outline" className="self-start" disabled={pending} onClick={() => void set(false)}>
            {t("actions.undo")}
          </Button>
        </>
      ) : (
        <>
          <p className="text-body text-fg-muted">{t("actions.waitingText")}</p>
          <Button type="button" className="self-start" disabled={pending} onClick={() => void set(true)}>
            {t("actions.mark")}
          </Button>
        </>
      )}
    </section>
  );
}
