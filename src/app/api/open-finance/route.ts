import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { isOpenFinanceOwner } from "@/lib/openFinanceSync";

/**
 * Estado do Open Finance para a aba: o retrato das contas lido dos bancos. Só
 * leitura — nada daqui mexe nos lançamentos do app. O extrato continua sendo
 * guardado a cada sincronização, mas hoje nenhuma tela mostra. Para quem não é
 * o dono das credenciais, só `enabled: false`.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { id?: string; email?: string | null } | undefined;
        if (!user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        if (!isOpenFinanceOwner(user.email)) return NextResponse.json({ enabled: false });

        const snapshot = await prisma.bankSnapshot.findUnique({ where: { userId: user.id } });

        return NextResponse.json({
            enabled: true,
            syncedAt: snapshot?.syncedAt ?? null,
            snapshot: snapshot?.data ?? null,
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to load open finance" }, { status: 500 });
    }
}
