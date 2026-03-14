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

        const bodyText = await request.text();
        const body = bodyText ? JSON.parse(bodyText) : {};
        const { deleteAll } = body;

        const transaction = await prisma.transaction.findFirst({
            where: { id, userId },
            select: { groupId: true }
        });

        if (!transaction) {
            return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
        }

        if (deleteAll && transaction.groupId) {
            // Delete all transactions with the same groupId
            await prisma.transaction.deleteMany({
                where: { groupId: transaction.groupId }
            });
        } else {
            // Delete only this transaction
            await prisma.transaction.delete({
                where: { id }
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
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
        const { description, amount, type, date, updateAll } = data;

        const transaction = await prisma.transaction.findFirst({
            where: { id, userId },
            select: { groupId: true }
        });

        if (!transaction) {
            return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
        }

        const updateData: any = {};
        if (description !== undefined) updateData.description = description;
        if (amount !== undefined) updateData.amount = Number(amount);
        if (type !== undefined) updateData.type = type;

        if (updateAll && transaction.groupId) {
            // Edita o valor, tipo e descricao de todas as ocorrencias do grupo
            await prisma.transaction.updateMany({
                where: { groupId: transaction.groupId },
                data: updateData
            });
        } else {
            // Edita só esta e permite mudar a data (se mudar a data de 1 do grupo, fica com aquela nova data individual)
            if (date !== undefined) updateData.date = date;
            
            await prisma.transaction.update({
                where: { id },
                data: updateData
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Patch Error:", error);
        return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
    }
}
