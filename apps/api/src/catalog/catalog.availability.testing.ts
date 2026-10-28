import 'dotenv/config';
import { HttpException } from '@nestjs/common';
import { daysAhead } from '../reservations/dates.testing.js';

// Shared set-up of catalog.availability.spec.ts (V2-13, QUALITY M-04): the fake database and the fixtures, moved out so the spec itself is only the cases.
// Entegrasyon testi: GET /vehicles müsaitlik sorgusunu GERÇEK PostgreSQL'e karşı sınar (BACKLOG #21).
// Sorgunun doğruluğu veritabanının içinde olduğu için sahte (mock) veriyle sınanamaz.
//
// Güvenlik: yalnızca adında "test" geçen bir veritabanında çalışır, geliştirme verinize dokunmaz.
// TEST_DATABASE_URL tanımlı değilse testler atlanır (CI'da tanımlıdır).
export const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL adında "test" geçen bir veritabanını göstermeli.');
}
export const describeDb = databaseUrl ? describe : describe.skip;

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
export const DAILY = 125000; // TRY, kuruş (₺1.250)
export const START = daysAhead(30);
export const END = new Date(START.getTime() + 3 * DAY); // 3 gün

export type Money = { amount: number; currency: string };
export type Offer = {
  vehicleId: string;
  year: number;
  days: number;
  dailyPrice: Money;
  totalPrice: Money;
};

export async function catchHttp(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error('HttpException bekleniyordu ama hata atılmadı');
}
