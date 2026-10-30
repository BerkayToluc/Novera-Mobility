-- V2-31: who cancelled a booking from the panel, and why.
ALTER TABLE "Reservation" ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "cancelledById" TEXT;

-- The administrator who cancelled it. The account may be removed later; the booking and its reason stay.
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_cancelledById_fkey"
  FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The reason is 5 to 500 characters when there is one. NOT VALID: it applies to every new and changed row and leaves the rows
-- already there alone (the same pattern as 20261029120000_database_integrity).
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_cancelReason_length_check"
  CHECK ("cancelReason" IS NULL OR char_length("cancelReason") BETWEEN 5 AND 500) NOT VALID;
