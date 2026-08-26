import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const txs = await prisma.transaction.findMany({ take: 5, orderBy: { createdAt: "desc" } });
  console.log(JSON.stringify(txs, null, 2));
}

main().finally(() => prisma.$disconnect());
