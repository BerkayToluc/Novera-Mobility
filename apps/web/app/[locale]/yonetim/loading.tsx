import { getTranslations } from "next-intl/server";

// Grey blocks laid out like the summary: the head and the grid of cards. `aria-busy` plus a text alternative tells screen
// readers the page is loading; the blocks themselves are decorative.
export default async function Loading() {
  const t = await getTranslations("Admin.summary");
  const block = "animate-pulse rounded-card bg-surface-muted";

  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <div aria-hidden="true" className={block + " h-10 w-2/3 max-w-sm"} />
      <div aria-hidden="true" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className={block + " h-32"} />
        <div className={block + " h-32"} />
        <div className={block + " h-32"} />
      </div>
    </div>
  );
}
