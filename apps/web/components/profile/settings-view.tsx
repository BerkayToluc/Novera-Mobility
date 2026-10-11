import { getLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { getCurrency } from "@/lib/get-currency";
import { getTheme } from "@/lib/get-theme";
import { MOCK_PREFERENCES_COOKIE, parsePreferences, type Preferences } from "@/lib/preferences";
import { DeleteAccount } from "./delete-account";
import { PreferencesForm } from "./preferences-form";

function Section({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-border pb-8 last:border-b-0">
      <h2 className="text-h3 text-fg">{title}</h2>
      <p className="max-w-prose text-body text-fg-muted">{text}</p>
      {children}
    </section>
  );
}

export async function SettingsView() {
  const t = await getTranslations("Profile.settings");
  // The account's saved defaults when it has any; otherwise what this browser is using now.
  const saved = parsePreferences((await cookies()).get(MOCK_PREFERENCES_COOKIE)?.value);
  const initial: Preferences = saved ?? {
    currency: await getCurrency(),
    theme: await getTheme(),
    locale: (await getLocale()) as "tr" | "en",
  };

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <Section title={t("defaults.title")} text={t("defaults.text")}>
        <PreferencesForm initial={initial} />
      </Section>
      <Section title={t("danger.title")} text={t("danger.text")}>
        <DeleteAccount />
      </Section>
    </div>
  );
}
