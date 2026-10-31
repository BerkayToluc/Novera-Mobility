"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

// Opens the browser's print window for the invoice on screen. The print rules (globals.css) leave only the invoice on the page.
export function PrintButton() {
  const t = useTranslations("Admin.invoices");
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <Printer aria-hidden="true" className="size-4" />
      {t("print")}
    </Button>
  );
}
