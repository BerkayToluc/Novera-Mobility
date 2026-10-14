"use client";

import { useState } from "react";
import { Tag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { normalizePromo } from "@/lib/promo-codes";

// The campaign code box on the booking summary (SPEC §2.3, G: it moved here from the payment page). The code is kept in the address (kod),
// so the server prices the booking with it and the summary and the confirmation show the same
// total; it is not personal data. Applying and removing go through the address, not through the
// payment form: Enter in this box must not pay.
export function PromoCode({
  query,
  promo,
  percent,
  pathname = "/rezervasyon",
}: {
  query: Record<string, string>;
  pathname?: "/rezervasyon" | "/odeme";
  // What the server made of the code in the address: not entered, entered and taken, or not a code.
  promo: { code: string; applied: boolean } | null;
  percent: number | null;
}) {
  const t = useTranslations("Payment.promo");
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);

  function go(code: string | undefined) {
    setPending(true);
    const { kod: previous, ...rest } = query;
    void previous;
    router.replace({ pathname, query: code ? { ...rest, kod: code } : rest }, { scroll: false });
    // The page asks the server again; the box is free once the new address is in.
    setTimeout(() => setPending(false), 600);
  }

  return (
    <section aria-labelledby="promo-title" className="flex flex-col gap-3 border-t border-border-strong pt-4">
      <h2 id="promo-title" className="flex items-center gap-2 text-label text-fg">
        <Tag aria-hidden="true" className="size-5 text-link" />
        {t("title")}
      </h2>

      {promo?.applied ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-body text-success">
            {t("applied", { code: promo.code, percent: percent ?? 0 })}
          </p>
          <Button type="button" variant="outline" size="compact" disabled={pending} onClick={() => go(undefined)}>
            {t("remove")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-3">
            <Field label={t("label")} className="flex-1">
              {(props) => (
                <Input
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={20}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const code = normalizePromo(value);
                      if (code) go(code);
                    }
                  }}
                  {...props}
                />
              )}
            </Field>
            <Button
              type="button"
              variant="outline"
              disabled={pending || !normalizePromo(value)}
              aria-busy={pending}
              onClick={() => {
                const code = normalizePromo(value);
                if (code) go(code);
              }}
            >
              {pending ? t("applying") : t("apply")}
            </Button>
          </div>
          {promo && !promo.applied && (
            <p role="alert" className="text-small text-error">
              {t("unknown", { code: promo.code })}
            </p>
          )}
          <p className="text-small text-fg-muted">{t("hint")}</p>
        </div>
      )}
    </section>
  );
}
