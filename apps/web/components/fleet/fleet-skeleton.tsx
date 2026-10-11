import { getTranslations } from "next-intl/server";

// Grey blocks where the heading, the chips and the model cards will be. `aria-busy` plus a text
// alternative tells screen readers the section is loading; the blocks themselves are decorative.
export async function FleetSkeleton() {
  const t = await getTranslations("Vehicle");

  return (
    <div aria-busy="true" className="flex flex-col gap-8">
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <div aria-hidden="true" className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <div className="h-10 w-64 animate-pulse rounded-control bg-surface-muted" />
          <div className="h-6 w-full max-w-prose animate-pulse rounded-control bg-surface-muted" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-11 w-28 animate-pulse rounded-full bg-surface-muted" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-card bg-surface-muted md:h-44" />
          ))}
        </div>
      </div>
    </div>
  );
}
