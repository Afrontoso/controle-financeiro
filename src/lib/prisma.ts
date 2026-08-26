import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";

/**
 * O driver serverless do Neon fala por WebSocket na 443, e não pelo Postgres na
 * 5432 — o que atravessa redes que bloqueiam a porta do banco e dispensa manter
 * um pool de conexões TCP vivo entre invocações serverless.
 *
 * O WebSocket global existe a partir do Node 22; em runtimes mais antigos o
 * driver precisaria de um construtor próprio, então avisamos alto e claro.
 */
if (typeof WebSocket !== "undefined") {
  neonConfig.webSocketConstructor = WebSocket as typeof neonConfig.webSocketConstructor;
} else {
  console.error("[Prisma] Sem WebSocket global: use Node 22 ou mais recente.");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV !== "production") {
    const host = process.env.DATABASE_URL?.split("@")[1]?.split("/")[0];
    console.log(`[Prisma] Neon serverless (wss) em: ${host}`);
  }

  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Em dev o hot reload recria os módulos; sem o cache global cada recompilação
// deixaria um cliente órfão para trás.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
