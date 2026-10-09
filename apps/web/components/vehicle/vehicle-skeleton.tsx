import { getTranslations } from "next-intl/server";

// Grey cards where the vehicles will be. `aria-busy` plus a text alternative tells screen
// readers the list is loading; the blocks themselves are decorative.
export async function VehicleSkeleton({ count = 6 }: { count?: number }) {
  const t = await getTranslations("Vehicle");

  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      <div aria-hidden="true" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="h-80 animate-pulse rounded-card bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}
