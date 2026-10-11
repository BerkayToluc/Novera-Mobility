import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { LoginTabs } from "@/components/auth/login-tabs";
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
  const next = booking ? toBookingQuery(booking) : undefined;
  // A booking is only ever paid for by an individual, so the corporate tab does not carry it.
  const corporate = params.tip === "kurumsal" && !booking;

  const linkClasses = "inline-flex min-h-11 items-center text-link underline underline-offset-4";

  return (
    <AuthShell
      title={corporate ? t("corporateTitle") : t("title")}
      subtitle={corporate ? t("corporateSubtitle") : t("subtitle")}
      tabs={<LoginTabs current={corporate ? "corporate" : "individual"} next={next} />}
      footer={
        corporate ? (
          <>
            <p className="max-w-sm text-center">{t("corporateNote")}</p>
            <p>{t("corporateAsk")}</p>
            <Link href="/kurumsal-teklif" className={linkClasses}>
              {t("corporateQuote")}
            </Link>
          </>
        ) : (
          <>
            <p>{t("noAccount")}</p>
            <Link href="/kayit" className={linkClasses}>
              {t("register")}
            </Link>
          </>
        )
      }
    >
      <LoginForm key={corporate ? "corporate" : "individual"} kind={corporate ? "corporate" : "individual"} next={next} />
    </AuthShell>
  );
}
