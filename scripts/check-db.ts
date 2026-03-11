import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const txs = await prisma.transaction.findMany({ take: 5, orderBy: { createdAt: "desc" }})
  console.log(JSON.stringify(txs, null, 2))
}
main().finally(() => prisma.$disconnect())
