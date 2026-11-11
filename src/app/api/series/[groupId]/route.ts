import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/vaultApi";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SUFFIX = /(\s*\(\d+\/\d+\))\s*$/;

/** Início do dia `from` em UTC; sem data válida, hoje. */
function fromDate(value: unknown): Date {
    const str = typeof value === "string" && DATE_RE.test(value) ? value : new Date().toISOString().slice(0, 10);
    return new Date(`${str}T00:00:00.000Z`);
}

/**
 * Muda uma série daqui pra frente: valor, nome e dia das ocorrências a partir
 * de `from`. O passado fica como aconteceu.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
    try {
        const userId = await currentUserId();
        if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        const { groupId } = await params;
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

        const amount = body.amount === undefined ? undefined : Math.abs(Number(body.amount));
        if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
            return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
        }
        const description = typeof body.description === "string" ? body.description.trim().slice(0, 200) : undefined;
        if (description === "") return NextResponse.json({ error: "Nome vazio" }, { status: 400 });
        const day = body.day === undefined ? undefined : Math.round(Number(body.day));
        if (day !== undefined && (!Number.isInteger(day) || day < 1 || day > 31)) {
            return NextResponse.json({ error: "Dia inválido" }, { status: 400 });
        }

        // De quem é a renda: muda a série inteira, porque não é algo que varia mês a mês.
        if (typeof body.conjuge === "boolean") {
            const sample = await prisma.transaction.findFirst({ where: { userId, groupId }, select: { type: true } });
            if (sample?.type) {
                await prisma.transaction.updateMany({
                    where: { userId, groupId },
                    data: { category: body.conjuge ? `${sample.type}:conjuge` : sample.type },
                });
            }
        }

        const rows = await prisma.transaction.findMany({
            where: { userId, groupId, date: { gte: fromDate(body.from) } },
            select: { id: true, date: true, description: true, amount: true },
        });
        if (rows.length === 0) return NextResponse.json({ updated: 0 });

        await prisma.$transaction(
            rows.map((row) => {
                const data: { amount?: number; description?: string; date?: Date } = {};
                // O sinal continua o que era: saída negativa, entrada positiva.
                if (amount !== undefined) data.amount = row.amount < 0 ? -amount : amount;
                if (description !== undefined) {
                    const suffix = SUFFIX.exec(row.description)?.[1] ?? "";
                    data.description = `${description}${suffix}`;
                }
                if (day !== undefined) {
                    const y = row.date.getUTCFullYear();
                    const m = row.date.getUTCMonth();
                    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
                    data.date = new Date(Date.UTC(y, m, Math.min(day, last), 12));
                }
                return prisma.transaction.update({ where: { id: row.id }, data });
            }),
        );
        return NextResponse.json({ updated: rows.length });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Falha ao editar a série" }, { status: 500 });
    }
}

/** Encerra a série: apaga as ocorrências a partir de `from`. O passado fica. */
export async function DELETE(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
    try {
        const userId = await currentUserId();
        if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        const { groupId } = await params;
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const result = await prisma.transaction.deleteMany({
            where: { userId, groupId, date: { gte: fromDate(body.from) } },
        });
        return NextResponse.json({ deleted: result.count });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Falha ao encerrar a série" }, { status: 500 });
    }
}
