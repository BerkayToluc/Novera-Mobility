import { getTranslations } from "next-intl/server";

// Grey blocks laid out like the page they stand in for: the head, the column of links from xl, and
// a wide block and two smaller ones. `aria-busy` plus a text alternative tells screen readers the
// page is loading; the blocks themselves are decorative.
export async function ProfileSkeleton() {
  const t = await getTranslations("Profile");
  const block = "animate-pulse rounded-card bg-surface-muted";

  return (
    <div aria-busy="true" className="flex flex-col gap-8">
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <div aria-hidden="true" className="flex items-center gap-4">
        <div className="size-14 shrink-0 animate-pulse rounded-full bg-surface-muted" />
        <div className="flex flex-1 flex-col gap-2">
          <div className={`${block} h-7 w-2/3 max-w-sm`} />
          <div className={`${block} h-4 w-1/2 max-w-xs`} />
        </div>
      </div>
      <div aria-hidden="true" className="flex flex-col gap-8 xl:grid xl:grid-cols-sidebar xl:gap-12">
        <div className={`${block} h-11 xl:h-48`} />
        <div className="flex flex-col gap-4">
          <div className={`${block} h-36`} />
          <div className="grid gap-4 md:grid-cols-2">
            <div className={`${block} h-28`} />
            <div className={`${block} h-28`} />
          </div>
        </div>
      </div>
    </div>
  );
}
