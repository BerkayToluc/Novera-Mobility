import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";

// Shown instead of the profile when nobody is signed in. Sending the visitor back to the
// page they wanted after signing in is BACKLOG #26.
export async function SignedOutNotice() {
  const t = await getTranslations("Profile.signedOut");

  return (
    <StateMessage title={t("title")} text={t("text")}>
      <Button asChild size="lg">
        <Link href="/giris">{t("login")}</Link>
      </Button>
    </StateMessage>
  );
}
