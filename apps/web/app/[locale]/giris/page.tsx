import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { Link } from "@/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.login");
  // Account pages have nothing for a search engine to index.
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function LoginPage() {
  const t = await getTranslations("Auth.login");

  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <>
          <p>{t("noAccount")}</p>
          <Link
            href="/kayit"
            className="inline-flex min-h-11 items-center text-link underline underline-offset-4"
          >
            {t("register")}
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
