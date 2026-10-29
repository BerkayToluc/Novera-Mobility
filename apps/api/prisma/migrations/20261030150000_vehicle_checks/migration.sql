-- V2-30: the rules of a car that the panel enforces, held by the database as well (the same pattern as 20261029120000_database_integrity).
-- NOT VALID: they apply to every new and changed row and leave the rows already there alone, so the migration cannot fail on old data.

-- A Turkish plate in its stored form, "34 ABC 123": province 01 to 81, one to three letters (no Q, W, X), two to four digits.
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_plate_format_check"
  CHECK ("plate" ~ '^(0[1-9]|[1-7][0-9]|8[01]) [ABCDEFGHIJKLMNOPRSTUVYZ]{1,3} [0-9]{2,4}$') NOT VALID;

-- The year of a car: 2015 on. The upper bound moves every year, so the API keeps it; this one only stops nonsense.
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_year_range_check" CHECK ("year" BETWEEN 2015 AND 2100) NOT VALID;
