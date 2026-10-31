import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { StatusChip } from "@/components/admin/status-chip";
import { UserActions } from "@/components/admin/user-actions";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { AdminUserDetail } from "@/lib/admin-users";
import { getAdminUser } from "@/lib/admin-server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.users");
  return { title: t("detailTitle") };
}

export default async function UserPage({ params }: PageProps<"/[locale]/yonetim/kullanicilar/[id]">) {
  const t = await getTranslations("Admin.users");
  const locale = await getLocale();
  const { id } = await params;

  // Only the fetch sits in the try: a failure to load is an expected state with its own UI, while a rendering bug should still
  // reach the segment's error boundary. An account that does not exist is a page that does not exist.
  let user: AdminUserDetail | null;
  let failed = false;
  try {
    user = await getAdminUser(id);
  } catch {
    user = null;
    failed = true;
  }
  if (!user && !failed) notFound();

  if (!user) {
    return (
      <>
        <PageHeader title={t("detailTitle")} />
        <StateMessage tone="error" title={t("loadErrorTitle")} text={t("loadErrorText")}>
          <Button asChild>
            <Link href={{ pathname: "/yonetim/kullanicilar/[id]", params: { id } }}>{t("retry")}</Link>
          </Button>
        </StateMessage>
      </>
    );
  }

  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" });
  const how = [user.hasPassword ? t("facts.withPassword") : null, user.googleLinked ? t("facts.withGoogle") : null].filter(Boolean).join(", ");
  const facts: Array<[string, string]> = [
    [t("facts.email"), user.email],
    [t("facts.type"), t(`type.${user.type}`)],
    [t("facts.company"), user.company?.name ?? "—"],
    [t("facts.title"), user.title ?? "—"],
    [t("facts.signIn"), how || t("facts.noSignIn")],
    [t("facts.reservations"), t("facts.reservationsValue", { total: user.reservations.total, upcoming: user.reservations.upcoming })],
    [t("facts.points"), String(user.points)],
    [t("facts.created"), dateTime.format(new Date(user.createdAt))],
    ...(user.disabledAt ? ([[t("facts.disabled"), dateTime.format(new Date(user.disabledAt))]] as Array<[string, string]>) : []),
  ];

  return (
    <>
      <PageHeader
        title={`${user.firstName} ${user.lastName}`}
        description={t("detailIntro")}
        action={<StatusChip tone={user.status === "ACTIVE" ? "success" : "error"}>{t(`status.${user.status}`)}</StatusChip>}
      />

      <section aria-labelledby="user-facts" className="flex max-w-2xl flex-col gap-3">
        <h2 id="user-facts" className="text-h3 text-fg">
          {t("facts.title")}
        </h2>
        <dl className="grid gap-3 rounded-card border border-border p-4 md:grid-cols-2">
          {facts.map(([term, value]) => (
            <div key={term}>
              <dt className="text-small text-fg-muted">{term}</dt>
              <dd className="break-words text-body text-fg">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Keyed by the state: after closing or opening, the window starts again from what is stored. */}
      <UserActions key={user.status} user={user} />
    </>
  );
}
