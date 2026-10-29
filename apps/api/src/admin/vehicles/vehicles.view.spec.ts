import { createVehicleSchema, maxYear } from './vehicles.schemas.js';
import { normalizePlate, plateKey } from './vehicles.view.js';
import { parseInput } from '../../common/zod-validation.js';
import { HttpException } from '@nestjs/common';
import { buildVehicles } from '../../../prisma/seed-data.js';

describe('the plate of a car (V2-30)', () => {
  it('is read however it is typed and stored one way', () => {
    for (const typed of ['34 ABC 123', '34abc123', '34-abc-123', ' 34  Abc 123 ', '34.ABC.123']) {
      expect(normalizePlate(typed)).toBe('34 ABC 123');
    }
    expect(normalizePlate('06 A 1234')).toBe('06 A 1234');
    expect(normalizePlate('81 ZY 99')).toBe('81 ZY 99');
  });

  it('refuses what cannot be a Turkish plate', () => {
    for (const typed of ['00 ABC 123', '82 ABC 123', '34 ABCD 123', '34 ABC 1', '34 ABC 12345', '34 QWX 123', '34 ÇAB 123', '34 123', 'ABC 123', '']) {
      expect(normalizePlate(typed)).toBeNull();
    }
  });

  it('every plate of the sample fleet is a good one, so the seed and the rule agree', () => {
    const plates = buildVehicles().map((car) => car.plate);
    expect(plates.length).toBeGreaterThan(30);
    for (const plate of plates) expect(normalizePlate(plate)).toBe(plate);
  });

  it('is searched without separators or case', () => {
    expect(plateKey('34 NV 1001')).toBe('34nv1001');
    expect(plateKey('34nv')).toBe('34nv');
  });
});

describe('the input of a new car', () => {
  const now = () => new Date('2026-10-30T10:00:00Z');
  const parse = (body: unknown) => parseInput(createVehicleSchema(now), body, 'test');
  const refused = (body: unknown): Record<string, string> => {
    try {
      parse(body);
    } catch (error) {
      if (error instanceof HttpException) return (error.getResponse() as { fieldErrors: Record<string, string> }).fieldErrors;
      throw error;
    }
    return {};
  };
  const good = { plate: '34 abc 123', year: 2025, modelSlug: 'renault-clio', branchId: '6f0a1f7e-8f5e-4b86-9f5c-2d2f6d9a0b11' };

  it('takes a good car and writes the plate in its stored form', () => {
    expect(parse(good)).toMatchObject({ plate: '34 ABC 123', year: 2025 });
  });

  it('allows the year from 2015 to next year, and no other', () => {
    expect(maxYear(now())).toBe(2027);
    expect(refused({ ...good, year: 2015 })).toEqual({});
    expect(refused({ ...good, year: 2027 })).toEqual({});
    expect(refused({ ...good, year: 2014 })).toEqual({ year: 'OUT_OF_RANGE' });
    expect(refused({ ...good, year: 2028 })).toEqual({ year: 'OUT_OF_RANGE' });
    expect(refused({ ...good, year: '2025' })).toEqual({ year: 'INVALID_FORMAT' });
  });
});
