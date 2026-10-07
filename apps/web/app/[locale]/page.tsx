import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("HomePage");

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 px-4 py-16 md:px-8 xl:py-24">
      <h1 className="text-display text-fg">{t("title")}</h1>
    </div>
  );
}
