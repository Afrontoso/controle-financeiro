import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { normalizePremises, SOURCE_PREFIX } from "@/lib/apartment";

async function currentUserId(): Promise<string | null> {
    const session = await getServerSession(authOptions);
    return ((session?.user as { id?: string } | undefined)?.id) ?? null;
}

/** Premissas do plano do usuário, ou `null` se ele ainda não cadastrou. */
export async function GET() {
    try {
        const userId = await currentUserId();
        if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

        const plan = await prisma.apartmentPlan.findUnique({ where: { userId } });
        return NextResponse.json(plan ? normalizePremises(plan.premises) : null);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch plan" }, { status: 500 });
    }
}

/** Cria ou substitui as premissas. Não mexe nos lançamentos: isso é o /sync. */
export async function PUT(request: Request) {
    try {
        const userId = await currentUserId();
        if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

        const premises = normalizePremises(await request.json());
        await prisma.apartmentPlan.upsert({
            where: { userId },
            create: { userId, premises: premises as object },
            update: { premises: premises as object },
        });
        return NextResponse.json(premises);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
    }
}

/**
 * Apaga o plano e os lançamentos futuros gerados por ele. Os que já passaram
 * ficam: são o histórico do que foi pago.
 */
export async function DELETE(request: Request) {
    try {
        const userId = await currentUserId();
        if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

        const { fromDate } = await request.json().catch(() => ({}));
        const from = typeof fromDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)
            ? new Date(`${fromDate}T00:00:00.000Z`)
            : new Date();

        await prisma.$transaction([
            prisma.transaction.deleteMany({
                where: { userId, source: { startsWith: SOURCE_PREFIX }, date: { gte: from } },
            }),
            prisma.apartmentPlan.deleteMany({ where: { userId } }),
        ]);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to delete plan" }, { status: 500 });
    }
}
