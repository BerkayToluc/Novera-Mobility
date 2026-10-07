import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { getTheme } from "@/lib/get-theme";

export default async function Home() {
  const t = await getTranslations("HomePage");
  const theme = await getTheme();

  return (
    <main className="mx-auto flex max-w-content flex-col gap-6 px-4 py-16 md:px-8 xl:py-24">
      {/* The green logo disappears on the dark canvas, so the effective dark theme swaps in the white version. */}
      <div>
        {/* `unoptimized`: SVGs need no resizing, and it keeps the plain <img> the logo always was. */}
        <Image
          src="/brand/novera-logo.svg"
          alt=""
          width={240}
          height={66}
          className="dark:hidden"
          unoptimized
        />
        <Image
          src="/brand/novera-logo-white.svg"
          alt=""
          width={240}
          height={66}
          className="hidden dark:block"
          unoptimized
        />
      </div>
      <h1 className="text-display text-fg">{t("title")}</h1>
      {/* Temporary home for both switchers until the footer exists (BACKLOG #10). */}
      <LocaleSwitcher />
      <ThemeSwitcher initialTheme={theme} />
    </main>
  );
}
