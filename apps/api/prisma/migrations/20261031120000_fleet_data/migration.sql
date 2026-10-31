-- V2-35: the data under Filom (docs/FLEET.md §5): employees, contracts, fleet vehicles, assignments, readings.

-- CreateEnum
CREATE TYPE "FleetContractStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "FleetVehicleStatus" AS ENUM ('ACTIVE', 'RETURNED');

-- CreateEnum
CREATE TYPE "ReadingSource" AS ENUM ('MANUAL', 'SEED');

-- CreateTable
CREATE TABLE "CompanyEmployee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "department" TEXT,
    "employeeNo" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetContract" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "startAt" DATE NOT NULL,
    "endAt" DATE NOT NULL,
    "monthlyFee" INTEGER NOT NULL,
    "deliveryCity" TEXT NOT NULL,
    "status" "FleetContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetVehicle" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleModelId" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "startKm" INTEGER NOT NULL,
    "nextMaintenanceOn" DATE,
    "inspectionDueOn" DATE,
    "status" "FleetVehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleAssignment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fleetVehicleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleReading" (
    "id" TEXT NOT NULL,
    "fleetVehicleId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "km" INTEGER NOT NULL,
    "fuelPercent" INTEGER,
    "chargePercent" INTEGER,
    "batteryHealthPercent" INTEGER,
    "source" "ReadingSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyEmployee_companyId_active_idx" ON "CompanyEmployee"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyEmployee_id_companyId_key" ON "CompanyEmployee"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyEmployee_companyId_employeeNo_key" ON "CompanyEmployee"("companyId", "employeeNo");

-- CreateIndex
CREATE UNIQUE INDEX "FleetContract_number_key" ON "FleetContract"("number");

-- CreateIndex
CREATE INDEX "FleetContract_companyId_status_idx" ON "FleetContract"("companyId", "status");

-- CreateIndex
CREATE INDEX "FleetContract_productId_idx" ON "FleetContract"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "FleetContract_id_companyId_key" ON "FleetContract"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "FleetVehicle_plate_key" ON "FleetVehicle"("plate");

-- CreateIndex
CREATE INDEX "FleetVehicle_contractId_idx" ON "FleetVehicle"("contractId");

-- CreateIndex
CREATE INDEX "FleetVehicle_companyId_status_idx" ON "FleetVehicle"("companyId", "status");

-- CreateIndex
CREATE INDEX "FleetVehicle_vehicleModelId_idx" ON "FleetVehicle"("vehicleModelId");

-- CreateIndex
CREATE UNIQUE INDEX "FleetVehicle_id_companyId_key" ON "FleetVehicle"("id", "companyId");

-- CreateIndex
CREATE INDEX "VehicleAssignment_fleetVehicleId_startedAt_idx" ON "VehicleAssignment"("fleetVehicleId", "startedAt");

-- CreateIndex
CREATE INDEX "VehicleAssignment_employeeId_idx" ON "VehicleAssignment"("employeeId");

-- CreateIndex
CREATE INDEX "VehicleAssignment_companyId_idx" ON "VehicleAssignment"("companyId");

-- CreateIndex
CREATE INDEX "VehicleReading_fleetVehicleId_at_idx" ON "VehicleReading"("fleetVehicleId", "at");

-- AddForeignKey
ALTER TABLE "CompanyEmployee" ADD CONSTRAINT "CompanyEmployee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetContract" ADD CONSTRAINT "FleetContract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetContract" ADD CONSTRAINT "FleetContract_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetVehicle" ADD CONSTRAINT "FleetVehicle_contractId_companyId_fkey" FOREIGN KEY ("contractId", "companyId") REFERENCES "FleetContract"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetVehicle" ADD CONSTRAINT "FleetVehicle_vehicleModelId_fkey" FOREIGN KEY ("vehicleModelId") REFERENCES "VehicleModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_fleetVehicleId_companyId_fkey" FOREIGN KEY ("fleetVehicleId", "companyId") REFERENCES "FleetVehicle"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_employeeId_companyId_fkey" FOREIGN KEY ("employeeId", "companyId") REFERENCES "CompanyEmployee"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleReading" ADD CONSTRAINT "VehicleReading_fleetVehicleId_fkey" FOREIGN KEY ("fleetVehicleId") REFERENCES "FleetVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- V2-35 rules the schema cannot say (docs/FLEET.md §5). The CHECKs are NOT VALID: they are checked for every new row at once, and
-- the tables are new, so there is nothing to validate afterwards.

ALTER TABLE "FleetContract" ADD CONSTRAINT "FleetContract_dates_check" CHECK ("endAt" > "startAt") NOT VALID;
ALTER TABLE "FleetContract" ADD CONSTRAINT "FleetContract_monthlyFee_check" CHECK ("monthlyFee" > 0) NOT VALID;
ALTER TABLE "FleetVehicle" ADD CONSTRAINT "FleetVehicle_startKm_check" CHECK ("startKm" >= 0) NOT VALID;
ALTER TABLE "FleetVehicle" ADD CONSTRAINT "FleetVehicle_year_check" CHECK ("year" BETWEEN 2000 AND 2100) NOT VALID;
-- A plate is kept in the one form "34 ABC 123" (V2-30), so two ways of typing it are never two plates.
ALTER TABLE "FleetVehicle" ADD CONSTRAINT "FleetVehicle_plate_check" CHECK ("plate" ~ '^[0-9]{2} [A-Z]{1,3} [0-9]{2,4}$') NOT VALID;
ALTER TABLE "VehicleAssignment" ADD CONSTRAINT "VehicleAssignment_dates_check" CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt") NOT VALID;
ALTER TABLE "VehicleReading" ADD CONSTRAINT "VehicleReading_km_check" CHECK ("km" >= 0) NOT VALID;
ALTER TABLE "VehicleReading" ADD CONSTRAINT "VehicleReading_percent_check" CHECK (
  ("fuelPercent" IS NULL OR "fuelPercent" BETWEEN 0 AND 100)
  AND ("chargePercent" IS NULL OR "chargePercent" BETWEEN 0 AND 100)
  AND ("batteryHealthPercent" IS NULL OR "batteryHealthPercent" BETWEEN 0 AND 100)
) NOT VALID;

-- A car has at most one open assignment (a partial unique index: Prisma cannot say it). The service checks first and answers
-- 409 VEHICLE_ASSIGNED; this is what holds when two requests arrive at the same moment.
CREATE UNIQUE INDEX "VehicleAssignment_open_vehicle_key" ON "VehicleAssignment"("fleetVehicleId") WHERE "endedAt" IS NULL;

-- Contract numbers (SZL-<year>-<5 digits>) come from a sequence, like the reservation numbers: two contracts made at the same
-- moment never meet on one number and nothing has to be retried.
CREATE SEQUENCE "FleetContractNumber_seq";
