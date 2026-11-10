-- Só acrescenta: tabela nova e coluna opcional. O código em produção continua
-- funcionando antes e depois desta migration.

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "source" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_userId_source_idx" ON "Transaction"("userId", "source");

-- CreateTable
CREATE TABLE "ApartmentPlan" (
    "id" TEXT NOT NULL,
    "premises" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ApartmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApartmentPlan_userId_key" ON "ApartmentPlan"("userId");

-- AddForeignKey
ALTER TABLE "ApartmentPlan" ADD CONSTRAINT "ApartmentPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
