import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/vaultApi";

/** Quantos lançamentos cabem num pedido (uma fatura grande tem dezenas). */
const MAX_IDS = 500;

/**
 * Marca ou desmarca lançamentos como pagos. Recebe vários ids de uma vez para a
 * fatura do cartão, que é um item só na tela mas várias compras no banco.
 */
export async function POST(request: Request) {
    try {
        const userId = await currentUserId();
        if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

        const { ids, paid } = await request.json().catch(() => ({}));
        if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_IDS || !ids.every((id) => typeof id === "string")) {
            return NextResponse.json({ error: "ids inválidos" }, { status: 400 });
        }

        const { count } = await prisma.transaction.updateMany({
            where: { id: { in: ids }, userId },
            data: { paidAt: paid ? new Date() : null },
        });
        return NextResponse.json({ updated: count });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update paid status" }, { status: 500 });
    }
}
