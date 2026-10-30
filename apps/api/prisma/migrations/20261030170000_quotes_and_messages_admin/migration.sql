-- V2-32: the sales team follows quote requests and contact messages from the panel.

-- A quote request can be closed. (A new enum value cannot be used in the transaction that adds it; nothing here uses it.)
ALTER TYPE "QuoteStatus" ADD VALUE 'CLOSED';

-- Where a quote came from: the form on the site, or a contract renewal asked from Filom (V2-38).
CREATE TYPE "QuoteSource" AS ENUM ('WEB', 'FLEET_RENEWAL');
ALTER TABLE "QuoteRequest" ADD COLUMN "source" "QuoteSource" NOT NULL DEFAULT 'WEB';

-- The note only staff read. Never part of an answer to the customer.
ALTER TABLE "QuoteRequest" ADD COLUMN "internalNote" TEXT;
ALTER TABLE "QuoteRequest" ADD CONSTRAINT "QuoteRequest_internalNote_length_check"
  CHECK ("internalNote" IS NULL OR char_length("internalNote") <= 2000) NOT VALID;

-- "Handled": when, and by which administrator (the account may be removed later; the mark stays).
ALTER TABLE "ContactMessage" ADD COLUMN "handledAt" TIMESTAMP(3);
ALTER TABLE "ContactMessage" ADD COLUMN "handledById" TEXT;
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_handledById_fkey"
  FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ContactMessage_handledAt_idx" ON "ContactMessage"("handledAt");
