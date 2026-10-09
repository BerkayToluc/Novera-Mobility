"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { PASSWORD_MIN_LENGTH, type AuthErrorMessages } from "@/lib/auth-schemas";

// Field-level validation texts, translated once per language for the form's schema.
export function useAuthErrorMessages(): AuthErrorMessages {
  const t = useTranslations("Auth.errors");
  return useMemo(
    () => ({
      required: t("required"),
      email: t("email"),
      passwordMin: t("passwordMin", { count: PASSWORD_MIN_LENGTH }),
      consent: t("consent"),
    }),
    [t],
  );
}
