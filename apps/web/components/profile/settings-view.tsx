import { getLocale, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { getCurrency } from "@/lib/get-currency";
import { getTheme } from "@/lib/get-theme";
import { getMySessions } from "@/lib/account-server";
import type { AccountSession } from "@/lib/account-sessions";
import { DEFAULT_NOTIFICATIONS, NOTIFY_COOKIE, parseNotifications } from "@/lib/notifications";
import { MOCK_PREFERENCES_COOKIE, parsePreferences, type Preferences } from "@/lib/preferences";
import { DeleteAccount } from "./delete-account";
import { NotificationsForm } from "./notifications-form";
import { PreferencesForm } from "./preferences-form";
import { SecuritySection } from "./security-section";

function Section({ id, title, text, children }: { id: string; title: string; text: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 border-b border-border pb-8 last:border-b-0">
      <h2 id={id} className="text-h3 text-fg">
        {title}
      </h2>
      <p className="max-w-prose text-body text-fg-muted">{text}</p>
      {children}
    </section>
  );
}

export async function SettingsView() {
  const t = await getTranslations("Profile.settings");
  // What the account saved: from the API, or from the sample account's cookies. Without either, what this
  // browser is using now.
  const session = await getSession();
  const jar = await cookies();
  const saved = session?.preferences ?? parsePreferences(jar.get(MOCK_PREFERENCES_COOKIE)?.value);
  const notifications = session?.notifications ?? parseNotifications(jar.get(NOTIFY_COOKIE)?.value) ?? DEFAULT_NOTIFICATIONS;
  let sessions: AccountSession[] | null;
  try {
    sessions = await getMySessions();
  } catch {
    sessions = null;
  }
  const initial: Preferences = saved ?? {
    currency: await getCurrency(),
    theme: await getTheme(),
    locale: (await getLocale()) as "tr" | "en",
  };

  return (
    <div className="flex max-w-xl flex-col gap-8">
      <Section id="settings-defaults" title={t("defaults.title")} text={t("defaults.text")}>
        <PreferencesForm initial={initial} />
      </Section>
      <Section id="settings-notifications" title={t("notifications.title")} text={t("notifications.text")}>
        <NotificationsForm initial={notifications} />
      </Section>
      <Section id="settings-security" title={t("security.title")} text={t("security.text")}>
        <SecuritySection sessions={sessions} hasPassword={session?.hasPassword ?? true} email={session?.user.email ?? ""} />
      </Section>
      <Section id="settings-danger" title={t("danger.title")} text={t("danger.text")}>
        <DeleteAccount hasPassword={session?.hasPassword ?? true} email={session?.user.email ?? ""} />
      </Section>
    </div>
  );
}
