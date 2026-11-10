import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncOpenFinance } from "@/lib/openFinanceSync";

export const maxDuration = 60;

/**
 * Chamado pelo Vercel Cron uma vez por dia (vercel.json). A Vercel manda
 * `Authorization: Bearer $CRON_SECRET`; sem o segredo certo, nada acontece.
 * Sincroniza só o dono das credenciais do Meu Pluggy.
 */
export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const email = process.env.OPEN_FINANCE_OWNER_EMAIL?.trim().toLowerCase();
    if (!email) return NextResponse.json({ skipped: "sem dono configurado" });

    try {
        const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
            select: { id: true },
        });
        if (!user) return NextResponse.json({ skipped: "dono ainda não entrou no app" });
        return NextResponse.json(await syncOpenFinance(user.id));
    } catch (error) {
        console.error("Cron do Open Finance falhou:", error);
        return NextResponse.json({ error: "Falha ao sincronizar" }, { status: 500 });
    }
}
