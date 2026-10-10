import { Clock, Mail, MapPin, Navigation, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { COMPANY, DEPARTMENTS, HEADQUARTERS, HQ_DIRECTIONS_URL, telHref } from "@/lib/company";

const link = "inline-flex min-h-11 items-center gap-3 text-link underline underline-offset-4";

// The head office and the teams' own addresses (SPEC §2.6). Both are fixed content, so the
// texts are in the messages and the contact details in lib/company.ts.
export async function Headquarters() {
  const t = await getTranslations("ContactPage.hq");

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="hq-title" className="overflow-hidden rounded-card border border-border bg-surface">
        <HeadquartersArt />
        <div className="flex flex-col gap-4 p-6">
          <h2 id="hq-title" className="text-h2 text-fg">
            {t("title")}
          </h2>
          <address className="flex flex-col gap-1 not-italic">
            <p className="flex items-start gap-3 text-body text-fg">
              <MapPin aria-hidden="true" className="mt-1 size-4 shrink-0 text-link" />
              {HEADQUARTERS.address}
            </p>
            <a href={telHref(COMPANY.phone)} className={`${link} tabular-nums`}>
              <Phone aria-hidden="true" className="size-4 shrink-0" />
              {COMPANY.phone}
            </a>
            <a href={`mailto:${COMPANY.email}`} className={link}>
              <Mail aria-hidden="true" className="size-4 shrink-0" />
              {COMPANY.email}
            </a>
            <p className="flex items-center gap-3 text-body text-fg-muted">
              <Clock aria-hidden="true" className="size-4 shrink-0 text-link" />
              {t("hours")}
            </p>
          </address>
          <a href={HQ_DIRECTIONS_URL} target="_blank" rel="noopener noreferrer" className={`${link} self-start`}>
            <Navigation aria-hidden="true" className="size-4 shrink-0" />
            {t("directions")}
            <span className="sr-only"> {t("newTab")}</span>
          </a>
        </div>
      </section>

      <section aria-labelledby="dept-title" className="flex flex-col gap-3">
        <h2 id="dept-title" className="text-h3 text-fg">
          {t("departmentsTitle")}
        </h2>
        <ul className="divide-y divide-border rounded-card border border-border bg-surface">
          {DEPARTMENTS.map(({ key, email }) => (
            <li key={key} className="flex flex-col gap-0.5 px-5 py-3 md:flex-row md:items-center md:justify-between md:gap-6">
              <div>
                <p className="text-label text-fg">{t(`departments.${key}.name`)}</p>
                <p className="text-small text-fg-muted">{t(`departments.${key}.text`)}</p>
              </div>
              <a href={`mailto:${email}`} className="inline-flex min-h-11 items-center text-body text-link underline underline-offset-4">
                {email}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// A placeholder for the head-office photograph (SPEC §6, §10): a few towers against a calm sky,
// in the palette's tokens, until a real photograph arrives. Decorative.
function HeadquartersArt() {
  return (
    <svg viewBox="0 0 640 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="block h-44 w-full md:h-52">
      <rect width="640" height="220" fill="var(--color-selected)" />
      <circle cx="520" cy="62" r="30" fill="var(--color-accent-soft)" />
      <rect x="70" y="110" width="70" height="110" fill="var(--color-primary)" opacity="0.5" />
      <rect x="150" y="70" width="90" height="150" fill="var(--color-primary)" />
      <rect x="250" y="95" width="70" height="125" fill="var(--color-primary)" opacity="0.7" />
      <rect x="330" y="45" width="100" height="175" fill="var(--color-band)" />
      <rect x="440" y="120" width="80" height="100" fill="var(--color-primary)" opacity="0.5" />
      {[170, 195, 220].flatMap((x) =>
        [90, 120, 150, 180].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="12" height="14" rx="2" fill="var(--color-surface)" opacity="0.75" />),
      )}
      {[352, 380, 408].flatMap((x) =>
        [65, 100, 135, 170].map((y) => <rect key={`b${x}-${y}`} x={x} y={y} width="14" height="16" rx="2" fill="var(--color-band-accent)" opacity="0.8" />),
      )}
      <rect y="206" width="640" height="14" fill="var(--color-surface-muted)" />
    </svg>
  );
}
