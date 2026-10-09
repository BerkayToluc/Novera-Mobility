import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { z } from "zod";
import { localToInstant, type RentalSearch } from "./rental-search";

export type RentalSearchErrorMessages = {
  pickupBranch: string;
  returnBranch: string;
  dates: string;
  // The return moment is not after the pick-up moment.
  order: string;
};

export const DEFAULT_TIME = "10:00";

const isRange = (value: unknown): value is DateRange =>
  typeof value === "object" && value !== null && "from" in value && value.from instanceof Date;

// A one-day pick (only "from" chosen) means picking up and returning on that day.
const day = (range: DateRange, which: "from" | "to") => format(which === "to" ? (range.to ?? range.from!) : range.from!, "yyyy-MM-dd");

export const rentalSearchSchema = (m: RentalSearchErrorMessages) =>
  z
    .object({
      pickupBranchId: z.string().min(1, m.pickupBranch),
      returnBranchId: z.string().min(1, m.returnBranch),
      range: z.custom<DateRange>(isRange, m.dates),
      pickupTime: z.string().min(1),
      returnTime: z.string().min(1),
    })
    .superRefine((value, ctx) => {
      const start = localToInstant(`${day(value.range, "from")}T${value.pickupTime}`);
      const end = localToInstant(`${day(value.range, "to")}T${value.returnTime}`);
      if (end <= start) ctx.addIssue({ code: "custom", path: ["range"], message: m.order });
    });

export type RentalSearchInput = z.infer<ReturnType<typeof rentalSearchSchema>>;

export function toRentalSearch(input: RentalSearchInput): RentalSearch {
  return {
    pickupBranchId: input.pickupBranchId,
    returnBranchId: input.returnBranchId,
    startAt: `${day(input.range, "from")}T${input.pickupTime}`,
    endAt: `${day(input.range, "to")}T${input.returnTime}`,
  };
}

// The form's values for a search already in the URL, so the editable summary starts as the
// visitor left it.
export function fromRentalSearch(search: RentalSearch): RentalSearchInput {
  const [startDate, startTime] = search.startAt.split("T");
  const [endDate, endTime] = search.endAt.split("T");
  const parse = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  return {
    pickupBranchId: search.pickupBranchId,
    returnBranchId: search.returnBranchId,
    range: { from: parse(startDate), to: endDate === startDate ? undefined : parse(endDate) },
    pickupTime: startTime,
    returnTime: endTime,
  };
}
