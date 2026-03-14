import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

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

        const budget = await prisma.budget.findFirst({ where: { id, userId } });
        if (!budget) return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });

        await prisma.budget.delete({
            where: { id },
        });

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete budget" }, { status: 500 });
    }
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

        const budget = await prisma.budget.findFirst({ where: { id, userId } });
        if (!budget) return NextResponse.json({ error: "Not found or forbidden" }, { status: 404 });

        const updatedBudget = await prisma.budget.update({
            where: { id },
            data: {
                name: data.name,
                amount: data.amount ? parseFloat(data.amount) : undefined,
                divideBy: data.divideBy ? parseInt(data.divideBy) : undefined,
            },
        });

        return NextResponse.json(updatedBudget, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to update budget" }, { status: 500 });
    }
}
