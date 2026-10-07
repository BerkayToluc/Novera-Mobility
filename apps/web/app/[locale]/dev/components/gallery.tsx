"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { DateRange } from "react-day-picker";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { TimeSelect } from "@/components/ui/time-select";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-h2 text-fg">{title}</h2>
      {children}
    </section>
  );
}

export function Gallery() {
  const t = useTranslations("DevGallery");
  const [audience, setAudience] = useState<"individual" | "corporate">("individual");
  const [range, setRange] = useState<DateRange | undefined>();

  return (
    <main className="mx-auto flex max-w-content flex-col gap-12 px-4 py-12 md:px-8 xl:py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 text-fg">{t("title")}</h1>
        <p className="text-body text-fg-muted">{t("intro")}</p>
      </header>

      <Section title={t("buttons")}>
        <div className="flex flex-wrap items-center gap-3">
          <Button>{t("primary")}</Button>
          <Button variant="outline">{t("outline")}</Button>
          <Button variant="ghost">{t("ghost")}</Button>
          <Button variant="link">{t("link")}</Button>
          <Button size="lg">{t("large")}</Button>
          <Button disabled>{t("disabled")}</Button>
          <Button variant="outline" disabled>
            {t("disabled")}
          </Button>
        </div>
      </Section>

      <Section title={t("cards")}>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle as="h3">{t("cardTitle")}</CardTitle>
              <CardDescription>{t("cardDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-h3 tabular-nums text-fg">{t("cardPrice")}</p>
            </CardContent>
            <CardFooter>
              <Button variant="outline">{t("cardAction")}</Button>
            </CardFooter>
          </Card>
        </div>
      </Section>

      <Section title={t("forms")}>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Field label={t("emailLabel")} hint={t("emailHint")}>
            {(props) => <Input type="email" placeholder={t("emailPlaceholder")} {...props} />}
          </Field>
          <Field label={t("emailLabel")} error={t("emailError")}>
            {(props) => <Input type="email" defaultValue="ad@" {...props} />}
          </Field>
          <Field label={t("lockedLabel")}>
            {(props) => <Input defaultValue={t("lockedValue")} disabled {...props} />}
          </Field>
          <Field label={t("fleetLabel")}>
            {(props) => (
              <Select {...props}>
                <option>{t("fleetOption1")}</option>
                <option>{t("fleetOption2")}</option>
                <option>{t("fleetOption3")}</option>
              </Select>
            )}
          </Field>
        </div>
      </Section>

      <Section title={t("segmented")}>
        <SegmentedControl
          label={t("segmentedLabel")}
          value={audience}
          onChange={setAudience}
          options={[
            { value: "individual", label: t("individual") },
            { value: "corporate", label: t("corporate") },
          ]}
        />
      </Section>

      <Section title={t("picker")}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("pickerLabel")} className="md:col-span-2">
            {({ id, ...props }, { labelId }) => (
              <DateRangePicker
                id={id}
                labelledBy={labelId}
                value={range}
                onChange={setRange}
                {...props}
              />
            )}
          </Field>
          <Field label={t("pickupTime")}>
            {(props) => <TimeSelect defaultValue="10:00" {...props} />}
          </Field>
          <Field label={t("returnTime")}>
            {(props) => <TimeSelect defaultValue="10:00" {...props} />}
          </Field>
        </div>
      </Section>

      <Section title={t("accordion")}>
        <Accordion>
          <AccordionItem name="faq" title={t("faq1Title")} open>
            {t("faq1Body")}
          </AccordionItem>
          <AccordionItem name="faq" title={t("faq2Title")}>
            {t("faq2Body")}
          </AccordionItem>
          <AccordionItem name="faq" title={t("faq3Title")}>
            {t("faq3Body")}
          </AccordionItem>
        </Accordion>
      </Section>
    </main>
  );
}
