import { Mail } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { ContactLink } from "@/components/ui/contact-link";
import { Link } from "@/i18n/navigation";
import { DEPARTMENTS } from "@/lib/company";
import type { Session } from "@/lib/session";

// The corporate account page (SPEC §2.9): who the company is and who speaks for it. Read-only
// on purpose, because Novera opens and maintains the account after the sales conversation.
export async function CompanyAccount({ session }: { session: Session }) {
  const t = await getTranslations("Profile.company");
  const locale = (await getLocale()) as "tr" | "en";
  const { company, user } = session;
  if (!company) return null;

  const title = company.contactTitle;
  const contactTitle = typeof title === "string" ? title : title?.[locale];
  const rows = [
    { label: t("name"), value: company.name },
    { label: t("taxOffice"), value: company.taxOffice },
    { label: t("city"), value: company.city },
    { label: t("phone"), value: company.phone },
    {
      label: t("contactPerson"),
      value: contactTitle ? `${user.firstName} ${user.lastName}, ${contactTitle}` : `${user.firstName} ${user.lastName}`,
    },
    { label: t("email"), value: user.email },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));

  return (
    <section aria-labelledby="company-title" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 id="company-title" className="text-h2 text-fg">
          {t("title")}
        </h2>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <dl className="grid gap-px overflow-hidden rounded-card border border-border bg-border md:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-1 bg-surface p-5">
              <dt className="text-small text-fg-muted">{row.label}</dt>
              <dd className="text-body text-fg">{row.value}</dd>
            </div>
          ))}
        </dl>

        <aside className="flex h-fit flex-col items-start gap-4 rounded-card bg-surface-muted p-6">
          <span className="inline-flex size-11 items-center justify-center rounded-full bg-surface text-link">
            <Mail aria-hidden="true" className="size-5" />
          </span>
          <h3 className="text-h3 text-fg">{t("salesTitle")}</h3>
          <p className="text-body text-fg-muted">{t("salesText")}</p>
          <ContactLink value={company.salesContact ?? DEPARTMENTS[1].email} icon={false} className="text-link underline underline-offset-4" />
          <Button asChild variant="outline">
            <Link href={{ pathname: "/iletisim", hash: "mesaj" }}>{t("changeButton")}</Link>
          </Button>
        </aside>
      </div>
    </section>
  );
}
