import { getTranslations } from "next-intl/server";

// Grey horizontal cards where the models will be. `aria-busy` plus a text alternative tells
// screen readers the page is loading; the blocks themselves are decorative.
export default async function Loading() {
  const t = await getTranslations("Vehicle");

  return (
    <div aria-busy="true" className="mx-auto flex max-w-content flex-col gap-10 px-4 py-12 md:px-8 xl:py-20">
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <div aria-hidden="true" className="flex flex-col gap-10">
        <div className="flex flex-col gap-4">
          <div className="h-10 w-64 animate-pulse rounded-control bg-surface-muted" />
          <div className="h-6 w-full max-w-prose animate-pulse rounded-control bg-surface-muted" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-11 w-28 animate-pulse rounded-full bg-surface-muted" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-card bg-surface-muted md:h-44" />
          ))}
        </div>
      </div>
    </div>
  );
}
