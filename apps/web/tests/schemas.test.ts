import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "@/lib/auth-schemas";
import { contactSchema, EMPTY_CONTACT } from "@/lib/contact";
import { formatCardNumber, paymentSchema } from "@/lib/payment-schema";
import { emptyQuote, quoteSchema } from "@/lib/quote";

// Messages are their own names, so a failing field is easy to read in the result.
const names = <T extends string>(...keys: T[]) => Object.fromEntries(keys.map((key) => [key, key])) as Record<T, T>;

const issues = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? [] : result.error!.issues.map((issue) => issue.message);

describe("paymentSchema", () => {
  const schema = paymentSchema(names("holder", "number", "expiry", "cvc"), () => new Date("2026-10-11T00:00:00Z"));
  const card = { holder: "Elif Yıldız", number: "4242 4242 4242 4242", expiry: "12/27", cvc: "123" };

  it("accepts the test card", () => {
    expect(schema.safeParse(card).success).toBe(true);
  });

  it("rejects a number that fails the Luhn check", () => {
    expect(issues(schema.safeParse({ ...card, number: "4242 4242 4242 4241" }))).toContain("number");
  });

  it("rejects a card that has expired, but not one valid through this month", () => {
    expect(issues(schema.safeParse({ ...card, expiry: "09/26" }))).toContain("expiry");
    expect(schema.safeParse({ ...card, expiry: "10/26" }).success).toBe(true);
  });

  it("rejects a malformed expiry and CVC", () => {
    expect(issues(schema.safeParse({ ...card, expiry: "13/27" }))).toContain("expiry");
    expect(issues(schema.safeParse({ ...card, cvc: "12" }))).toContain("cvc");
  });

  it("groups the digits of a card number as they are typed", () => {
    expect(formatCardNumber("4242424242424242")).toBe("4242 4242 4242 4242");
  });
});

describe("contactSchema", () => {
  const schema = contactSchema(names("name", "email", "phone", "message", "consent"));
  const message = { ...EMPTY_CONTACT, name: "Mert Kaya", email: "mert@example.com", message: "Merhaba, bir sorum var.", consent: true };

  it("accepts a complete message, with or without a phone", () => {
    expect(schema.safeParse(message).success).toBe(true);
    expect(schema.safeParse({ ...message, phone: "+90 232 555 01 00" }).success).toBe(true);
  });

  it("rejects a phone that is too short", () => {
    expect(issues(schema.safeParse({ ...message, phone: "12345" }))).toContain("phone");
  });

  it("needs the KVKK consent", () => {
    expect(issues(schema.safeParse({ ...message, consent: false }))).toContain("consent");
  });

  it("rejects a bad email and a message that is too short", () => {
    const found = issues(schema.safeParse({ ...message, email: "mert", message: "kısa" }));
    expect(found).toEqual(expect.arrayContaining(["email", "message"]));
  });
});

describe("quoteSchema", () => {
  const schema = quoteSchema(names("company", "contactName", "email", "phone", "needs", "cities", "consent"));
  const quote = {
    ...emptyQuote(),
    company: "Ege Lojistik",
    contactName: "Mert Kaya",
    email: "filo@egelojistik.example",
    phone: "0232 555 01 00",
    needs: ["sedan" as const],
    cities: "İzmir",
    consent: true,
  };

  it("accepts a complete request", () => {
    expect(schema.safeParse(quote).success).toBe(true);
  });

  it("needs at least one need", () => {
    expect(issues(schema.safeParse({ ...quote, needs: [] }))).toContain("needs");
  });

  it("only accepts a known product, or none", () => {
    expect(schema.safeParse({ ...quote, product: "yesil-filo" }).success).toBe(true);
    expect(schema.safeParse({ ...quote, product: "made-up" }).success).toBe(false);
  });
});

describe("auth schemas", () => {
  const messages = names("required", "email", "passwordMin", "consent");

  it("login only asks for something in the password", () => {
    expect(loginSchema(messages).safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(issues(loginSchema(messages).safeParse({ email: "a@b.co", password: "" }))).toContain("required");
  });

  it("register enforces the minimum password length", () => {
    const base = { firstName: "Elif", lastName: "Yıldız", email: "elif@example.com", consent: true };
    expect(issues(registerSchema(messages).safeParse({ ...base, password: "short" }))).toContain("passwordMin");
    expect(registerSchema(messages).safeParse({ ...base, password: "long-enough-1" }).success).toBe(true);
  });
});
