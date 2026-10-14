/*
  Warnings:

  - A unique constraint covering the columns `[number]` on the table `QuoteRequest` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `topic` to the `FaqItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kvkkConsentAt` to the `QuoteRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `number` to the `QuoteRequest` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FaqTopic" AS ENUM ('rezervasyon', 'odeme', 'teslim', 'hasar', 'hesap', 'kurumsal');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('RECEIVED', 'IN_REVIEW', 'OFFERED');

-- DropIndex
DROP INDEX "FaqItem_audience_idx";

-- AlterTable
ALTER TABLE "FaqItem" ADD COLUMN     "topic" "FaqTopic" NOT NULL DEFAULT 'rezervasyon';
ALTER TABLE "FaqItem" ALTER COLUMN "topic" DROP DEFAULT;

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "deliveryCities" TEXT,
ADD COLUMN     "kvkkConsentAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "number" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "status" "QuoteStatus" NOT NULL DEFAULT 'RECEIVED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "companyCity" TEXT,
ADD COLUMN     "companyPhone" TEXT,
ADD COLUMN     "contactTitle" TEXT,
ADD COLUMN     "salesContactEmail" TEXT,
ADD COLUMN     "salesContactName" TEXT,
ADD COLUMN     "salesContactPhone" TEXT,
ADD COLUMN     "taxOffice" TEXT;

-- CreateIndex
CREATE INDEX "FaqItem_audience_topic_idx" ON "FaqItem"("audience", "topic");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRequest_number_key" ON "QuoteRequest"("number");
