import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId, parseVaultBody } from "@/lib/vaultApi";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userId = await currentUserId();
        if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

        const { id } = await params;
        const existing = await prisma.vault.findFirst({ where: { id, userId }, select: { id: true } });
        if (!existing) return NextResponse.json({ error: "Cofre não encontrado" }, { status: 404 });

        const { name, goal, goalMonths, initial, kind } = parseVaultBody(await request.json());
        if (name === "") return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

        const vault = await prisma.$transaction(async (tx) => {
            if (kind === "reserva") {
                await tx.vault.updateMany({
                    where: { userId, kind: "reserva", id: { not: id } },
                    data: { kind: "cofre" },
                });
            }
            return tx.vault.update({
                where: { id },
                data: {
                    ...(name !== undefined && { name }),
                    ...(goal !== undefined && { goal }),
                    ...(goalMonths !== undefined && { goalMonths }),
                    ...(initial !== undefined && { initial }),
                    ...(kind !== undefined && { kind }),
                },
            });
        });
        return NextResponse.json(vault);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update vault" }, { status: 500 });
    }
}

/**
 * Exclui o cofre. Os lançamentos ligados a ele continuam (o dinheiro saiu e
 * entrou do saldo de verdade), só perdem o vínculo.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const userId = await currentUserId();
        if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

        const { id } = await params;
        const { count } = await prisma.vault.deleteMany({ where: { id, userId } });
        if (count === 0) return NextResponse.json({ error: "Cofre não encontrado" }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to delete vault" }, { status: 500 });
    }
}
