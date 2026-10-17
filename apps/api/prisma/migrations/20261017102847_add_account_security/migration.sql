/*
  Warnings:

  - You are about to drop the column `pointsUsed` on the `Reservation` table. All the data in the column will be lost.

*/
-- AlterTable
-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyCampaigns" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notifyReminders" BOOLEAN NOT NULL DEFAULT true;