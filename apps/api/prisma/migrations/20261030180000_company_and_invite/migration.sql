-- V2-33: the company, and the invitation of a person to it.

-- What a password link is for: a forgotten password (1 hour) or a corporate invitation (7 days).
CREATE TYPE "ResetTokenKind" AS ENUM ('RESET', 'INVITE');
ALTER TABLE "PasswordResetToken" ADD COLUMN "kind" "ResetTokenKind" NOT NULL DEFAULT 'RESET';

-- The company.
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxOffice" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "salesContact" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- A company has a name of at least two characters. NOT VALID: it applies to every new and changed row and leaves the rows
-- already there alone (the same pattern as 20261029120000_database_integrity).
ALTER TABLE "Company" ADD CONSTRAINT "Company_name_length_check" CHECK (char_length(btrim("name")) >= 2) NOT VALID;

-- A corporate account points at its company. A company that still has people cannot be removed.
ALTER TABLE "User" ADD COLUMN "companyId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- DATA MOVE (the tests run this part against rows they make; keep it repeatable: it only touches corporate accounts that have a
-- company name and no company yet).
--
-- Every distinct company name (case and surrounding spaces do not count) becomes one company, with what the first account of
-- that name (the oldest) had. Every account of that name is then linked to it. The old columns stay where they are, unused:
-- dropping them in the same release would break a server that still runs the old code (V2-34 drops them).
INSERT INTO "Company" ("id", "name", "taxOffice", "city", "phone", "salesContact", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, first."name", first."taxOffice", first."city", first."phone", first."salesContact", first."createdAt", CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (lower(btrim(u."companyName")))
    btrim(u."companyName") AS "name",
    u."taxOffice" AS "taxOffice",
    u."companyCity" AS "city",
    u."companyPhone" AS "phone",
    u."salesContact" AS "salesContact",
    u."createdAt" AS "createdAt"
  FROM "User" u
  WHERE u."accountType" = 'CORPORATE' AND u."companyId" IS NULL AND btrim(coalesce(u."companyName", '')) <> ''
  ORDER BY lower(btrim(u."companyName")), u."createdAt"
) first
WHERE NOT EXISTS (SELECT 1 FROM "Company" c WHERE lower(c."name") = lower(first."name"));

UPDATE "User" u
SET "companyId" = c."id"
FROM "Company" c
WHERE u."accountType" = 'CORPORATE' AND u."companyId" IS NULL AND btrim(coalesce(u."companyName", '')) <> ''
  AND lower(c."name") = lower(btrim(u."companyName"));
-- END DATA MOVE
