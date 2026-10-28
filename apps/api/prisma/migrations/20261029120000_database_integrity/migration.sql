-- V2-11 (QUALITY V-01..V-05, G-17). Written partly by hand: Prisma cannot express CHECK constraints or sequences,
-- and a NOT NULL `updatedAt` needs a value for the rows that already exist.
--
-- About 20261017102847_add_account_security: its header still warns that `pointsUsed` is dropped, but the DROP
-- line was taken out by hand (the column comes from 20261016222256 and stays). The file is left as it is, because
-- an applied migration must not change; replaying every migration on an empty database gives exactly
-- schema.prisma (checked by `prisma migrate diff --exit-code` in CI), so nothing drifted.

-- Holds last 15 minutes, so a row that points at a branch that no longer exists is long expired; the foreign keys
-- below would refuse to be added with one left behind.
DELETE FROM "Hold" WHERE "pickupBranchId" NOT IN (SELECT "id" FROM "Branch")
  OR "returnBranchId" NOT IN (SELECT "id" FROM "Branch");

-- Timestamps. Existing rows get now(); the default is dropped again after the fill because Prisma's @updatedAt
-- sets the value itself (the schema has no database default for it).
ALTER TABLE "Branch" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Branch" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Extra" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Extra" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Vehicle" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Vehicle" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "VehicleModel" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "VehicleModel" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "QuoteRequest" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "QuoteRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- The moment an earlier cancellation happened was never stored, so `cancelledAt` stays empty for those rows.
ALTER TABLE "Reservation" ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Reservation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Indexes
CREATE INDEX "Hold_pickupBranchId_idx" ON "Hold"("pickupBranchId");
CREATE INDEX "Hold_returnBranchId_idx" ON "Hold"("returnBranchId");
CREATE INDEX "QuoteRequest_productId_idx" ON "QuoteRequest"("productId");
CREATE INDEX "Reservation_userId_startAt_idx" ON "Reservation"("userId", "startAt");
-- The new one also serves a search by userId alone, so the old single-column index is dropped.
DROP INDEX "Reservation_userId_idx";
CREATE INDEX "Reservation_pickupBranchId_idx" ON "Reservation"("pickupBranchId");
CREATE INDEX "Reservation_returnBranchId_idx" ON "Reservation"("returnBranchId");
CREATE INDEX "ReservationExtra_extraId_idx" ON "ReservationExtra"("extraId");

-- Foreign keys
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_pickupBranchId_fkey" FOREIGN KEY ("pickupBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_returnBranchId_fkey" FOREIGN KEY ("returnBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraints (by hand). The API validates the same rules; these keep a wrong row out whatever writes it.
-- Amounts are in the smallest unit of the reservation's currency, so 0 is allowed (a free extra, a fully paid-by-points booking).
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_period_check" CHECK ("endAt" > "startAt");
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_days_check" CHECK ("days" >= 1);
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_amounts_check" CHECK (
  "vehicleDailyPrice" >= 0 AND "totalPrice" >= 0 AND "discountAmount" >= 0 AND "pointsUsed" >= 0 AND "exchangeRate" > 0
);
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_period_check" CHECK ("endAt" > "startAt");
ALTER TABLE "ReservationExtra" ADD CONSTRAINT "ReservationExtra_quantity_check" CHECK ("quantity" >= 1);
ALTER TABLE "ReservationExtra" ADD CONSTRAINT "ReservationExtra_amounts_check" CHECK ("unitPrice" >= 0 AND "totalPrice" >= 0);
ALTER TABLE "VehicleModel" ADD CONSTRAINT "VehicleModel_dailyPrice_check" CHECK ("dailyPrice" >= 0);
ALTER TABLE "Extra" ADD CONSTRAINT "Extra_price_check" CHECK ("price" >= 0);
-- PromoCode.percent (1-90) and maxRedemptions (>= 1) were done in 20261025120000_promo_code_limits.

-- Reservation numbers (QUALITY G-17): one sequence instead of "largest + 1". The serial no longer starts again
-- each year, so the numbers do not tell how many bookings a year has had; the format NVR-<year>-<5 digits> is the same.
-- It starts after the largest serial in use.
CREATE SEQUENCE "ReservationNumber_seq";
SELECT setval(
  '"ReservationNumber_seq"',
  COALESCE((SELECT MAX(CAST(substring("number" FROM '[0-9]+$') AS bigint)) FROM "Reservation" WHERE "number" ~ '^NVR-[0-9]{4}-[0-9]+$'), 0) + 1,
  false
);
