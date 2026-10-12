import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ContactForm } from "@/components/contact/contact-form";
import { Headquarters } from "@/components/contact/headquarters";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("ContactPage");
  return pageMetadata({ href: "/iletisim", title: t("metaTitle"), description: t("metaDescription") });
}

// SPEC §2.6, top to bottom: head office and the teams' addresses beside the contact form, then a
// link to the branches (their list and map are on their own page). The form has an anchor so other
// pages can point to it.
export default async function ContactPage() {
  const t = await getTranslations("ContactPage");

  return (
    <div className="mx-auto flex max-w-content flex-col gap-16 px-4 py-12 md:px-8 xl:py-16">
      <header className="flex flex-col gap-3">
        <h1 className="text-h1 text-fg">{t("title")}</h1>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </header>

      <div className="flex flex-col gap-10 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-6 xl:gap-12">
        <Headquarters />
        <section
          id="mesaj"
          aria-labelledby="form-title"
          className="flex scroll-mt-6 flex-col gap-6 rounded-card border border-border bg-surface p-6 md:p-8"
        >
          <header className="flex flex-col gap-2">
            <h2 id="form-title" className="text-h2 text-fg">
              {t("form.title")}
            </h2>
            <p className="text-body text-fg-muted">{t("form.intro")}</p>
          </header>
          <ContactForm />
        </section>
      </div>

      <section aria-labelledby="branches-link-title" className="flex flex-col items-start gap-4 rounded-card bg-surface-muted p-6 md:p-8">
        <h2 id="branches-link-title" className="text-h3 text-fg">
          {t("branchesLink.title")}
        </h2>
        <p className="max-w-prose text-body text-fg-muted">{t("branchesLink.text")}</p>
        <Button asChild variant="outline">
          <Link href="/bayilerimiz">{t("branchesLink.cta")}</Link>
        </Button>
      </section>
    </div>
  );
}
