import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: "No ID provided" }, { status: 400 });
        }

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
        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: "No ID provided" }, { status: 400 });
        }

        const data = await request.json();

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
