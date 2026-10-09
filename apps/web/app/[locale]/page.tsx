import { getTranslations } from "next-intl/server";
import { RentalSearchForm } from "@/components/rental/rental-search-form";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import type { BranchOption } from "@/lib/branch-options";
import { getCurrency } from "@/lib/get-currency";
import { getBranchOptions } from "@/lib/rental-data";

export default async function Home() {
  const t = await getTranslations("HomePage");
  const currency = await getCurrency();

  // Only the fetch sits in the try: not reaching the branches is an expected state with its
  // own message, while a rendering bug should still reach the error boundary.
  let branches: BranchOption[] | null;
  try {
    branches = await getBranchOptions(currency);
  } catch {
    branches = null;
  }

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-12 md:px-8 xl:py-20">
      <header className="flex flex-col gap-3">
        <h1 className="text-display text-fg">{t("title")}</h1>
        <p className="max-w-prose text-body text-fg-muted">{t("intro")}</p>
      </header>

      <div className="max-w-3xl rounded-card border border-border bg-surface p-6 md:p-8">
        {branches ? (
          <RentalSearchForm branches={branches} />
        ) : (
          <StateMessage tone="error" title={t("error.title")} text={t("error.text")}>
            <Button asChild>
              <Link href="/">{t("error.retry")}</Link>
            </Button>
          </StateMessage>
        )}
      </div>
    </div>
  );
}
