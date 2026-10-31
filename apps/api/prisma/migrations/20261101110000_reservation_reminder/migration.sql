-- V2-44: the travel reminder is sent once per booking (docs/ARCHITECTURE.md ADR-32).
-- The moment it was sent; set by one conditional update before the e-mail goes out, so no second run can send it again.

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Reservation_status_startAt_idx" ON "Reservation"("status", "startAt");
