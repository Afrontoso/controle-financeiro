import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { isOpenFinanceOwner } from "@/lib/openFinanceSync";

/** Quantos dias de transações ignoradas a tela mostra para revisão. */
const IGNORED_WINDOW_DAYS = 45;

/**
 * Estado do Open Finance para a tela: retrato das contas, caixa de entrada e
 * ignoradas recentes. Para quem não é o dono das credenciais, só `enabled: false`.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { id?: string; email?: string | null } | undefined;
        if (!user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        if (!isOpenFinanceOwner(user.email)) return NextResponse.json({ enabled: false });

        const since = new Date(Date.now() - IGNORED_WINDOW_DAYS * 86_400_000);
        const [snapshot, pending, ignored, linked] = await Promise.all([
            prisma.bankSnapshot.findUnique({ where: { userId: user.id } }),
            prisma.bankTransaction.findMany({
                where: { userId: user.id, status: "pending" },
                orderBy: [{ date: "desc" }, { id: "asc" }],
            }),
            prisma.bankTransaction.findMany({
                where: { userId: user.id, status: "ignored", date: { gte: since } },
                orderBy: [{ date: "desc" }, { id: "asc" }],
            }),
            // Lançamentos seus já reconhecidos: não podem ser sugeridos de novo.
            prisma.bankTransaction.findMany({
                where: { userId: user.id, status: "linked", transactionId: { not: null } },
                select: { transactionId: true },
            }),
        ]);

        const toClient = (t: (typeof pending)[number]) => ({ ...t, date: t.date.toISOString().slice(0, 10) });
        return NextResponse.json({
            enabled: true,
            syncedAt: snapshot?.syncedAt ?? null,
            snapshot: snapshot?.data ?? null,
            pending: pending.map(toClient),
            ignored: ignored.map(toClient),
            linkedTransactionIds: linked.map((l) => l.transactionId),
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to load open finance" }, { status: 500 });
    }
}
