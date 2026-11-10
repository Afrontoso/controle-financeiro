import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
    generateTransactions,
    isPlanComplete,
    normalizePremises,
    SOURCE_PREFIX,
} from "@/lib/apartment";

/**
 * Refaz os lançamentos do plano de `fromDate` em diante: apaga os gerados
 * antes e cria de novo a partir das premissas atuais. Lançamentos manuais e
 * os do plano que já passaram não são tocados.
 *
 * `fromDate` vem do navegador porque "hoje" depende do fuso de quem usa; o
 * servidor da Vercel roda em UTC.
 */
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        const userId = (session?.user as { id?: string } | undefined)?.id;
        if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

        const { fromDate } = await request.json().catch(() => ({}));
        if (typeof fromDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
            return NextResponse.json({ error: "fromDate inválido" }, { status: 400 });
        }

        const plan = await prisma.apartmentPlan.findUnique({ where: { userId } });
        if (!plan) return NextResponse.json({ error: "Plano não cadastrado" }, { status: 404 });

        const premises = normalizePremises(plan.premises);
        if (!isPlanComplete(premises)) {
            return NextResponse.json({ error: "Plano incompleto" }, { status: 400 });
        }

        const generated = generateTransactions(premises, fromDate);

        // Uma série por componente: editar "todas as parcelas" no app continua funcionando.
        const groupIds = new Map<string, string>();
        const data = generated.map((tx) => {
            let groupId = groupIds.get(tx.source);
            if (!groupId) {
                groupId = crypto.randomUUID();
                groupIds.set(tx.source, groupId);
            }
            return {
                // Mesmo formato dos lançamentos manuais: meio-dia e saída negativa.
                date: new Date(`${tx.date}T12:00:00.000Z`),
                description: tx.description,
                amount: -Math.abs(tx.amount),
                type: "saida",
                category: "saida",
                isForecast: true,
                groupId,
                source: tx.source,
                userId,
            };
        });

        const regenerated = {
            userId,
            source: { startsWith: SOURCE_PREFIX },
            date: { gte: new Date(`${fromDate}T00:00:00.000Z`) },
        };

        // Parcela já marcada como paga (adiantada) continua paga depois de refeita.
        const paid = await prisma.transaction.findMany({
            where: { ...regenerated, paidAt: { not: null } },
            select: { source: true, date: true, paidAt: true },
        });
        const paidKey = (source: string | null, date: Date) => `${source}|${date.toISOString().slice(0, 10)}`;
        const paidAt = new Map(paid.map((tx) => [paidKey(tx.source, tx.date), tx.paidAt]));
        for (const tx of data) {
            const when = paidAt.get(paidKey(tx.source, tx.date));
            if (when) Object.assign(tx, { paidAt: when });
        }

        const [removed, created] = await prisma.$transaction([
            prisma.transaction.deleteMany({ where: regenerated }),
            prisma.transaction.createMany({ data }),
        ]);

        return NextResponse.json({ removed: removed.count, created: created.count });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to sync plan" }, { status: 500 });
    }
}
