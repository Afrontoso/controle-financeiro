import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/vaultApi";

const VIEW_KEY = /^[a-z]{1,20}$/;

/** Só o que o app entende; o resto é descartado. */
function clean(raw: unknown): { apartamento?: boolean; ordem?: string[] } {
    const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const out: { apartamento?: boolean; ordem?: string[] } = {};
    if (typeof body.apartamento === "boolean") out.apartamento = body.apartamento;
    if (Array.isArray(body.ordem)) {
        out.ordem = body.ordem.filter((k): k is string => typeof k === "string" && VIEW_KEY.test(k)).slice(0, 30);
    }
    return out;
}

export async function GET() {
    try {
        const userId = await currentUserId();
        if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { settings: true } });
        return NextResponse.json(clean(user?.settings));
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Falha ao carregar as configurações" }, { status: 500 });
    }
}

/** Substitui as configurações pelas enviadas (campos ausentes voltam ao padrão). */
export async function PUT(request: Request) {
    try {
        const userId = await currentUserId();
        if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        const settings = clean(await request.json().catch(() => ({})));
        await prisma.user.update({ where: { id: userId }, data: { settings } });
        return NextResponse.json(settings);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Falha ao salvar as configurações" }, { status: 500 });
    }
}
