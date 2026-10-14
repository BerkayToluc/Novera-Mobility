import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { ProfileHeader } from "@/components/profile/profile-header";
import { ProfileNav } from "@/components/profile/profile-nav";
import { SignedOutNotice } from "@/components/profile/signed-out-notice";
import { getMyPoints } from "@/lib/account-client";
import { getSession } from "@/lib/session";

// One gate for every profile page: without a session the children never render, the visitor
// gets the "sign in" notice instead. With one, the page is a greeting, the way around (a column
// from xl, tabs below it) and the page itself (SPEC §2.9, v0.8).
export default async function ProfileLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("Profile");
  const session = await getSession();

  if (!session) {
    return (
      <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-12 md:px-8 xl:py-16">
        <h1 className="text-h1 text-fg">{t("title")}</h1>
        <SignedOutNotice />
      </div>
    );
  }

  // The balance for the chip in the head; a failure only leaves the chip out (the points page
  // has its own error state).
  let balance: number | null = null;
  if (session.type === "individual") {
    try {
      balance = (await getMyPoints()).balance;
    } catch {
      balance = null;
    }
  }

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-10 md:px-8 xl:py-14">
      <ProfileHeader session={session} balance={balance} />
      <div className="flex flex-col gap-8 xl:grid xl:grid-cols-[15rem_minmax(0,1fr)] xl:gap-12">
        <ProfileNav type={session.type} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
