import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const transactions = await prisma.transaction.findMany({
            orderBy: {
                date: "asc",
            },
        });
        return NextResponse.json(transactions);
    } catch (error) {
        return NextResponse.json(
            { error: "Erro ao buscar transações" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const data = await request.json();

        const { date, description, amount, isForecast, category, type, repeatCount, repeatFrequency, isIndeterminate } = data;
        const baseDate = new Date(date);

        // Setup base transaction
        const transactionsToCreate = [{
            date: baseDate,
            description: description,
            amount: Number(amount),
            type: type || 'saida',
            isForecast: Boolean(isForecast),
            category: category,
        }];

        // Handle repetition
        let finalRepeatCount = repeatCount ? Number(repeatCount) : 0;

        if (isIndeterminate) {
            // Se for indeterminado, projeta para 5-10 anos futuros
            if (repeatFrequency === 'mensal') finalRepeatCount = 120; // 10 anos
            if (repeatFrequency === 'semanal') finalRepeatCount = 260; // 5 anos p/ aliviar sqlite
            if (repeatFrequency === 'diario') finalRepeatCount = 1460; // 4 anos p/ aliviar sqlite
        }

        if (finalRepeatCount > 1 && repeatFrequency) {
            for (let i = 1; i < finalRepeatCount; i++) {
                const nextDate = new Date(baseDate);
                // Simple date manipulation, avoiding heavy libs for straightforward months/weeks
                if (repeatFrequency === 'mensal') {
                    nextDate.setMonth(nextDate.getMonth() + i);
                } else if (repeatFrequency === 'semanal') {
                    nextDate.setDate(nextDate.getDate() + (i * 7));
                } else if (repeatFrequency === 'diario') {
                    nextDate.setDate(nextDate.getDate() + i);
                }

                transactionsToCreate.push({
                    date: nextDate,
                    description: isIndeterminate ? description : `${description} (${i + 1}/${finalRepeatCount})`,
                    amount: Number(amount),
                    type: type || 'saida',
                    isForecast: Boolean(isForecast),
                    category: category,
                });
            }
        }

        const insertedCount = await prisma.transaction.createMany({
            data: transactionsToCreate,
        });

        return NextResponse.json({ count: insertedCount.count }, { status: 201 });
    } catch (error) {
        console.error("Transaction POST error:", error);
        return NextResponse.json(
            { error: "Erro ao criar a transação" },
            { status: 500 }
        );
    }
}
