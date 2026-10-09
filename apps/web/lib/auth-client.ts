import type { ForgotPasswordInput, LoginInput, RegisterInput } from "./auth-schemas";

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

export async function login(input: LoginInput): Promise<void> {
  void input;
  throw new AuthUnavailableError();
}

export async function register(input: RegisterInput): Promise<void> {
  void input;
  throw new AuthUnavailableError();
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  void input;
  throw new AuthUnavailableError();
}
