import { z } from "zod";
import { isIsoDate } from "./driver-eligibility";
import { LICENCE_COUNTRIES, needsInternationalPermit } from "./driver-rules";

export type DriverErrorMessages = {
  birthDate: string;
  country: string;
  licenceNumber: string;
  licenceIssuedAt: string;
  licenceBeforeBirth: string;
  permit: string;
  declaration: string;
};

const todayIso = (now: Date) => {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

// The driver's details (SPEC §2.10). All of them are checked here in the browser and again on the
// server; none is kept anywhere. `now` is a parameter so the check is testable.
export const driverSchema = (m: DriverErrorMessages, now: () => Date = () => new Date()) => {
  const pastDate = (message: string) =>
    z
      .string()
      .refine((value) => isIsoDate(value), message)
      .refine((value) => value <= todayIso(now()), message);

  return z
    .object({
      birthDate: pastDate(m.birthDate),
      country: z.enum(LICENCE_COUNTRIES, { error: m.country }),
      // Letters and digits only: the fictional check never sees anything else.
      licenceNumber: z.string().trim().regex(/^[A-Za-z0-9]{6,12}$/, m.licenceNumber),
      licenceIssuedAt: pastDate(m.licenceIssuedAt),
      permit: z.boolean(),
      declaration: z.boolean().refine((value) => value === true, m.declaration),
    })
    .superRefine((value, context) => {
      if (isIsoDate(value.birthDate) && isIsoDate(value.licenceIssuedAt) && value.licenceIssuedAt <= value.birthDate) {
        context.addIssue({ code: "custom", path: ["licenceIssuedAt"], message: m.licenceBeforeBirth });
      }
      if (value.country && needsInternationalPermit(value.country) && !value.permit) {
        context.addIssue({ code: "custom", path: ["permit"], message: m.permit });
      }
    });
};

export type DriverInput = z.input<ReturnType<typeof driverSchema>>;
export type DriverDetails = z.output<ReturnType<typeof driverSchema>>;
