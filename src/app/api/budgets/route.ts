import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }
        const userId = (session.user as any).id;

        const budgets = await prisma.budget.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' }
        });
        return NextResponse.json(budgets);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch budgets" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }
        const userId = (session.user as any).id;

        const { name, amount, divideBy } = await request.json();

        if (!name || amount === undefined || divideBy === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const newBudget = await prisma.budget.create({
            data: {
                name,
                amount: parseFloat(amount),
                divideBy: parseInt(divideBy),
                userId
            },
        });

        return NextResponse.json(newBudget, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to create budget" }, { status: 500 });
    }
}
