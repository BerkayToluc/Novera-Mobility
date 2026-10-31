-- V2-43: the routes of the live tracking simulation (docs/FLEET.md section 3.1, ADR-30).

-- CreateTable
CREATE TABLE "TrackingRoute" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "points" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingRoute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackingRoute_city_idx" ON "TrackingRoute"("city");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingRoute_city_name_key" ON "TrackingRoute"("city", "name");


-- V2-43 rule the schema cannot say. NOT VALID: checked for every new row at once, and the table is new, so there is nothing to validate
-- afterwards. A route is a list of at least two points, so a car has somewhere to go.
ALTER TABLE "TrackingRoute" ADD CONSTRAINT "TrackingRoute_points_check" CHECK (jsonb_typeof("points") = 'array' AND jsonb_array_length("points") >= 2) NOT VALID;
