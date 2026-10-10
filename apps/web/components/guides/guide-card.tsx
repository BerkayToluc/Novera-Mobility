import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { GuideSlug } from "@/lib/guides";

type GuideCardProps = {
  slug: GuideSlug;
  // The heading level depends on where the card sits (a page of its own, or a home section).
  headingAs?: "h2" | "h3";
};

// The whole card is one link (the stretched ::after), so the target is large and the title names it.
export async function GuideCard({ slug, headingAs = "h2" }: GuideCardProps) {
  const t = await getTranslations("GuidesPage");

  return (
    <Card className="relative flex h-full flex-col transition-colors focus-within:border-primary hover:border-primary">
      <CardHeader className="flex-1">
        <CardTitle as={headingAs} className="text-h3">
          <Link
            href={{ pathname: "/rehberler/[slug]", params: { slug } }}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {t(`items.${slug}.title`)}
          </Link>
        </CardTitle>
        <CardDescription className="text-body">{t(`items.${slug}.summary`)}</CardDescription>
      </CardHeader>
      <p className="flex items-center gap-2 px-6 pb-6 text-label text-link" aria-hidden="true">
        {t("read")}
        <ArrowRight className="size-4" />
      </p>
    </Card>
  );
}
