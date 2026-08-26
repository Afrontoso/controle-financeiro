import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { buildSuggestionEmailHtml } from "@/lib/suggestionEmail";

const MAX_LENGTH = 2000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Campos opcionais: só entram no e-mail se vierem preenchidos e sãos. */
function optionalText(value: unknown, maxLength: number): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > maxLength) return null;
    return trimmed;
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }

        const body = await request.json();
        const text = typeof body.message === "string" ? body.message.trim() : "";

        if (text.length < 5 || text.length > MAX_LENGTH) {
            return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
        }

        const contactEmailRaw = optionalText(body.contactEmail, 200);
        const contactEmail = contactEmailRaw && EMAIL_RE.test(contactEmailRaw) ? contactEmailRaw : null;
        const contactPhone = optionalText(body.contactPhone, 40);

        const apiKey = process.env.RESEND_API_KEY;
        const to = process.env.SUGGESTIONS_EMAIL;
        // Sem domínio verificado no Resend, o remetente precisa ser o de testes.
        const from = process.env.SUGGESTIONS_FROM ?? "onboarding@resend.dev";

        if (!apiKey || !to) {
            console.error("Sugestões: RESEND_API_KEY ou SUGGESTIONS_EMAIL não configurados");
            return NextResponse.json({ error: "Envio não configurado" }, { status: 500 });
        }

        const html = buildSuggestionEmailHtml({
            message: text,
            contactEmail,
            contactPhone,
            account: session.user.email ?? session.user.name ?? "desconhecida",
        });

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: `Controle financeiro <${from}>`,
                to: [to],
                subject: "nova sugestão no controle financeiro",
                // Responder no cliente de e-mail já endereça quem pediu contato.
                reply_to: contactEmail ?? undefined,
                html,
            }),
        });

        if (!res.ok) {
            console.error("Resend respondeu", res.status, await res.text());
            return NextResponse.json({ error: "Falha ao enviar" }, { status: 502 });
        }

        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        console.error("Suggestion POST error:", error);
        return NextResponse.json({ error: "Erro ao enviar sugestão" }, { status: 500 });
    }
}
