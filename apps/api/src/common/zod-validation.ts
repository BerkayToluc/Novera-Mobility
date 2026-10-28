import { HttpException, HttpStatus, type ArgumentMetadata, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

// One way to validate an endpoint's input (ARCHITECTURE ADR-26): a zod schema, and an answer in the shape of
// ADR-17: 422 VALIDATION_FAILED with `fieldErrors` of fixed machine codes (see zod-fields.ts).

export type FieldErrors = Record<string, string>;

export function validationFailed(fieldErrors: FieldErrors, message: string): HttpException {
  return new HttpException({ code: 'VALIDATION_FAILED', message, fieldErrors }, HttpStatus.UNPROCESSABLE_ENTITY);
}

const CODE = /^[A-Z][A-Z_]*$/;

// The first problem of each field, as its code. A message that is not one of our codes (a zod default) is
// reported as INVALID_FORMAT, so no English sentence of the library ever reaches a client.
export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const name = issue.path[0];
    if (typeof name !== 'string' || name in result) continue;
    result[name] = CODE.test(issue.message) ? issue.message : 'INVALID_FORMAT';
  }
  return result;
}

// A body that is not an object (a list, null, a number, text) has no fields: it is read as an empty one, so
// every required field answers REQUIRED. Unknown fields are dropped (zod's default `strip`): nothing the
// caller adds, such as an id or a role, is ever read.
function asObject(input: unknown): unknown {
  return input !== null && typeof input === 'object' && !Array.isArray(input) ? input : {};
}

// zod does not run a field's rule when its key is absent, and ours say REQUIRED (or take a default) for a
// missing value. So every key of the schema is present, as undefined, before parsing. Spread, not assign:
// a body key named `__proto__` stays a plain own key and never touches a prototype.
function withAllKeys(schema: z.ZodObject, input: object): object {
  const absent = Object.fromEntries(Object.keys(schema.shape).map((key) => [key, undefined]));
  return { ...absent, ...input };
}

export function parseInput<S extends z.ZodObject>(schema: S, input: unknown, message: string): z.output<S> {
  const result = schema.safeParse(withAllKeys(schema, asObject(input) as object));
  if (!result.success) throw validationFailed(fieldErrorsOf(result.error), message);
  return result.data;
}

// For an endpoint that validates before anything else happens. Where a rate limit has to count the request
// first (and so see invalid ones too), the service calls `parseInput` itself at that point.
export class ZodValidationPipe<S extends z.ZodObject> implements PipeTransform<unknown, z.output<S>> {
  constructor(
    private readonly schema: S,
    private readonly message: string,
  ) {}

  // Used on a whole body or query string; a path parameter is always text and has nothing to validate here.
  transform(value: unknown, _metadata: ArgumentMetadata): z.output<S> {
    return parseInput(this.schema, value, this.message);
  }
}
