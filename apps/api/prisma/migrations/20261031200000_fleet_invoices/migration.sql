-- V2-37: the monthly invoices of the fleet customers (docs/FLEET.md section 5).

-- CreateTable
CREATE TABLE "FleetInvoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "issuedAt" DATE NOT NULL,
    "dueAt" DATE NOT NULL,
    "lines" JSONB NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "vat" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FleetInvoice_number_key" ON "FleetInvoice"("number");

-- CreateIndex
CREATE INDEX "FleetInvoice_period_idx" ON "FleetInvoice"("period");

-- CreateIndex
CREATE INDEX "FleetInvoice_companyId_issuedAt_idx" ON "FleetInvoice"("companyId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FleetInvoice_companyId_period_key" ON "FleetInvoice"("companyId", "period");

-- AddForeignKey
ALTER TABLE "FleetInvoice" ADD CONSTRAINT "FleetInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- V2-37 rules the schema cannot say (docs/FLEET.md §5). The CHECKs are NOT VALID: they are checked for every new row at once, and the
-- table is new, so there is nothing to validate afterwards.
ALTER TABLE "FleetInvoice" ADD CONSTRAINT "FleetInvoice_period_check" CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$') NOT VALID;
ALTER TABLE "FleetInvoice" ADD CONSTRAINT "FleetInvoice_amounts_check" CHECK ("subtotal" >= 0 AND "vat" >= 0 AND "total" = "subtotal" + "vat") NOT VALID;
ALTER TABLE "FleetInvoice" ADD CONSTRAINT "FleetInvoice_dates_check" CHECK ("dueAt" >= "issuedAt") NOT VALID;

-- Invoice numbers (FTR-<year>-<5 digits>) come from a sequence, like the contract numbers: two invoices made at the same moment never
-- meet on one number and nothing has to be retried.
CREATE SEQUENCE "FleetInvoiceNumber_seq";
