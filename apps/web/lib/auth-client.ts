import { signIn, signUp } from "./auth-actions";
import type { ForgotPasswordInput, LoginInput, RegisterInput } from "./auth-schemas";
import type { AccountType } from "./session";

// The auth API does not exist yet (BACKLOG #25, #27). Until it does, every call says so
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

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  void input;
  throw new AuthUnavailableError();
}
