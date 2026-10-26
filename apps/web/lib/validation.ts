import type { z } from "zod";

// The form schemas take their error texts from the caller, because the browser speaks the visitor's
// language. A server action has no visitor to talk to, only fields that failed, so it hands the same
// schema messages that are just the field's own name and reads the names back with `invalidFields`.
export function codeMessages<M extends Record<string, string>>(): M {
  return new Proxy({}, { get: (_target, key) => String(key) }) as M;
}

// The top-level fields a schema rejected, once each. A body that is not even an object (a number, null)
// has no field to name and gives an empty list: it is still invalid, and the caller says so.
export function invalidFields(error: z.ZodError): string[] {
  const names = error.issues.flatMap((issue) => (typeof issue.path[0] === "string" ? [issue.path[0]] : []));
  return [...new Set(names)];
}
