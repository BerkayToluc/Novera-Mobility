import { getTranslations } from "next-intl/server";
import { ProductBadge } from "@/components/product-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { ProductSlug } from "@/lib/products";

type ProductCardProps = {
  slug: ProductSlug;
  // The featured product is drawn larger and wider so it reads as the recommended one.
  featured?: boolean;
  // The heading level depends on where the card sits (a page of its own, or a home section).
  headingAs?: "h2" | "h3";
};

export async function ProductCard({ slug, featured = false, headingAs = "h2" }: ProductCardProps) {
  const t = await getTranslations("ProductsPage");
  const title = t(`items.${slug}.title`);

  return (
    <Card className={featured ? "bg-surface-muted md:flex md:items-center md:justify-between" : "flex flex-col"}>
      <div className={featured ? "md:max-w-prose" : "flex flex-1 flex-col"}>
        <CardHeader>
          {featured && <ProductBadge>{t("featuredBadge")}</ProductBadge>}
          <CardTitle as={headingAs} className={featured ? "text-h2" : undefined}>
            {title}
          </CardTitle>
          <CardDescription className="text-body">{t(`items.${slug}.summary`)}</CardDescription>
        </CardHeader>
        {!featured && <CardContent className="flex-1" />}
      </div>
      <CardFooter className={featured ? "pt-0 md:p-6" : undefined}>
        <Button asChild variant={featured ? "primary" : "outline"}>
          <Link href={{ pathname: "/urunler/[slug]", params: { slug } }}>
            {t("viewDetails")}
            {/* Several links share this text, so the product name makes each one distinct. */}
            <span className="sr-only">: {title}</span>
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
