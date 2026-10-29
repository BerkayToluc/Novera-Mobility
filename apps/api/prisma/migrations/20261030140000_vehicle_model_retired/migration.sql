-- AlterTable
ALTER TABLE "VehicleModel" ADD COLUMN     "retiredAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "VehicleModel_retiredAt_idx" ON "VehicleModel"("retiredAt");

-- Rules of a vehicle model that the administration relies on (V2-29, ADMIN.md §3.1), kept by the database as well as by the API.
-- Written by hand: Prisma cannot express CHECK constraints (the same as 20261025120000_promo_code_limits).
--
-- NOT VALID: the rules apply to every row written from now on, but the rows that are already there are not read, so a row that
-- somebody typed into the database by hand before the panel existed cannot make the deployment fail.

-- A price is above zero (in kuruş). The earlier check (20261029120000) only refuses a negative one.
ALTER TABLE "VehicleModel" ADD CONSTRAINT "VehicleModel_dailyPrice_positive_check" CHECK ("dailyPrice" > 0) NOT VALID;

-- The address of the model on the site: lower-case words joined by hyphens. It never changes once the model exists.
ALTER TABLE "VehicleModel" ADD CONSTRAINT "VehicleModel_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$') NOT VALID;

-- Seats and bags in a range a car can have, and a consumption that is a real number.
ALTER TABLE "VehicleModel" ADD CONSTRAINT "VehicleModel_seats_check" CHECK ("seats" BETWEEN 1 AND 9) NOT VALID;
ALTER TABLE "VehicleModel" ADD CONSTRAINT "VehicleModel_bags_check" CHECK ("bags" BETWEEN 0 AND 10) NOT VALID;
ALTER TABLE "VehicleModel" ADD CONSTRAINT "VehicleModel_consumption_check" CHECK ("consumption" > 0) NOT VALID;

-- An electric car is measured in kWh, every other car in litres.
ALTER TABLE "VehicleModel" ADD CONSTRAINT "VehicleModel_consumptionUnit_check" CHECK (("fuelType" = 'ELECTRIC') = ("consumptionUnit" = 'KWH_PER_100KM')) NOT VALID;
