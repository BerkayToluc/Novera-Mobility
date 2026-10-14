import { Coins } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pointsWorth } from "@/lib/points";
import { formatMoney } from "@/lib/price";
import type { Session } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

// The head of the profile (SPEC §2.9, v0.8): a round badge with the initials, a greeting and the
// e-mail under it, and on the right the points with what they are worth (individual accounts) and
// the sign-out button. A corporate account is greeted by its company.
export async function ProfileHeader({ session, balance }: { session: Session; balance: number | null }) {
  const t = await getTranslations("Profile");
  const format = await getFormatter();
  const locale = await getLocale();
  const { firstName, lastName, email } = session.user;
  const corporate = session.type === "corporate" && session.company;
  const name = corporate ? session.company!.name : firstName;
  const initials = corporate
    ? session.company!.name.slice(0, 2)
    : `${firstName.charAt(0)}${lastName.charAt(0)}`;

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 items-center gap-4">
        <span
          aria-hidden="true"
          className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-h3 text-on-primary"
        >
          {initials.toLocaleUpperCase(locale)}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-h1 text-fg">{t("welcome", { name })}</h1>
          <p className="truncate text-body text-fg-muted">{email}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {balance !== null && (
          <Link
            href="/profil/puanlar"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-selected px-4 text-label tabular-nums text-on-selected transition-colors hover:bg-border"
          >
            <Coins aria-hidden="true" className="size-4" />
            {t("pointsChip", { points: format.number(balance), worth: formatMoney(format, pointsWorth(balance)) })}
          </Link>
        )}
        <SignOutButton />
      </div>
    </header>
  );
}
