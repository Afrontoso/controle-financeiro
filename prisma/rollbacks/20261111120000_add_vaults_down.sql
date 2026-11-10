ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_vaultId_fkey";
DROP INDEX IF EXISTS "Transaction_vaultId_idx";
ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "vaultId";
DROP TABLE IF EXISTS "Vault";
