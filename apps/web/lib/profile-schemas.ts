import { z } from "zod";
import type { AuthErrorMessages } from "./auth-schemas";

// The e-mail address is the account's identity and is shown read-only, so the form only
// edits the name.
export const profileSchema = (m: Pick<AuthErrorMessages, "required">) =>
  z.object({
    firstName: z.string().trim().min(1, m.required),
    lastName: z.string().trim().min(1, m.required),
  });

export type ProfileInput = z.infer<ReturnType<typeof profileSchema>>;
