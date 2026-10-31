-- V2-41: the service requests of the fleet customers and their timeline (docs/FLEET.md section 3, ARCHITECTURE ADR-31).

-- CreateEnum
CREATE TYPE "ServiceRequestType" AS ENUM ('ROADSIDE', 'REPLACEMENT_VEHICLE', 'MAINTENANCE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('RECEIVED', 'DISPATCHED', 'EN_ROUTE', 'APPROVED', 'DELIVERED', 'RETURNED', 'SCHEDULED', 'IN_SERVICE', 'DRIVER_ASSIGNED', 'MET', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ServiceRequestActor" AS ENUM ('COMPANY', 'NOVERA');

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT,
    "type" "ServiceRequestType" NOT NULL,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "fleetVehicleId" TEXT,
    "details" JSONB NOT NULL,
    "assignee" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequestEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" "ServiceRequestStatus" NOT NULL,
    "note" TEXT,
    "actor" "ServiceRequestActor" NOT NULL,
    "actorId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceRequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceRequest_number_key" ON "ServiceRequest"("number");

-- CreateIndex
CREATE INDEX "ServiceRequest_companyId_createdAt_idx" ON "ServiceRequest"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceRequest_status_idx" ON "ServiceRequest"("status");

-- CreateIndex
CREATE INDEX "ServiceRequest_fleetVehicleId_idx" ON "ServiceRequest"("fleetVehicleId");

-- CreateIndex
CREATE INDEX "ServiceRequestEvent_requestId_at_idx" ON "ServiceRequestEvent"("requestId", "at");

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_fleetVehicleId_fkey" FOREIGN KEY ("fleetVehicleId") REFERENCES "FleetVehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequestEvent" ADD CONSTRAINT "ServiceRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- V2-41 rules the schema cannot say (docs/FLEET.md section 3). The CHECKs are NOT VALID: they are checked for every new row at once, and the
-- tables are new, so there is nothing to validate afterwards.

-- `details` is an object, free text is short, and every kind but a transfer is about one of the company's cars.
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_details_check" CHECK (jsonb_typeof("details") = 'object') NOT VALID;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_assignee_check" CHECK ("assignee" IS NULL OR char_length("assignee") <= 200) NOT VALID;
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_vehicle_check" CHECK ("type" = 'TRANSFER' OR "fleetVehicleId" IS NOT NULL) NOT VALID;
ALTER TABLE "ServiceRequestEvent" ADD CONSTRAINT "ServiceRequestEvent_note_check" CHECK ("note" IS NULL OR char_length("note") <= 500) NOT VALID;

-- Each kind has its own steps (SPEC section 3.D): a roadside request is never "delivered", a replacement car never "in service".
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_status_check" CHECK (
  ("type" = 'ROADSIDE' AND "status" IN ('RECEIVED', 'DISPATCHED', 'EN_ROUTE', 'COMPLETED', 'CANCELLED'))
  OR ("type" = 'REPLACEMENT_VEHICLE' AND "status" IN ('RECEIVED', 'APPROVED', 'DELIVERED', 'RETURNED', 'CANCELLED'))
  OR ("type" = 'MAINTENANCE' AND "status" IN ('RECEIVED', 'SCHEDULED', 'IN_SERVICE', 'COMPLETED', 'CANCELLED'))
  OR ("type" = 'TRANSFER' AND "status" IN ('RECEIVED', 'DRIVER_ASSIGNED', 'MET', 'COMPLETED', 'CANCELLED'))
) NOT VALID;

-- Request numbers (TLP-<year>-<5 digits>) come from a sequence, like the invoice numbers: two requests made at the same moment never meet on
-- one number and nothing has to be retried.
CREATE SEQUENCE "ServiceRequestNumber_seq";

-- The car of a request is the company's own. The relation is on the car alone (a request about a transfer has no car, which a composite key
-- cannot say), so the company is compared here, and a request cannot be moved to another company's car by any statement.
CREATE FUNCTION "service_request_vehicle_company"() RETURNS trigger AS $$
BEGIN
  IF NEW."fleetVehicleId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "FleetVehicle" v WHERE v."id" = NEW."fleetVehicleId" AND v."companyId" = NEW."companyId") THEN
    RAISE EXCEPTION 'The vehicle of a service request belongs to the company of the request' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ServiceRequest_vehicle_company" BEFORE INSERT OR UPDATE OF "fleetVehicleId", "companyId" ON "ServiceRequest"
  FOR EACH ROW EXECUTE FUNCTION "service_request_vehicle_company"();
