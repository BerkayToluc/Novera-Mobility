import { z } from "zod";

// Error texts come from the caller (the message files), so validation speaks the
// visitor's language instead of Zod's English defaults.
export type AuthErrorMessages = {
  required: string;
  email: string;
  passwordMin: string;
  consent: string;
};

// Same minimum as the backend will enforce (ARCHITECTURE ADR-10 keeps the rules in step).
export const PASSWORD_MIN_LENGTH = 8;

const emailField = (m: AuthErrorMessages) =>
  z
    .string()
    .trim()
    .min(1, m.required)
    .refine((value) => z.email().safeParse(value).success, m.email);

export const loginSchema = (m: AuthErrorMessages) =>
  z.object({
    email: emailField(m),
    // Only "not empty": the real password rules apply when choosing one, not when signing in.
    password: z.string().min(1, m.required),
  });

export const registerSchema = (m: AuthErrorMessages) =>
  z.object({
    firstName: z.string().trim().min(1, m.required),
    lastName: z.string().trim().min(1, m.required),
    email: emailField(m),
    password: z.string().min(1, m.required).min(PASSWORD_MIN_LENGTH, m.passwordMin),
    consent: z.boolean().refine((value) => value, m.consent),
  });

export const forgotPasswordSchema = (m: AuthErrorMessages) =>
  z.object({ email: emailField(m) });

export type LoginInput = z.infer<ReturnType<typeof loginSchema>>;
export type RegisterInput = z.infer<ReturnType<typeof registerSchema>>;
export type ForgotPasswordInput = z.infer<ReturnType<typeof forgotPasswordSchema>>;
