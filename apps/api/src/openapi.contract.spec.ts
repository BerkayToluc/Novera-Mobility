import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import type { z } from 'zod';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  googleSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from './auth/auth.schemas.js';
import { contactSchema, quoteSchema } from './forms/forms.schemas.js';
import { holdSchema } from './holds/holds.schemas.js';
import { reservationRequestSchema } from './reservations/reservation.schemas.js';

// ADR-26: the request bodies are described twice, in the zod schemas that enforce them and in
// docs/api/openapi.yaml that the web client is generated from. This test fails when the two stop agreeing
// on which fields a body has and which of them are required.
type Json = Record<string, any>;
const document = parse(readFileSync(resolve(process.cwd(), '../../docs/api/openapi.yaml'), 'utf8')) as Json;

function resolveRef(node: Json): Json {
  if (typeof node.$ref !== 'string') return node;
  return node.$ref
    .replace('#/', '')
    .split('/')
    .reduce((current: Json, key: string) => current[key], document);
}

function bodyOf(path: string, method: string): { properties: string[]; required: string[] } {
  const operation = document.paths[path]?.[method] as Json | undefined;
  expect(operation).toBeDefined();
  const schema = resolveRef(operation!.requestBody.content['application/json'].schema);
  return {
    properties: Object.keys(schema.properties ?? {}).sort((a, b) => a.localeCompare(b)),
    required: [...(schema.required ?? [])].sort((a, b) => a.localeCompare(b)),
  };
}

// What the zod schema says: its fields, and the ones that insist on a value (an empty body is rejected for them).
function shapeOf(schema: z.ZodObject): { properties: string[]; required: string[] } {
  const absent = Object.fromEntries(Object.keys(schema.shape).map((key) => [key, undefined]));
  const result = schema.safeParse(absent);
  const required = result.success
    ? []
    : [
        ...new Set(
          result.error.issues
            .filter((i) => i.message === 'REQUIRED' || i.message === 'CONSENT_REQUIRED')
            .map((i) => String(i.path[0])),
        ),
      ];
  return {
    properties: Object.keys(schema.shape).sort((a, b) => a.localeCompare(b)),
    required: required.sort((a, b) => a.localeCompare(b)),
  };
}

const NOW = new Date('2026-10-26T10:00:00Z');
// The `website` trap field is in the contract but read before the schema runs (isSpam), so it is not a schema field.
const TRAP = ['website'];

const cases: Array<[string, string, z.ZodObject, string[]]> = [
  ['/auth/register', 'post', registerSchema, []],
  ['/auth/login', 'post', loginSchema, []],
  ['/auth/google', 'post', googleSchema, []],
  ['/auth/forgot-password', 'post', forgotPasswordSchema, []],
  ['/auth/reset-password', 'post', resetPasswordSchema, []],
  ['/me', 'patch', updateProfileSchema, []],
  ['/me/password', 'post', changePasswordSchema, []],
  ['/contact', 'post', contactSchema, TRAP],
  ['/quotes', 'post', quoteSchema, TRAP],
  ['/holds', 'post', holdSchema(NOW), []],
  ['/reservations/price', 'post', reservationRequestSchema(NOW), []],
  ['/reservations', 'post', reservationRequestSchema(NOW), []],
];

describe('request bodies match docs/api/openapi.yaml', () => {
  it.each(cases)('%s %s', (path, method, schema, extraInContract) => {
    const contract = bodyOf(path, method);
    const code = shapeOf(schema);
    expect(contract.properties.filter((name) => !extraInContract.includes(name))).toEqual(code.properties);
    expect(contract.required.filter((name) => !extraInContract.includes(name))).toEqual(code.required);
  });
});
