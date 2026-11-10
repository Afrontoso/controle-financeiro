import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/** Mesma palavra que o modal pede para digitar: um DELETE acidental não basta. */
const CONFIRMATION_WORD = "zerar";

/**
 * Apaga todos os lançamentos, orçamentos e cartões do usuário logado.
 * A conta e o login continuam intactos — é um recomeço, não uma exclusão de conta.
 */
export async function DELETE(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }
        const userId = (session.user as any).id;
        if (!userId) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        if (String(body?.confirm ?? "").trim().toLowerCase() !== CONFIRMATION_WORD) {
            return NextResponse.json({ error: "Confirmação ausente" }, { status: 400 });
        }

        // Tudo ou nada: se algo falhar no meio, nada é apagado.
        const [transactions, budgets, cards] = await prisma.$transaction([
            prisma.transaction.deleteMany({ where: { userId } }),
            prisma.budget.deleteMany({ where: { userId } }),
            prisma.card.deleteMany({ where: { userId } }),
            prisma.apartmentPlan.deleteMany({ where: { userId } }),
            prisma.vault.deleteMany({ where: { userId } }),
            // A caixa de entrada guarda o que já foi visto: some junto para recomeçar do zero.
            prisma.bankTransaction.deleteMany({ where: { userId } }),
        ]);

        return NextResponse.json({
            deleted: {
                transactions: transactions.count,
                budgets: budgets.count,
                cards: cards.count,
            },
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to reset data" }, { status: 500 });
    }
}
