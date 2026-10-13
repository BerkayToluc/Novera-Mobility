/*
  Warnings:

  - You are about to drop the column `salesContactEmail` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `salesContactName` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `salesContactPhone` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "FaqItem_audience_topic_idx";

-- AlterTable
ALTER TABLE "FaqItem" ALTER COLUMN "topic" SET DEFAULT 'rezervasyon';

-- AlterTable
ALTER TABLE "Hold" ADD COLUMN     "clientKey" TEXT;

-- AlterTable
ALTER TABLE "QuoteRequest" ALTER COLUMN "kvkkConsentAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "salesContactEmail",
DROP COLUMN "salesContactName",
DROP COLUMN "salesContactPhone",
ADD COLUMN     "salesContact" JSONB;

-- CreateIndex
CREATE INDEX "FaqItem_audience_idx" ON "FaqItem"("audience");

-- CreateIndex
CREATE INDEX "FaqItem_topic_idx" ON "FaqItem"("topic");

-- CreateIndex
CREATE INDEX "Hold_clientKey_expiresAt_idx" ON "Hold"("clientKey", "expiresAt");

-- CreateIndex
CREATE INDEX "QuoteRequest_userId_idx" ON "QuoteRequest"("userId");
