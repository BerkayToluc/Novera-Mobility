import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Link } from "@/i18n/navigation";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.reset");
  // The address carries a secret token: keep it out of search results and out of referrers.
  return { title: t("metaTitle"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function ResetPasswordPage({ searchParams }: Props) {
  const t = await getTranslations("Auth.reset");
  const { token } = await searchParams;

  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <Link href="/giris" className="inline-flex min-h-11 items-center text-link underline underline-offset-4">
          {t("back")}
        </Link>
      }
    >
      <ResetPasswordForm token={typeof token === "string" ? token : ""} />
    </AuthShell>
  );
}
