import { HttpException, HttpStatus } from '@nestjs/common';

// POST /contact ve POST /quotes için ortak parçalar (ADR-17, ADR-20, openapi.yaml). Alan doğrulaması
// artık zod şemalarında (common/zod-fields.ts, ADR-26); burada yalnızca hata biçimleri ve tuzak alan kaldı.
// Hata biçimi: { code, message, fieldErrors }; alan hataları sabit makine kodlarıdır.

export type FormInput = Record<string, unknown>;

export function spamDetected(): HttpException {
  return new HttpException(
    { code: 'SPAM_DETECTED', message: 'The request was rejected as spam' },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

// `website` görünmeyen tuzak alandır; insanlar doldurmaz, botlar doldurur (ADR-20). Gövde nesne değilse
// (dizi, null, metin) tuzak dolu sayılmaz; doğrulama onu zaten REQUIRED alanlarla reddeder.
export function isSpam(input: unknown): boolean {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return false;
  const value = (input as FormInput).website;
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}
