import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId, parseVaultBody } from "@/lib/vaultApi";

export async function GET() {
    try {
        const userId = await currentUserId();
        if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

        const vaults = await prisma.vault.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
        return NextResponse.json(vaults);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch vaults" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const userId = await currentUserId();
        if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

        const { name, goal, initial, kind } = parseVaultBody(await request.json());
        if (!name) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

        const vault = await prisma.$transaction(async (tx) => {
            // Uma reserva só: marcar outra desmarca a anterior.
            if (kind === "reserva") {
                await tx.vault.updateMany({ where: { userId, kind: "reserva" }, data: { kind: "cofre" } });
            }
            return tx.vault.create({
                data: { name, goal: goal ?? null, initial: initial ?? 0, kind: kind ?? "cofre", userId },
            });
        });
        return NextResponse.json(vault, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create vault" }, { status: 500 });
    }
}
