import { z } from "zod";

export type PaymentErrorMessages = {
  holder: string;
  number: string;
  expiry: string;
  cvc: string;
};

// Luhn checksum: catches mistyped card numbers before anything else happens.
function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

const isFuture = (value: string, now: Date) => {
  const [month, year] = value.split("/").map(Number);
  // A card is valid through the end of its expiry month.
  return new Date(2000 + year, month, 1).getTime() > now.getTime();
};

// The payment is a demo (SPEC §3): these values are checked in the browser and never
// leave it. `now` is a parameter so the check is testable.
export const paymentSchema = (m: PaymentErrorMessages, now: () => Date = () => new Date()) =>
  z.object({
    holder: z.string().trim().min(2, m.holder),
    number: z
      .string()
      .transform((value) => value.replace(/\s/g, ""))
      .refine((value) => /^\d{13,19}$/.test(value) && luhn(value), m.number),
    expiry: z
      .string()
      .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, m.expiry)
      .refine((value) => isFuture(value, now()), m.expiry),
    cvc: z.string().regex(/^\d{3,4}$/, m.cvc),
  });

export type PaymentInput = z.input<ReturnType<typeof paymentSchema>>;

export const formatCardNumber = (value: string) =>
  value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");

export function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}
