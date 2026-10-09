import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AccountForm } from "@/components/profile/account-form";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Profile.nav");
  return { title: t("account"), robots: { index: false } };
}

export default async function AccountPage() {
  const t = await getTranslations("Profile.account");
  const session = await getSession();
  // The layout already shows the "sign in" notice without a session; this narrows the type.
  if (!session) return null;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-h2 text-fg">{t("title")}</h2>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </div>
      <AccountForm user={session.user} />
    </section>
  );
}
