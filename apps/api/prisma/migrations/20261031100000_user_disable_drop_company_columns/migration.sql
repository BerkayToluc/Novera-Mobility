-- V2-34: account disabling, and the second half of moving the company fields (V2-33 expanded, this contracts).

-- Account disabling: a set date means the account cannot sign in (password or Google) and its sessions are gone.
ALTER TABLE "User" ADD COLUMN "disabledAt" TIMESTAMP(3);

-- The company fields of a corporate account live on "Company" since V2-33, and no code reads the old columns any more. Before they
-- go, make sure nothing is left behind: a corporate account that has a company name and no company would lose it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "User"
    WHERE "accountType" = 'CORPORATE' AND btrim(coalesce("companyName", '')) <> '' AND "companyId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Corporate accounts with a company name and no company exist; run the V2-33 data move first';
  END IF;
END $$;

ALTER TABLE "User"
  DROP COLUMN "companyName",
  DROP COLUMN "taxOffice",
  DROP COLUMN "companyCity",
  DROP COLUMN "companyPhone",
  DROP COLUMN "salesContact";
