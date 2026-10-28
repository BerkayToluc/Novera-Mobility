-- Session idle time and the sign-in wait (V2-10, QUALITY G-13 and G-15).

-- AlterTable: the sessions that exist now count as used now, so nobody is signed out by the new idle rule.
ALTER TABLE "Session" ADD COLUMN "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "LoginThrottle" (
    "email" TEXT NOT NULL,
    "failures" INTEGER NOT NULL,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("email")
);

-- At least one failure is what created the row.
ALTER TABLE "LoginThrottle" ADD CONSTRAINT "LoginThrottle_failures_positive" CHECK ("failures" >= 1);
