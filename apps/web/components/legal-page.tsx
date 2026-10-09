import { getFormatter, getTranslations } from "next-intl/server";

// Placeholder texts for a fictional company: the date is fixed so it does not
// pretend to change on every request.
const UPDATED_AT = new Date("2026-10-09T00:00:00Z");

type LegalSection = {
  heading: string;
  paragraphs?: string[];
  list?: string[];
  cookies?: { name: string; purpose: string; duration: string }[];
};

// Keys of the messages that hold a legal page's content (see the `Legal*` namespaces).
type LegalNamespace = "LegalPrivacy" | "LegalCookies" | "LegalTerms";

export async function LegalPage({ namespace }: { namespace: LegalNamespace }) {
  const t = await getTranslations(namespace);
  const common = await getTranslations("LegalPage");
  const format = await getFormatter();
  // Structured content lives in the message files, next to every other UI string.
  const sections = t.raw("sections") as LegalSection[];

  return (
    <div className="mx-auto max-w-content px-4 py-12 md:px-8 xl:py-16">
      <div className="max-w-prose">
        <h1 className="text-h1 text-fg">{t("title")}</h1>
        <p className="mt-3 text-small text-fg-muted">
          {common("updated", {
            date: format.dateTime(UPDATED_AT, {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            }),
          })}
        </p>

        {/* Said up front so nobody mistakes sample text for a real contract. */}
        <p className="mt-6 rounded-card bg-surface-muted p-4 text-small text-fg-muted">
          {common("placeholder")}
        </p>

        <div className="mt-10 flex flex-col gap-10">
          {sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-3">
              <h2 className="text-h2 text-fg">{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="text-body text-fg">
                  {paragraph}
                </p>
              ))}
              {section.list && (
                <ul className="list-disc space-y-2 pl-6 text-body text-fg">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {section.cookies && (
                <ul className="flex flex-col gap-3">
                  {section.cookies.map((cookie) => (
                    <li key={cookie.name} className="rounded-card border border-border bg-surface p-4">
                      <p className="text-label text-fg">
                        <code>{cookie.name}</code>
                      </p>
                      <dl className="mt-3 grid gap-1 text-small">
                        <div>
                          <dt className="inline text-fg-muted">{common("purpose")}: </dt>
                          <dd className="inline text-fg">{cookie.purpose}</dd>
                        </div>
                        <div>
                          <dt className="inline text-fg-muted">{common("duration")}: </dt>
                          <dd className="inline text-fg">{cookie.duration}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
