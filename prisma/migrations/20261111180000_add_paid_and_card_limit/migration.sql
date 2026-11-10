-- Só acrescenta colunas opcionais. O código em produção continua funcionando
-- antes e depois desta migration.

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "paidAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Card" ADD COLUMN "limit" DOUBLE PRECISION;
