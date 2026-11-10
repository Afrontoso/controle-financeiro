import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { isOpenFinanceOwner } from "@/lib/openFinanceSync";
import { isTxType } from "@/lib/types";

/** Uma decisão da caixa de entrada. */
interface Action {
    id: string;
    /** import: cria lançamento · link: reconhece um seu · ignore · restore: volta para a caixa. */
    action: "import" | "link" | "ignore" | "restore";
    type?: string;
    description?: string;
    amount?: number;
    date?: string;
    cardId?: string | null;
    vaultId?: string | null;
    /** Lançamento seu reconhecido (action "link"). */
    transactionId?: string;
}

const MAX_ACTIONS = 200;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Aplica as decisões da caixa de entrada. Cada uma é independente: uma que
 * falhe (lançamento apagado no meio do caminho, por exemplo) não trava as outras.
 */
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { id?: string; email?: string | null } | undefined;
        if (!user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        if (!isOpenFinanceOwner(user.email)) return NextResponse.json({ error: "Indisponível" }, { status: 403 });
        const userId = user.id;

        const { actions } = (await request.json().catch(() => ({}))) as { actions?: Action[] };
        if (!Array.isArray(actions) || actions.length === 0 || actions.length > MAX_ACTIONS) {
            return NextResponse.json({ error: "Nenhuma ação" }, { status: 400 });
        }

        const bankTxs = await prisma.bankTransaction.findMany({
            where: { userId, id: { in: actions.map((a) => a.id) } },
        });
        const byId = new Map(bankTxs.map((t) => [t.id, t]));
        const [cards, vaults] = await Promise.all([
            prisma.card.findMany({ where: { userId }, select: { id: true } }),
            prisma.vault.findMany({ where: { userId }, select: { id: true } }),
        ]);
        const cardIds = new Set(cards.map((c) => c.id));
        const vaultIds = new Set(vaults.map((v) => v.id));

        const done: string[] = [];
        const failed: string[] = [];

        for (const a of actions) {
            const bank = byId.get(a.id);
            if (!bank) {
                failed.push(a.id);
                continue;
            }
            try {
                if (a.action === "ignore" && bank.status === "pending") {
                    await prisma.bankTransaction.update({
                        where: { id: bank.id },
                        data: { status: "ignored", reason: "ignorada por você" },
                    });
                } else if (a.action === "restore" && bank.status === "ignored") {
                    await prisma.bankTransaction.update({
                        where: { id: bank.id },
                        data: { status: "pending", reason: null },
                    });
                } else if (a.action === "link" && bank.status === "pending" && a.transactionId) {
                    const target = await prisma.transaction.findFirst({
                        where: { id: a.transactionId, userId },
                        select: { id: true, paidAt: true },
                    });
                    if (!target) throw new Error("lançamento não encontrado");
                    await prisma.$transaction([
                        prisma.transaction.update({
                            where: { id: target.id },
                            data: { paidAt: target.paidAt ?? new Date() },
                        }),
                        prisma.bankTransaction.update({
                            where: { id: bank.id },
                            data: { status: "linked", transactionId: target.id },
                        }),
                    ]);
                } else if (a.action === "import" && bank.status === "pending") {
                    const type = isTxType(a.type) ? a.type : "saida";
                    const amount = Math.abs(Number(a.amount ?? bank.amount));
                    const date = typeof a.date === "string" && DATE_RE.test(a.date) ? a.date : bank.date.toISOString().slice(0, 10);
                    const description = (a.description ?? bank.description).trim().slice(0, 200) || bank.description;
                    const cardId = type === "cartao" && a.cardId && cardIds.has(a.cardId) ? a.cardId : null;
                    const vaultId =
                        (type === "investimento" || type === "entrada") && a.vaultId && vaultIds.has(a.vaultId) ? a.vaultId : null;
                    if (!Number.isFinite(amount) || amount <= 0) throw new Error("valor inválido");

                    // Cria o lançamento e liga a transação do banco juntos, ou nenhum dos dois.
                    await prisma.$transaction(async (tx) => {
                        const created = await tx.transaction.create({
                            data: {
                                // Mesmo formato dos lançamentos manuais: meio-dia e saída negativa.
                                date: new Date(`${date}T12:00:00.000Z`),
                                description,
                                amount: type === "entrada" ? amount : -amount,
                                type,
                                category: type,
                                isForecast: false,
                                cardId,
                                vaultId,
                                source: "pluggy",
                                // Veio do banco: já aconteceu.
                                paidAt: new Date(),
                                userId,
                            },
                        });
                        await tx.bankTransaction.update({
                            where: { id: bank.id },
                            data: { status: "imported", transactionId: created.id },
                        });
                    });
                } else {
                    failed.push(a.id);
                    continue;
                }
                done.push(a.id);
            } catch (error) {
                console.error("Ação da caixa de entrada falhou:", a.id, error);
                failed.push(a.id);
            }
        }

        return NextResponse.json({ done, failed });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to resolve" }, { status: 500 });
    }
}
