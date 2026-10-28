-- V2-12 (QUALITY V-07): when the personal fields of a contact message or quote request were erased.
-- AlterTable
ALTER TABLE "ContactMessage" ADD COLUMN     "anonymizedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN     "anonymizedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt");

-- CreateIndex
CREATE INDEX "QuoteRequest_createdAt_idx" ON "QuoteRequest"("createdAt");
