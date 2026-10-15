import { HttpException, HttpStatus } from '@nestjs/common';

// POST /contact ve POST /quotes için ortak parçalar (ADR-17, ADR-20, openapi.yaml).
// Hata biçimi: { code, message, fieldErrors }; alan hataları sabit makine kodlarıdır.

export type FieldErrors = Record<string, string>;
export type FormInput = Record<string, unknown>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9+()\-.\s]+$/;

export function validationFailed(
  fieldErrors: FieldErrors,
  message: string,
): HttpException {
  return new HttpException(
    { code: 'VALIDATION_FAILED', message, fieldErrors },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

export function spamDetected(): HttpException {
  return new HttpException(
    { code: 'SPAM_DETECTED', message: 'The request was rejected as spam' },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

export function rateLimited(): HttpException {
  return new HttpException(
    { code: 'RATE_LIMITED', message: 'Too many requests, try again later' },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

// Gövde bir nesne değilse (dizi, null, metin) boş nesne sayılır; alanlar REQUIRED döner.
export function asFormInput(body: unknown): FormInput {
  return body !== null && typeof body === 'object' && !Array.isArray(body)
    ? (body as FormInput)
    : {};
}

// `website` görünmeyen tuzak alandır; insanlar doldurmaz, botlar doldurur (ADR-20).
export function isSpam(input: FormInput): boolean {
  const value = input.website;
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

export class FormReader {
  readonly errors: FieldErrors = {};

  constructor(private readonly input: FormInput) {}

  // Zorunlu metin: eksik ya da boşsa REQUIRED, uzunsa TOO_LONG, metin değilse INVALID_FORMAT.
  required(name: string, max: number): string {
    return this.read(name, max, true) ?? '';
  }

  // İsteğe bağlı metin: eksik ya da boşsa null.
  optional(name: string, max: number): string | null {
    return this.read(name, max, false);
  }

  email(name: string): string {
    const value = this.read(name, 254, true);
    if (value === null) return '';
    if (!EMAIL_REGEX.test(value)) {
      this.errors[name] = 'INVALID_EMAIL';
      return '';
    }
    return value;
  }

  phone(name: string): string | null {
    const value = this.read(name, 30, false);
    if (value === null) return null;
    if (!PHONE_REGEX.test(value)) {
      this.errors[name] = 'INVALID_FORMAT';
      return null;
    }
    return value;
  }

  integer(name: string, min: number, max: number): number {
    const raw = this.input[name];
    if (raw === undefined || raw === null || raw === '') {
      this.errors[name] = 'REQUIRED';
      return 0;
    }
    if (typeof raw !== 'number' || !Number.isInteger(raw)) {
      this.errors[name] = 'INVALID_FORMAT';
      return 0;
    }
    if (raw < min || raw > max) {
      this.errors[name] = 'OUT_OF_RANGE';
      return 0;
    }
    return raw;
  }

  // KVKK onayı yalnızca true değeriyle kabul edilir.
  consent(name = 'consent'): void {
    if (this.input[name] !== true) this.errors[name] = 'CONSENT_REQUIRED';
  }

  assertValid(message: string): void {
    if (Object.keys(this.errors).length > 0) {
      throw validationFailed(this.errors, message);
    }
  }

  private read(name: string, max: number, required: boolean): string | null {
    const raw = this.input[name];
    if (raw === undefined || raw === null) {
      if (required) this.errors[name] = 'REQUIRED';
      return null;
    }
    if (typeof raw !== 'string') {
      this.errors[name] = 'INVALID_FORMAT';
      return null;
    }
    const value = raw.trim();
    if (value === '') {
      if (required) this.errors[name] = 'REQUIRED';
      return null;
    }
    if (value.length > max) {
      this.errors[name] = 'TOO_LONG';
      return null;
    }
    return value;
  }
}
