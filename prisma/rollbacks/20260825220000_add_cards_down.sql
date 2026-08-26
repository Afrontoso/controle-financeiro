-- Reversão manual da migração 20260825220000_add_cards.
-- Rodar só em emergência: apaga os cartões cadastrados e o vínculo dos
-- lançamentos com eles (os lançamentos em si continuam intactos e voltam a
-- sair do saldo no dia da compra).
--
-- Depois de rodar, remover a linha da migração em "_prisma_migrations":
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20260825220000_add_cards';

ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_cardId_fkey";
DROP INDEX IF EXISTS "Transaction_cardId_idx";
ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "cardId";

ALTER TABLE "Card" DROP CONSTRAINT IF EXISTS "Card_userId_fkey";
DROP INDEX IF EXISTS "Card_userId_idx";
DROP TABLE IF EXISTS "Card";
