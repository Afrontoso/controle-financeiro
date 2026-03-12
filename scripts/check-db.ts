import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})
const prisma = new PrismaClient({ adapter })
async function main() {
  const txs = await prisma.transaction.findMany({ take: 5, orderBy: { createdAt: "desc" }})
  console.log(JSON.stringify(txs, null, 2))
}
main().finally(() => prisma.$disconnect())
