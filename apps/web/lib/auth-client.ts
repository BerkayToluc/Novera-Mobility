import { signIn, signUp } from "./auth-actions";
import { forgotPassword, resetPassword as resetPasswordAction } from "./password-reset-actions";
import type { ForgotPasswordInput, LoginInput, RegisterInput } from "./auth-schemas";
import type { AccountType } from "./session";

// Sign-in and sign-up are not connected to the API yet (BACKLOG #25, #27); until they are, every call says so
// plainly instead of pretending to succeed: a fake "signed in" would mislead and could
// leak into a real build. When the API lands, only this file changes; the forms already
// handle loading and failure.
export class AuthUnavailableError extends Error {
  constructor() {
    super("The authentication service is not connected yet.");
    this.name = "AuthUnavailableError";
  }
}

// Resolves to the language the account saved, or undefined to stay in the current one.
export async function login(input: LoginInput, kind: AccountType = "individual"): Promise<"tr" | "en" | undefined> {
  const result = await signIn(kind, input.email, input.password);
  if (!result.ok) throw new AuthUnavailableError();
  return result.locale ?? undefined;
}

// Resolves to the language the new account starts with, as login does.
export async function register(input: RegisterInput): Promise<"tr" | "en" | undefined> {
  const result = await signUp(input);
  if (!result.ok) throw new AuthUnavailableError();
  return result.locale ?? undefined;
}

// Too many requests from this address or for this e-mail (the API allows a few an hour).
export class AuthRateLimitedError extends Error {
  constructor() {
    super("Too many password reset requests.");
    this.name = "AuthRateLimitedError";
  }
}

// The reset link is wrong, already used or older than an hour; the API does not say which.
export class ResetLinkInvalidError extends Error {
  constructor() {
    super("The password reset link is not valid.");
    this.name = "ResetLinkInvalidError";
  }
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  const result = await forgotPassword(input.email);
  if (result.ok) return;
  if (result.reason === "rate_limited") throw new AuthRateLimitedError();
  throw new AuthUnavailableError();
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const result = await resetPasswordAction(token, password);
  if (result.ok) return;
  if (result.reason === "invalid_link") throw new ResetLinkInvalidError();
  if (result.reason === "rate_limited") throw new AuthRateLimitedError();
  throw new AuthUnavailableError();
}
