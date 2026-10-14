import type { ReactNode } from "react";
import { getFormatter, getTranslations } from "next-intl/server";
import type { Money } from "@/lib/currency";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/price";
import type { Vehicle, VehicleOffer } from "@/lib/vehicle";

// The price of a car on the results page (SPEC §2.3, G): the total for the rental first and large,
// then the daily price under it, then what is included. Without dates (no offer) only the daily
// price exists and it leads. With points chosen, a line says how many and what is left in money.
export async function VehiclePrice({
  vehicle,
  fromPrice,
  note,
  pointsPayment,
  align = "start",
}: {
  vehicle: Vehicle | VehicleOffer;
  // On the fleet page a model is shown once, at the lowest price among its cars.
  fromPrice?: Money;
  note?: ReactNode;
  pointsPayment?: { points: number; rest: Money };
  align?: "start" | "end";
}) {
  const t = await getTranslations("Vehicle");
  const format = await getFormatter();
  const offer = "totalPrice" in vehicle ? vehicle : null;
  const daily = fromPrice
    ? t("fromPerDay", { price: formatMoney(format, fromPrice) })
    : t("perDay", { price: formatMoney(format, vehicle.dailyPrice) });

  return (
    <div className={cn("flex flex-col gap-0.5", align === "end" && "xl:items-end xl:text-right")}>
      {offer ? (
        <>
          <span className="text-small text-fg-muted">{t("totalLabel", { days: offer.days })}</span>
          {/* With points chosen the full total is struck through and what is left to pay stands beside it. */}
          <p className={cn("flex flex-wrap items-baseline gap-x-3 gap-y-1", align === "end" && "xl:justify-end")}>
            {pointsPayment ? (
              <>
                <del data-total="" className="text-h3 tabular-nums text-fg-muted">
                  {formatMoney(format, offer.totalPrice)}
                </del>
                <strong className="text-h3 tabular-nums text-fg">
                  {t("pointsPayment", {
                    points: format.number(pointsPayment.points),
                    price: formatMoney(format, pointsPayment.rest),
                  })}
                </strong>
              </>
            ) : (
              <span data-total="" className="text-h2 tabular-nums text-fg">
                {formatMoney(format, offer.totalPrice)}
              </span>
            )}
          </p>
          <p className="text-body tabular-nums text-fg-muted">{daily}</p>
        </>
      ) : (
        <p className="text-h3 tabular-nums text-fg">{daily}</p>
      )}
      {note && <p className="text-small text-fg-muted">{note}</p>}
      <p className="text-small text-fg-muted">{t("vatIncluded")}</p>
    </div>
  );
}
