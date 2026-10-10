import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/legal-page";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("LegalPrivacy");
  return pageMetadata({ href: "/kvkk", title: t("title"), description: t("metaDescription") });
}

export default function Page() {
  return <LegalPage namespace="LegalPrivacy" />;
}
