DROP TABLE IF EXISTS "ApartmentPlan";
DROP INDEX IF EXISTS "Transaction_userId_source_idx";
ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "source";
