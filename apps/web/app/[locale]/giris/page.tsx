import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { Link } from "@/i18n/navigation";
import { parseBooking, toBookingQuery } from "@/lib/booking";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.login");
  // Account pages have nothing for a search engine to index.
  return { title: t("metaTitle"), robots: { index: false } };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ searchParams }: Props) {
  const t = await getTranslations("Auth.login");
  // `sonra=odeme` plus the booking: the only place a visitor is sent here from. Anything else
  // is ignored, so the page cannot be used to redirect someone to an address of the
  // attacker's choosing.
  const params = await searchParams;
  const booking = params.sonra === "odeme" ? parseBooking(params) : null;

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
      <LoginForm next={booking ? toBookingQuery(booking) : undefined} />
    </AuthShell>
  );
}
