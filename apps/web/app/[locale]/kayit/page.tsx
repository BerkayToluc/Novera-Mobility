import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.register");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function RegisterPage() {
  const t = await getTranslations("Auth.register");

  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <>
          <p>{t("hasAccount")}</p>
          <Link
            href="/giris"
            className="inline-flex min-h-11 items-center text-link underline underline-offset-4"
          >
            {t("login")}
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
