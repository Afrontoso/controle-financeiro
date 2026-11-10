import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/** Só para as rotas de API (servidor). */

export async function currentUserId(): Promise<string | null> {
    const session = await getServerSession(authOptions);
    return (session?.user as { id?: string } | undefined)?.id ?? null;
}

/** Valida o corpo de criação/edição. Campos ausentes ficam `undefined`. */
export function parseVaultBody(body: Record<string, unknown>) {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : undefined;
    const goalRaw = body.goal;
    const goal =
        goalRaw === undefined
            ? undefined
            : goalRaw === null || Number(goalRaw) <= 0
              ? null
              : Number.isFinite(Number(goalRaw))
                ? Number(goalRaw)
                : undefined;
    const initial =
        body.initial === undefined || !Number.isFinite(Number(body.initial)) ? undefined : Number(body.initial);
    const kind = body.kind === "reserva" ? "reserva" : body.kind === "cofre" ? "cofre" : undefined;
    return { name, goal, initial, kind };
}
