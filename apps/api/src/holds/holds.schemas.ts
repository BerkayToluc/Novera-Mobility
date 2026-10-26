import { z } from 'zod';
import { requiredUuid } from '../common/zod-fields.js';
import { endAtField, startAtField, withPeriodCheck } from '../reservations/rental-period.js';

// POST /holds (openapi.yaml /holds). `now` is passed in so the booking window is judged at one moment.
export const holdSchema = (now: Date) =>
  withPeriodCheck(
    z.object({
      vehicleId: requiredUuid(),
      pickupBranchId: requiredUuid(),
      returnBranchId: requiredUuid(),
      startAt: startAtField(now),
      endAt: endAtField(),
    }),
  );

export type HoldInput = z.output<ReturnType<typeof holdSchema>>;
