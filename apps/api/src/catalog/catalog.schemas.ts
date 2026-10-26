import { z } from 'zod';
import { field, requiredUuid } from '../common/zod-fields.js';
import { endAtField, startAtField, withPeriodCheck } from '../reservations/rental-period.js';

// Query strings of the catalog and content endpoints (ARCHITECTURE ADR-26). A query value is a string, or a
// list when the parameter is repeated, or an object for `a[b]=c`: anything that is not one string is
// INVALID_FORMAT, so a repeated parameter cannot slip a list into a string rule.
export const CURRENCY_VALUES = ['TRY', 'EUR', 'USD'] as const;
export const AUDIENCE_VALUES = ['INDIVIDUAL', 'CORPORATE'] as const;

// A choice that may be left out (null); an empty `?currency=` counts as left out, an empty `?audience=` does not.
// A value outside the list is INVALID_FORMAT.
const queryChoice = <T extends string>(values: readonly T[], emptyIsDefault = true) =>
  field<T | null>((raw) => {
    if (raw === undefined || (emptyIsDefault && raw === '')) return { value: null };
    return typeof raw === 'string' && (values as readonly string[]).includes(raw)
      ? { value: raw as T }
      : { code: 'INVALID_FORMAT' };
  });

// The query string is text: a missing or empty parameter is REQUIRED.
const queryId = () => requiredUuid();

export const currencyQuerySchema = z.object({ currency: queryChoice(CURRENCY_VALUES) });

export const vehicleSearchSchema = (now: Date) =>
  withPeriodCheck(
    z.object({
      pickupBranchId: queryId(),
      returnBranchId: queryId(),
      startAt: startAtField(now),
      endAt: endAtField(),
      currency: queryChoice(CURRENCY_VALUES),
    }),
  );

export const faqQuerySchema = z.object({ audience: queryChoice(AUDIENCE_VALUES, false) });
