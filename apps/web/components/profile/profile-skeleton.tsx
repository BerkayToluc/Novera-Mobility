import { getTranslations } from "next-intl/server";

// Grey blocks where the content will be. `aria-busy` plus a text alternative tells screen
// readers the page is loading; the blocks themselves are decorative.
export async function ProfileSkeleton() {
  const t = await getTranslations("Profile");

  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <p role="status" className="sr-only">
        {t("loading")}
      </p>
      {[0, 1, 2].map((index) => (
        <div key={index} aria-hidden="true" className="h-28 animate-pulse rounded-card bg-surface-muted" />
      ))}
    </div>
  );
}
