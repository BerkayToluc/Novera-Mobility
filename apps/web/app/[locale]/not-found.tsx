import { getLocale, getTranslations } from "next-intl/server";
import { HtmlAttrsSync } from "@/components/html-attrs-sync";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getTheme } from "@/lib/get-theme";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <div className="mx-auto flex max-w-content flex-col items-start gap-6 px-4 py-16 md:px-8 xl:py-24">
      <HtmlAttrsSync lang={await getLocale()} theme={await getTheme()} />
      <p className="text-label text-fg-muted">{t("code")}</p>
      <h1 className="text-h1 text-fg">{t("title")}</h1>
      <p className="max-w-prose text-body text-fg-muted">{t("description")}</p>
      <Button asChild size="lg">
        <Link href="/">{t("home")}</Link>
      </Button>
    </div>
  );
}
