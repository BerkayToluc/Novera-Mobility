import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { Link } from "@/i18n/navigation";
import { parseBooking, toBookingQuery } from "@/lib/booking";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.register");
  return { title: t("metaTitle"), robots: { index: false } };
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RegisterPage({ searchParams }: Props) {
  const t = await getTranslations("Auth.register");
  // The same way back to the payment page as on the sign-in page, and nowhere else.
  const params = await searchParams;
  const booking = params.sonra === "odeme" ? parseBooking(params) : null;
  const next = booking ? toBookingQuery(booking) : undefined;

  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
      footer={
        <>
          <p>{t("hasAccount")}</p>
          <Link
            href={{ pathname: "/giris", query: next ? { sonra: "odeme", ...next } : undefined }}
            className="inline-flex min-h-11 items-center text-link underline underline-offset-4"
          >
            {t("login")}
          </Link>
        </>
      }
    >
      <RegisterForm next={next} />
    </AuthShell>
  );
}
