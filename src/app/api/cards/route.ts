import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/** Limite em reais; vazio, zero ou inválido = não informado. */
function parseLimit(value: unknown): number | null {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/** O vencimento é sempre um dia de mês válido; meses curtos são ajustados na UI. */
function parseDueDay(value: unknown): number | null {
    const day = Number(value);
    if (!Number.isInteger(day) || day < 1 || day > 31) return null;
    return day;
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }
        const userId = (session.user as any).id;

        const cards = await prisma.card.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' }
        });
        return NextResponse.json(cards);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch cards" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }
        const userId = (session.user as any).id;

        const { name, dueDay, limit } = await request.json();
        const day = parseDueDay(dueDay);

        if (!name || day === null) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const newCard = await prisma.card.create({
            data: { name, dueDay: day, limit: parseLimit(limit), userId },
        });

        return NextResponse.json(newCard, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to create card" }, { status: 500 });
    }
}
