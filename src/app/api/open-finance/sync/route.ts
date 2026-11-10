import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { isOpenFinanceOwner, syncOpenFinance } from "@/lib/openFinanceSync";
import { PluggyError } from "@/lib/pluggy";

/** Leitura dos bancos pode demorar: várias chamadas à Pluggy em sequência. */
export const maxDuration = 60;

/** "Sincronizar agora": lê os bancos e atualiza a caixa de entrada. */
export async function POST() {
    try {
        const session = await getServerSession(authOptions);
        const user = session?.user as { id?: string; email?: string | null } | undefined;
        if (!user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        if (!isOpenFinanceOwner(user.email)) return NextResponse.json({ error: "Indisponível" }, { status: 403 });

        return NextResponse.json(await syncOpenFinance(user.id));
    } catch (error) {
        console.error(error);
        const status = error instanceof PluggyError ? 502 : 500;
        return NextResponse.json({ error: "Falha ao sincronizar com o banco" }, { status });
    }
}
