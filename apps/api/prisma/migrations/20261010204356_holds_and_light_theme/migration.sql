-- AlterTable
ALTER TABLE "User" ALTER COLUMN "theme" SET DEFAULT 'LIGHT';

-- CreateTable
CREATE TABLE "Hold" (
    "id" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "pickupBranchId" TEXT NOT NULL,
    "returnBranchId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicleId" TEXT NOT NULL,

    CONSTRAINT "Hold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Hold_vehicleId_startAt_endAt_idx" ON "Hold"("vehicleId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "Hold_expiresAt_idx" ON "Hold"("expiresAt");

-- AddForeignKey
ALTER TABLE "Hold" ADD CONSTRAINT "Hold_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
