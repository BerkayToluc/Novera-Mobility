-- CreateEnum
CREATE TYPE "BranchKind" AS ENUM ('CITY', 'AIRPORT');

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "kind" "BranchKind" NOT NULL DEFAULT 'CITY';

-- CreateIndex
CREATE INDEX "Branch_closedAt_idx" ON "Branch"("closedAt");

-- The kind used to be read from the name in the web ("... Havalimanı"); the branches that exist get it here, once, in the same
-- way (with and without the Turkish letters), so no branch changes its look. New branches choose it in the panel.
UPDATE "Branch" SET "kind" = 'AIRPORT' WHERE "name" ILIKE '%havalimanı%' OR "name" ILIKE '%havalimani%';
