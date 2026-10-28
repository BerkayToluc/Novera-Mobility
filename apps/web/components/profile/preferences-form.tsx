"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/auth/form-error";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useRouter } from "@/i18n/navigation";
import { CURRENCIES, CURRENCY_SYMBOLS } from "@/lib/currency";
import { LANGUAGE_NAMES } from "@/lib/languages";
import type { Preferences } from "@/lib/preferences";
import { savePreferences } from "@/lib/preferences-actions";
import { THEMES } from "@/lib/theme";

// The account's defaults (SPEC §2.9): one form, one Save. They are kept on the account and
// applied now, and again each time the visitor signs in.
export function PreferencesForm({ initial }: { initial: Preferences }) {
  const t = useTranslations("Profile.settings.defaults");
  const themeT = useTranslations("ThemeSwitcher");
  const errorT = useTranslations("Auth.errors");
  const router = useRouter();
  const [values, setValues] = useState<Preferences>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function change<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await savePreferences(values);
      if (!result.ok) {
        setError(result.reason === "unavailable" ? errorT("unavailable") : errorT("generic"));
        return;
      }
      setSaved(true);
      // Prices and theme come from cookies the server just wrote; the language is the address.
      router.replace("/profil/ayarlar", { locale: values.locale });
      router.refresh();
    } catch {
      setError(errorT("generic"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <FormError message={error} />
      {saved && (
        <p role="status" className="rounded-control bg-surface-muted p-3 text-small text-fg">
          {t("saved")}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <p className="text-label text-fg">{t("language")}</p>
        <SegmentedControl
          label={t("language")}
          options={(["tr", "en"] as const).map((value) => ({ value, label: LANGUAGE_NAMES[value] }))}
          value={values.locale}
          onChange={(value) => change("locale", value)}
          className="self-start"
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-label text-fg">{t("theme")}</p>
        <SegmentedControl
          label={t("theme")}
          options={THEMES.map((value) => ({ value, label: themeT(value) }))}
          value={values.theme}
          onChange={(value) => change("theme", value)}
          className="self-start"
        />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-label text-fg">{t("currency")}</p>
        <SegmentedControl
          label={t("currency")}
          options={CURRENCIES.map((value) => ({ value, label: `${CURRENCY_SYMBOLS[value]} ${value}` }))}
          value={values.currency}
          onChange={(value) => change("currency", value)}
          className="self-start"
        />
      </div>
      <Button type="submit" size="lg" className="self-start" disabled={saving} aria-busy={saving}>
        {saving ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
