-- Só acrescenta uma coluna opcional. O código em produção continua funcionando
-- antes e depois desta migration.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "settings" JSONB;
