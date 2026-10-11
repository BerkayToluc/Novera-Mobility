import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { StateMessage } from "@/components/ui/state-message";
import { Link } from "@/i18n/navigation";
import { toQuery } from "@/lib/rental-search";
import type { BookingParams } from "@/lib/booking";

// The two ways a hold can end badly (SPEC §2.3): the 15 minutes ran out, or somebody else got the
// car first. Each names what happened and leads back to the same search, so the visitor does not
// start over.
export async function HoldEnded({ booking, reason }: { booking: BookingParams; reason: "expired" | "taken" }) {
  const t = await getTranslations("HoldStates");

  return (
    <StateMessage title={t(`${reason}.title`)} text={t(`${reason}.text`)}>
      <Button asChild size="lg">
        <Link href={{ pathname: "/araclar", query: toQuery(booking.search) }}>{t("back")}</Link>
      </Button>
    </StateMessage>
  );
}
