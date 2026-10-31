import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Link } from "@/i18n/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// The link of an invitation to a corporate account (V2-33) is this page with `tur=davet`: same form, words that welcome the
// person instead of recovering a password, and the way on is the corporate sign-in tab.
const isInvite = (kind: string | string[] | undefined) => kind === "davet";

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const t = await getTranslations("Auth.reset");
  const invite = isInvite((await searchParams).tur);
  // The address carries a secret token: keep it out of search results and out of referrers.
  return { title: t(invite ? "inviteMetaTitle" : "metaTitle"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const t = await getTranslations("Auth.reset");
  const { token, tur } = await searchParams;
  const invite = isInvite(tur);

  return (
    <AuthShell
      title={t(invite ? "inviteTitle" : "title")}
      subtitle={t(invite ? "inviteSubtitle" : "subtitle")}
      footer={
        <Link href="/giris" className="inline-flex min-h-11 items-center text-link underline underline-offset-4">
          {t("back")}
        </Link>
      }
    >
      <ResetPasswordForm token={typeof token === "string" ? token : ""} invite={invite} />
    </AuthShell>
  );
}
