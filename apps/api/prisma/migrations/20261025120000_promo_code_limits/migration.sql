-- Campaign code limits (V2-05, QUALITY G-04): a total cap, one use per person, timestamps, and a percent
-- that the database itself keeps between 1 and 90.

-- AlterTable
ALTER TABLE "PromoCode" ADD COLUMN     "maxRedemptions" INTEGER,
ADD COLUMN     "oncePerUser" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Prisma fills updatedAt itself; the default above only gives the rows that already exist a value.
ALTER TABLE "PromoCode" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Written by hand: Prisma cannot express CHECK constraints. Existing rows (seed codes: 10 and 5 percent) satisfy them.
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_percent_check" CHECK ("percent" BETWEEN 1 AND 90);
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_maxRedemptions_check" CHECK ("maxRedemptions" IS NULL OR "maxRedemptions" >= 1);

-- CreateIndex
CREATE INDEX "Reservation_promoCode_status_idx" ON "Reservation"("promoCode", "status");
