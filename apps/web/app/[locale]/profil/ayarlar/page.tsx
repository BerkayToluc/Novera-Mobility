import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SettingsView } from "@/components/profile/settings-view";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Profile.nav");
  return { title: t("settings"), robots: { index: false } };
}

export default async function SettingsPage() {
  const t = await getTranslations("Profile.settings");
  const session = await getSession();
  if (!session) return null;

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-h2 text-fg">{t("title")}</h2>
      <SettingsView />
    </section>
  );
}
