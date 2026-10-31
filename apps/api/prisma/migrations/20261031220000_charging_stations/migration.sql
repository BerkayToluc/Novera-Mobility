-- V2-40: the fictitious charging stations of the Green Fleet screen (docs/FLEET.md section 3.1, ADR-30).

-- CreateTable
CREATE TABLE "ChargingStation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "sockets" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChargingStation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChargingStation_city_idx" ON "ChargingStation"("city");

-- CreateIndex
CREATE UNIQUE INDEX "ChargingStation_city_name_key" ON "ChargingStation"("city", "name");

-- V2-40 rules the schema cannot say. NOT VALID: checked for every new row at once, and the table is new, so there is nothing to validate
-- afterwards. A position is on the globe and a station has at least one socket.
ALTER TABLE "ChargingStation" ADD CONSTRAINT "ChargingStation_position_check" CHECK ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180) NOT VALID;
ALTER TABLE "ChargingStation" ADD CONSTRAINT "ChargingStation_sockets_check" CHECK (cardinality("sockets") >= 1) NOT VALID;
