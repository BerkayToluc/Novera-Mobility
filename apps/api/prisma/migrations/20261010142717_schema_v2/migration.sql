/*
  Warnings:

  - You are about to drop the column `locale` on the `FaqItem` table. All the data in the column will be lost.
  - You are about to drop the column `bags` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `brand` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `classId` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `dailyPrice` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `fuelType` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `model` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `seats` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `transmission` on the `Vehicle` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[plate]` on the table `Vehicle` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `question` on the `FaqItem` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `answer` on the `FaqItem` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `plate` to the `Vehicle` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vehicleModelId` to the `Vehicle` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('TRY', 'EUR', 'USD');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('INDIVIDUAL', 'CORPORATE');

-- CreateEnum
CREATE TYPE "ConsumptionUnit" AS ENUM ('L_PER_100KM', 'KWH_PER_100KM');

-- DropForeignKey
ALTER TABLE "Vehicle" DROP CONSTRAINT "Vehicle_classId_fkey";

-- DropIndex
DROP INDEX "FaqItem_audience_locale_idx";

-- DropIndex
DROP INDEX "Vehicle_classId_idx";

-- DropIndex
DROP INDEX "Vehicle_slug_key";

-- AlterTable
ALTER TABLE "FaqItem" DROP COLUMN "locale",
DROP COLUMN "question",
ADD COLUMN     "question" JSONB NOT NULL,
DROP COLUMN "answer",
ADD COLUMN     "answer" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "productId" TEXT,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'TRY',
ADD COLUMN     "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accountType" "AccountType" NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'TRY';

-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "bags",
DROP COLUMN "brand",
DROP COLUMN "classId",
DROP COLUMN "dailyPrice",
DROP COLUMN "fuelType",
DROP COLUMN "imageUrl",
DROP COLUMN "model",
DROP COLUMN "seats",
DROP COLUMN "slug",
DROP COLUMN "transmission",
ADD COLUMN     "plate" TEXT NOT NULL,
ADD COLUMN     "vehicleModelId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "PointTransaction" (
    "id" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "reservationId" TEXT,

    CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleModel" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "seats" INTEGER NOT NULL,
    "bags" INTEGER NOT NULL,
    "transmission" "Transmission" NOT NULL,
    "fuelType" "FuelType" NOT NULL,
    "consumption" DOUBLE PRECISION NOT NULL,
    "consumptionUnit" "ConsumptionUnit" NOT NULL,
    "dailyPrice" INTEGER NOT NULL,
    "description" JSONB NOT NULL,
    "imageUrl" TEXT,
    "classId" TEXT NOT NULL,

    CONSTRAINT "VehicleModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "concept" JSONB NOT NULL,
    "whatYouGet" JSONB NOT NULL,
    "techBenefits" JSONB NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "points" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "kvkkConsentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "currency" "Currency" NOT NULL,
    "ratePerTry" DECIMAL(18,8) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("currency")
);

-- CreateIndex
CREATE UNIQUE INDEX "PointTransaction_reservationId_key" ON "PointTransaction"("reservationId");

-- CreateIndex
CREATE INDEX "PointTransaction_userId_idx" ON "PointTransaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VehicleModel_slug_key" ON "VehicleModel"("slug");

-- CreateIndex
CREATE INDEX "VehicleModel_classId_idx" ON "VehicleModel"("classId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE INDEX "FaqItem_audience_idx" ON "FaqItem"("audience");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plate_key" ON "Vehicle"("plate");

-- CreateIndex
CREATE INDEX "Vehicle_vehicleModelId_idx" ON "Vehicle"("vehicleModelId");

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleModel" ADD CONSTRAINT "VehicleModel_classId_fkey" FOREIGN KEY ("classId") REFERENCES "VehicleClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_vehicleModelId_fkey" FOREIGN KEY ("vehicleModelId") REFERENCES "VehicleModel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
