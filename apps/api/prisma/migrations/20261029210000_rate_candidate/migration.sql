-- V2-13 (QUALITY V-10): a rate that moved too far waits here as a candidate until the feed repeats it on the third day.
-- CreateTable
CREATE TABLE "RateCandidate" (
    "currency" "Currency" NOT NULL,
    "ratePerTry" DECIMAL(18,8) NOT NULL,
    "since" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateCandidate_pkey" PRIMARY KEY ("currency")
);
