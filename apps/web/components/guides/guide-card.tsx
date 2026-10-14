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
    // On hover or focus the card lifts and casts the floating shadow, the title takes the link
    // colour and the "read" arrow steps forward; with reduced motion only the colours change.
    <Card className="group/guide relative flex h-full flex-col transition-[translate,box-shadow,border-color] duration-300 ease-link focus-within:-translate-y-1 focus-within:border-primary focus-within:shadow-float hover:-translate-y-1 hover:border-primary hover:shadow-float motion-reduce:translate-y-0 motion-reduce:transition-colors">
      <CardHeader className="flex-1">
        <CardTitle as={headingAs} className="text-h3">
          <Link
            href={{ pathname: "/rehberler/[slug]", params: { slug } }}
            className="transition-colors after:absolute after:inset-0 after:content-[''] group-hover/guide:text-link"
          >
            {t(`items.${slug}.title`)}
          </Link>
        </CardTitle>
        <CardDescription className="text-body">{t(`items.${slug}.summary`)}</CardDescription>
      </CardHeader>
      <p className="flex items-center gap-2 px-6 pb-6 text-label text-link" aria-hidden="true">
        <span className="underline-offset-4 group-hover/guide:underline group-focus-within/guide:underline">{t("read")}</span>
        <ArrowRight className="size-4 transition-transform duration-300 ease-link group-hover/guide:translate-x-1 group-focus-within/guide:translate-x-1 motion-reduce:transition-none" />
      </p>
    </Card>
  );
}
