import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
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
  const nonce = (await headers()).get("x-nonce") ?? undefined;

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
      <div className="flex flex-col gap-6">
        <RegisterForm next={next} />
        <GoogleSignIn clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || null} sample={process.env.USE_MOCKS === "1"} nonce={nonce} next={next} />
      </div>
    </AuthShell>
  );
}
