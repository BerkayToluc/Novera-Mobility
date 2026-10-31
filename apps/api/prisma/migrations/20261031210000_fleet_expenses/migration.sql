-- V2-38: the costs of the fleet customers: HGS, penalties, maintenance (docs/FLEET.md section 5).

-- CreateEnum
CREATE TYPE "FleetExpenseType" AS ENUM ('HGS', 'PENALTY', 'MAINTENANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "FleetExpenseStatus" AS ENUM ('OPEN', 'REFLECTED', 'DISPUTED');

-- CreateTable
CREATE TABLE "FleetExpense" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fleetVehicleId" TEXT NOT NULL,
    "type" "FleetExpenseType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT,
    "place" TEXT,
    "status" "FleetExpenseStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FleetExpense_companyId_occurredAt_idx" ON "FleetExpense"("companyId", "occurredAt");

-- CreateIndex
CREATE INDEX "FleetExpense_companyId_status_idx" ON "FleetExpense"("companyId", "status");

-- CreateIndex
CREATE INDEX "FleetExpense_fleetVehicleId_occurredAt_idx" ON "FleetExpense"("fleetVehicleId", "occurredAt");

-- AddForeignKey
ALTER TABLE "FleetExpense" ADD CONSTRAINT "FleetExpense_fleetVehicleId_companyId_fkey" FOREIGN KEY ("fleetVehicleId", "companyId") REFERENCES "FleetVehicle"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- V2-38 rules the schema cannot say (docs/FLEET.md §5). NOT VALID: checked for every new row at once, and the table is new, so there is
-- nothing to validate afterwards. The amount is TRY kuruş and a cost of nothing is no cost.
ALTER TABLE "FleetExpense" ADD CONSTRAINT "FleetExpense_amount_check" CHECK ("amount" > 0) NOT VALID;
