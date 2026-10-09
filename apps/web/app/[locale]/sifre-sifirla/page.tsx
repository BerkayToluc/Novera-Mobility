import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.forgot");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("Auth.forgot");

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
      <ForgotPasswordForm />
    </AuthShell>
  );
}
