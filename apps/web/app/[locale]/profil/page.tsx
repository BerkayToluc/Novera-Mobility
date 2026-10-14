import type { Metadata } from "next";
import { LifeBuoy, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AccountForm } from "@/components/profile/account-form";
import { CompanyAccount } from "@/components/profile/company-account";
import { NextTrip } from "@/components/profile/next-trip";
import { Link } from "@/i18n/navigation";
import { getMyReservations } from "@/lib/account-client";
import { currentTime } from "@/lib/clock";
import type { Reservation } from "@/lib/reservation";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Profile.nav");
  const session = await getSession();
  return { title: session?.type === "corporate" ? t("company") : t("account"), robots: { index: false } };
}

export default async function AccountPage() {
  const t = await getTranslations("Profile.account");
  const q = await getTranslations("Profile.quick");
  const session = await getSession();
  // The layout already shows the "sign in" notice without a session; this narrows the type.
  if (!session) return null;
  if (session.type === "corporate") return <CompanyAccount session={session} />;

  // The next trip needs the bookings; if they cannot be fetched the card is left out, and the
  // bookings page has its own error state.
  let reservations: Reservation[] | null;
  try {
    reservations = await getMyReservations();
  } catch {
    reservations = null;
  }

  const quick = [
    { href: { pathname: "/", hash: "kiralama" }, icon: Plus, label: q("newRental"), text: q("newRentalText") },
    { href: "/yardim", icon: LifeBuoy, label: q("help"), text: q("helpText") },
  ] as const;

  return (
    <div className="flex flex-col gap-10">
      {reservations && <NextTrip reservations={reservations} now={currentTime()} />}

      <section aria-labelledby="quick-title" className="flex flex-col gap-4">
        <h2 id="quick-title" className="text-h3 text-fg">
          {q("title")}
        </h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {quick.map(({ href, icon: Icon, label, text }) => (
            <li key={label}>
              <Link
                href={href}
                className="group flex h-full items-start gap-4 rounded-card border border-border bg-surface p-5 transition-colors hover:border-primary hover:bg-surface-muted"
              >
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-control bg-selected text-on-selected">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-label text-fg">{label}</span>
                  <span className="text-small text-fg-muted">{text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="account-title" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 id="account-title" className="text-h3 text-fg">
            {t("title")}
          </h2>
          <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
        </div>
        <AccountForm user={session.user} />
      </section>
    </div>
  );
}
