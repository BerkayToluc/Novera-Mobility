"use client";

import { useId, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "@/i18n/navigation";

type ConsentCheckboxProps = Omit<ComponentProps<"input">, "type" | "children"> & { error?: string };

// The KVKK consent every form that collects personal data carries (SPEC §4, ARCHITECTURE ADR-20),
// linking to the privacy notice. The notice opens in a new tab so the half-filled form stays.
export function ConsentCheckbox({ error, ...props }: ConsentCheckboxProps) {
  const t = useTranslations("FormParts");
  const errorId = useId();

  return (
    <div className="flex flex-col gap-1">
      <Checkbox aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} {...props}>
        {t.rich("consent", {
          link: (chunks) => (
            <Link href="/kvkk" target="_blank" className="text-link underline underline-offset-4">
              {chunks}
              <span className="sr-only"> {t("newTab")}</span>
            </Link>
          ),
        })}
      </Checkbox>
      {error && (
        <p id={errorId} className="text-small text-error">
          {error}
        </p>
      )}
    </div>
  );
}
