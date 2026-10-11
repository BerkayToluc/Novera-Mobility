import { Camera, Download, Headset, Siren } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AppArt } from "./app-art";

const POINTS = [
  { key: "report", icon: Camera },
  { key: "sos", icon: Siren },
  { key: "desk", icon: Headset },
] as const;

const STORES = ["appStore", "googlePlay"] as const;

// The mobile-app section (SPEC §2.2, §2.9): what the Novera Driver App is for, with the store
// badges. The company and its app are fictional, so the badges are shown and not linked (as
// the footer's social icons are): a real link would point a visitor at a store page that is
// not there. They say so in words for assistive technology too.
export async function AppPromo() {
  const t = await getTranslations("HomePage.app");

  return (
    <section
      aria-labelledby="app-title"
      className="grid overflow-hidden rounded-card bg-surface-muted md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-stretch"
    >
      <AppArt className="aspect-5/4 w-full md:aspect-auto md:h-full md:min-h-96" />

      <div className="flex flex-col justify-center gap-6 p-6 md:p-10 xl:p-14">
        <header className="flex flex-col gap-3">
          <h2 id="app-title" className="text-h1 text-fg">
            {t("title")}
          </h2>
          <p className="max-w-prose text-body text-fg-muted">{t("text")}</p>
        </header>

        <ul className="flex flex-col gap-3">
          {POINTS.map(({ key, icon: Icon }) => (
            <li key={key} className="flex items-start gap-3 text-body text-fg">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-link">
                <Icon aria-hidden="true" className="size-4" />
              </span>
              {t(`points.${key}`)}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-3">
          <ul className="flex flex-wrap gap-3">
            {STORES.map((store) => (
              <li
                key={store}
                className="inline-flex min-h-12 items-center gap-3 rounded-control bg-band px-4 text-on-band"
              >
                <Download aria-hidden="true" className="size-5 shrink-0" />
                <span className="flex flex-col leading-tight">
                  <span className="text-small text-on-band/80">{t("badgeTop")}</span>
                  <span className="text-label">{t(`stores.${store}`)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-small text-fg-muted">{t("soon")}</p>
        </div>
      </div>
    </section>
  );
}
