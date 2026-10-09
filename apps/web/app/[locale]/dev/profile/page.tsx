import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AccountForm } from "@/components/profile/account-form";
import { ProfileNav } from "@/components/profile/profile-nav";
import { ProfileSkeleton } from "@/components/profile/profile-skeleton";
import { ReservationList } from "@/components/profile/reservation-list";
import { SettingsView } from "@/components/profile/settings-view";
import { StateMessage } from "@/components/ui/state-message";
import type { Reservation } from "@/lib/reservation";

// Sample data: no one can sign in yet, so this is the only place the signed-in views show.
const USER = { id: "demo", firstName: "Ayşe", lastName: "Demir", email: "ayse@example.com" };

const RESERVATIONS: Reservation[] = [
  {
    id: "1",
    number: "NVR-2026-00123",
    status: "CONFIRMED",
    // 21:30 UTC is already the next day in Istanbul (UTC+3) but not in Warsaw (UTC+2) or UTC: it must read "12 Eki", which proves the configured zone is used and not the server one.
    startAt: "2026-10-11T21:30:00Z",
    endAt: "2026-10-14T21:30:00Z",
    days: 3,
    totalPrice: { amount: 375000, currency: "TRY" },
    vehicle: { brand: "Renault", model: "Clio" },
    pickupCity: "İzmir",
    returnCity: "Ankara",
  },
  {
    id: "2",
    number: "NVR-2026-00087",
    status: "CANCELLED",
    startAt: "2026-09-02T09:30:00Z",
    endAt: "2026-09-04T09:30:00Z",
    days: 2,
    totalPrice: { amount: 250000, currency: "TRY" },
    vehicle: { brand: "Toyota", model: "Corolla Hybrid" },
    pickupCity: "İstanbul",
    returnCity: "İstanbul",
  },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-h2 text-fg">{title}</h2>
      {children}
    </section>
  );
}

// Visual check of the signed-in profile views and their states; 404 in production.
export default async function ProfileGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const t = await getTranslations("Profile.bookings");

  return (
    <div className="mx-auto flex max-w-content flex-col gap-12 px-4 py-12 md:px-8">
      <h1 className="text-h1 text-fg">Profile gallery</h1>
      <Section title="Navigation">
        <ProfileNav />
      </Section>
      <Section title="Account">
        <AccountForm user={USER} />
      </Section>
      <Section title="Bookings: list">
        <ReservationList reservations={RESERVATIONS} />
      </Section>
      <Section title="Bookings: empty">
        <ReservationList reservations={[]} />
      </Section>
      <Section title="Bookings: error">
        <StateMessage tone="error" title={t("error.title")} text={t("error.text")} />
      </Section>
      <Section title="Loading">
        <ProfileSkeleton />
      </Section>
      <Section title="Settings">
        <SettingsView />
      </Section>
    </div>
  );
}
