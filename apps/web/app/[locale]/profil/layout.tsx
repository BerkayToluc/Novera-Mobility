import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { ProfileNav } from "@/components/profile/profile-nav";
import { SignedOutNotice } from "@/components/profile/signed-out-notice";
import { getSession } from "@/lib/session";

// One gate for every profile page: without a session the children never render, the
// visitor gets the "sign in" notice instead.
export default async function ProfileLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("Profile");
  const session = await getSession();

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-12 md:px-8 xl:py-16">
      <h1 className="text-h1 text-fg">{t("title")}</h1>
      {session ? (
        <>
          <ProfileNav />
          {children}
        </>
      ) : (
        <SignedOutNotice />
      )}
    </div>
  );
}
