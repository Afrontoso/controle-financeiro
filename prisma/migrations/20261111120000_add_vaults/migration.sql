-- Só acrescenta: tabela nova e coluna opcional. O código em produção continua
-- funcionando antes e depois desta migration.

-- CreateTable
CREATE TABLE "Vault" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" DOUBLE PRECISION,
    "initial" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'cofre',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "Vault_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vault_userId_idx" ON "Vault"("userId");

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "vaultId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_vaultId_idx" ON "Transaction"("vaultId");

-- AddForeignKey
ALTER TABLE "Vault" ADD CONSTRAINT "Vault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE SET NULL ON UPDATE CASCADE;
