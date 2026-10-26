-- CreateTable
CREATE TABLE "RateLimitHit" (
    "key" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "RateLimitHit_pkey" PRIMARY KEY ("key","bucket","windowStart")
);

-- The count is at least the one request that created the row.
ALTER TABLE "RateLimitHit" ADD CONSTRAINT "RateLimitHit_count_positive" CHECK ("count" >= 1);
