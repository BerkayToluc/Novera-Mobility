import { getTranslations } from "next-intl/server";

export default async function Loading() {
  const t = await getTranslations("ContactPage");

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-4 py-12 md:px-8 xl:py-16" aria-busy="true">
      <h1 className="text-h1 text-fg">{t("title")}</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-56 animate-pulse rounded-card bg-surface-muted motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}
