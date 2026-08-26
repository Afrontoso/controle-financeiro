import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

function parseDueDay(value: unknown): number | null {
    const day = Number(value);
    if (!Number.isInteger(day) || day < 1 || day > 31) return null;
    return day;
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }
        const userId = (session.user as any).id;

        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: "No ID provided" }, { status: 400 });
        }

        const data = await request.json();

        const card = await prisma.card.findFirst({ where: { id, userId } });
        if (!card) return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });

        const day = data.dueDay === undefined ? undefined : parseDueDay(data.dueDay);
        if (day === null) {
            return NextResponse.json({ error: "Invalid dueDay" }, { status: 400 });
        }

        const updatedCard = await prisma.card.update({
            where: { id },
            data: {
                name: data.name,
                dueDay: day,
            },
        });

        return NextResponse.json(updatedCard, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to update card" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }
        const userId = (session.user as any).id;

        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: "No ID provided" }, { status: 400 });
        }

        const card = await prisma.card.findFirst({ where: { id, userId } });
        if (!card) return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });

        // Os lançamentos ficam sem cartão (onDelete: SetNull) e voltam a sair no
        // dia da compra em vez de esperar a fatura.
        await prisma.card.delete({ where: { id } });

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete card" }, { status: 500 });
    }
}
