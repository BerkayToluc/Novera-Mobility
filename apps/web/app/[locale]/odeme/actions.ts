"use server";

import { z } from "zod";
import { loadBooking } from "@/lib/booking-data";
import { checkEligibility, isIsoDate, rentalStartDate, type EligibilityReason } from "@/lib/driver-eligibility";
import { LICENCE_COUNTRIES, needsInternationalPermit, requirementsFor, type LicenceCountry } from "@/lib/driver-rules";
import { getCurrency } from "@/lib/get-currency";
import { VehicleUnavailableError } from "@/lib/hold-client";
import { verifyLicence, type LicenceStatus } from "@/lib/licence-client";
import {
  createReservation,
  PastStartError,
  PromoCodeError,
  ReservationLimitError,
  ReservationRateLimitedError,
} from "@/lib/reservation-client";
import { getSession } from "@/lib/session";

// What the driver section sends along with the booking. It is checked again here, in its plainest
// form: the browser's check is for the visitor's comfort, this one is the one that counts. None of
// it is stored, logged or put in an address (SPEC §2.10).
const bookingParams = z.record(z.string(), z.string());

const driverBody = z.object({
  birthDate: z.string().refine(isIsoDate),
  country: z.enum(LICENCE_COUNTRIES),
  licenceNumber: z.string().trim().regex(/^[A-Za-z0-9]{6,12}$/),
  licenceIssuedAt: z.string().refine(isIsoDate),
  permit: z.boolean(),
});

export type DriverBody = z.input<typeof driverBody>;

export type PlaceReservationResult =
  | { ok: true; number: string }
  // `expired`: the 15-minute hold ran out; `taken`: someone else got the car (SPEC §2.3).
  | { ok: false; reason: "invalid" | "signin" | "unavailable" | "expired" | "taken" | "promo" | "promoExhausted" | "promoUsed" | "pastStart" | "limit" | "rateLimited"; retryAfter?: number | null }
  // The driver does not meet the class's conditions for the licence's country, or the check of the
  // licence did not come back valid (SPEC §2.10).
  | { ok: false; reason: "ineligible"; reasons: EligibilityReason[] }
  | { ok: false; reason: "not_verified"; status: Exclude<LicenceStatus, "valid"> };

// The simulated licence check, for the "check my licence" button. Takes only what the check needs.
export async function checkLicence(input: {
  country: LicenceCountry;
  licenceNumber: string;
  licenceIssuedAt: string;
}): Promise<LicenceStatus> {
  const parsed = driverBody.pick({ country: true, licenceNumber: true, licenceIssuedAt: true }).safeParse(input);
  if (!parsed.success) return "not_found";
  return verifyLicence({
    country: parsed.data.country,
    number: parsed.data.licenceNumber,
    issuedAt: parsed.data.licenceIssuedAt,
  });
}

// Takes the booking from the URL and the driver's details from the form (never card details: those
// stay in the browser). The booking is loaded again here rather than trusted, so prices come from
// the server, and the driver is checked against the car's class before the reservation is made.
export async function placeReservation(
  params: Record<string, string>,
  driver: DriverBody,
): Promise<PlaceReservationResult> {
  // Same rule as the payment page: nobody pays without being signed in, sample mode included.
  if (!(await getSession())) return { ok: false, reason: "signin" };

  const booking = bookingParams.safeParse(params);
  if (!booking.success) return { ok: false, reason: "invalid" };

  const loaded = await loadBooking(booking.data, await getCurrency());
  if (loaded.status === "missing") return { ok: false, reason: "invalid" };
  if (loaded.status === "expired") return { ok: false, reason: "expired" };
  if (loaded.status === "error") return { ok: false, reason: "unavailable" };

  const parsed = driverBody.safeParse(driver);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  const details = parsed.data;

  const requirements = requirementsFor(details.country);
  const eligibility = checkEligibility(details, requirements, rentalStartDate(loaded.booking.search.startAt));
  if (!eligibility.ok) return { ok: false, reason: "ineligible", reasons: eligibility.reasons };
  // A country that asks for an international permit gets no reservation without the declaration.
  if (needsInternationalPermit(details.country) && !details.permit) {
    return { ok: false, reason: "ineligible", reasons: [] };
  }

  const status = await verifyLicence({ country: details.country, number: details.licenceNumber, issuedAt: details.licenceIssuedAt });
  if (status !== "valid") return { ok: false, reason: "not_verified", status };

  try {
    return { ok: true, ...(await createReservation(loaded)) };
  } catch (error) {
    if (error instanceof VehicleUnavailableError) return { ok: false, reason: "taken" };
    if (error instanceof PromoCodeError) {
      return { ok: false, reason: error.problem === "exhausted" ? "promoExhausted" : error.problem === "used" ? "promoUsed" : "promo" };
    }
    if (error instanceof PastStartError) return { ok: false, reason: "pastStart" };
    if (error instanceof ReservationLimitError) return { ok: false, reason: "limit" };
    if (error instanceof ReservationRateLimitedError) return { ok: false, reason: "rateLimited", retryAfter: error.retryAfter };
    return { ok: false, reason: "unavailable" };
  }
}
