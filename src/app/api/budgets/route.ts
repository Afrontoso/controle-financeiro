import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
    try {
        const budgets = await prisma.budget.findMany({
            orderBy: { createdAt: 'asc' }
        });
        return NextResponse.json(budgets);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch budgets" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { name, amount, divideBy } = await request.json();

        if (!name || amount === undefined || divideBy === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const newBudget = await prisma.budget.create({
            data: {
                name,
                amount: parseFloat(amount),
                divideBy: parseInt(divideBy),
            },
        });

        return NextResponse.json(newBudget, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to create budget" }, { status: 500 });
    }
}
