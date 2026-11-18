import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUserId } from "@/lib/vaultApi";

const VIEW_KEY = /^[a-z]{1,20}$/;
/** Id de cofrinho ou de aplicação, como o banco manda. */
const ALIAS_KEY = /^[A-Za-z0-9:_-]{1,64}$/;
const ALIAS_MAX = 40;
const ALIAS_COUNT = 200;

interface Settings {
    apartamento?: boolean;
    ordem?: string[];
    apelidos?: Record<string, string>;
    mesada?: { eu?: number; esposa?: number };
}

/** Porcentagem da mesada: inteiro de 0 a 100, ou nada. */
function percentual(value: unknown): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    const pct = Math.round(value);
    return pct >= 0 && pct <= 100 ? pct : undefined;
}

/** Só o que o app entende; o resto é descartado. */
function clean(raw: unknown): Settings {
    const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const out: Settings = {};
    if (typeof body.apartamento === "boolean") out.apartamento = body.apartamento;
    if (Array.isArray(body.ordem)) {
        out.ordem = body.ordem.filter((k): k is string => typeof k === "string" && VIEW_KEY.test(k)).slice(0, 30);
    }
    if (body.apelidos && typeof body.apelidos === "object") {
        const apelidos: Record<string, string> = {};
        for (const [key, value] of Object.entries(body.apelidos as Record<string, unknown>)) {
            if (Object.keys(apelidos).length >= ALIAS_COUNT) break;
            const nome = typeof value === "string" ? value.trim().slice(0, ALIAS_MAX) : "";
            if (ALIAS_KEY.test(key) && nome) apelidos[key] = nome;
        }
        if (Object.keys(apelidos).length > 0) out.apelidos = apelidos;
    }
    if (body.mesada && typeof body.mesada === "object") {
        const { eu, esposa } = body.mesada as Record<string, unknown>;
        const mesada: { eu?: number; esposa?: number } = {};
        const pctEu = percentual(eu);
        const pctEsposa = percentual(esposa);
        if (pctEu !== undefined) mesada.eu = pctEu;
        if (pctEsposa !== undefined) mesada.esposa = pctEsposa;
        if (Object.keys(mesada).length > 0) out.mesada = mesada;
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
        await prisma.user.update({ where: { id: userId }, data: { settings: settings as object } });
        return NextResponse.json(settings);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Falha ao salvar as configurações" }, { status: 500 });
    }
}
