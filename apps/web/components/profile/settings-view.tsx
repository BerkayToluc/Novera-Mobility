import { getTranslations } from "next-intl/server";
import { CurrencySwitcher } from "@/components/currency-switcher";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { getCurrency } from "@/lib/get-currency";
import { getTheme } from "@/lib/get-theme";
import { DeleteAccount } from "./delete-account";

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
  const theme = await getTheme();
  const currency = await getCurrency();

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <Section title={t("language.title")} text={t("language.text")}>
        <LocaleSwitcher />
      </Section>
      <Section title={t("theme.title")} text={t("theme.text")}>
        <ThemeSwitcher initialTheme={theme} />
      </Section>
      <Section title={t("currency.title")} text={t("currency.text")}>
        <CurrencySwitcher initialCurrency={currency} />
      </Section>
      <Section title={t("danger.title")} text={t("danger.text")}>
        <DeleteAccount />
      </Section>
    </div>
  );
}
