import { signIn, signUp } from "./auth-actions";
import { forgotPassword, resetPassword as resetPasswordAction } from "./password-reset-actions";
import type { ForgotPasswordInput, LoginInput, RegisterInput } from "./auth-schemas";
import type { AccountType } from "./session";

// The sign-in, sign-up and sign-out calls are server actions (auth-actions.ts); this file turns what
// they answer into errors the forms can tell apart. A service that cannot be reached says so
// plainly: nobody is ever shown a fake "signed in".
export class AuthUnavailableError extends Error {
  constructor() {
    super("The authentication service is not connected yet.");
    this.name = "AuthUnavailableError";
  }
}

// Resolves to the language the account saved, or undefined to stay in the current one.
export async function login(input: LoginInput, kind: AccountType = "individual"): Promise<"tr" | "en" | undefined> {
  const result = await signIn(kind, input.email, input.password);
  if (!result.ok) throw failure(result.reason);
  return result.locale ?? undefined;
}

// Resolves to the language the new account starts with, as login does.
export async function register(input: RegisterInput): Promise<"tr" | "en" | undefined> {
  const result = await signUp(input);
  if (!result.ok) throw failure(result.reason);
  return result.locale ?? undefined;
}

// The e-mail or the password is wrong; the API does not say which, so neither does the form.
export class InvalidCredentialsError extends Error {
  constructor() {
    super("The e-mail or password is wrong.");
    this.name = "InvalidCredentialsError";
  }
}

// Sign-up with an address that already has an account.
export class EmailTakenError extends Error {
  constructor() {
    super("An account with this e-mail already exists.");
    this.name = "EmailTakenError";
  }
}

function failure(reason: "unavailable" | "invalid" | "email_taken" | "rate_limited"): Error {
  if (reason === "invalid") return new InvalidCredentialsError();
  if (reason === "email_taken") return new EmailTakenError();
  if (reason === "rate_limited") return new AuthRateLimitedError();
  return new AuthUnavailableError();
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
