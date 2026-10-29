-- Campaign code rules the administration relies on (V2-26, ADMIN.md §3.1), kept by the database as well as by the API.
-- Written by hand: Prisma cannot express CHECK constraints (the same as 20261025120000_promo_code_limits).
--
-- NOT VALID: the rules apply to every row written from now on, but the rows that are already there are not read. A code
-- somebody typed into the database by hand before the panel existed (lower case, or an end before its start) must not make
-- the deployment fail; the panel shows such a code and lets it be corrected or switched off.

-- A code is what the booking form reads: upper-case letters and digits, 3 to 20 characters (`normalizePromoCode`).
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_code_check" CHECK ("code" ~ '^[A-Z0-9]{3,20}$') NOT VALID;

-- A code that ends has to end after it starts; either end may be missing.
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_period_check" CHECK ("validFrom" IS NULL OR "validUntil" IS NULL OR "validUntil" > "validFrom") NOT VALID;
