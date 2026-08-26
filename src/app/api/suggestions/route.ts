import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const MAX_LENGTH = 2000;

/** Escapa o texto do usuário: ele vai dentro do HTML do e-mail. */
function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
        }

        const { message } = await request.json();
        const text = typeof message === "string" ? message.trim() : "";

        if (text.length < 5 || text.length > MAX_LENGTH) {
            return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
        }

        const apiKey = process.env.RESEND_API_KEY;
        const to = process.env.SUGGESTIONS_EMAIL;
        // Sem domínio verificado no Resend, o remetente precisa ser o de testes.
        const from = process.env.SUGGESTIONS_FROM ?? "onboarding@resend.dev";

        if (!apiKey || !to) {
            console.error("Sugestões: RESEND_API_KEY ou SUGGESTIONS_EMAIL não configurados");
            return NextResponse.json({ error: "Envio não configurado" }, { status: 500 });
        }

        const author = session.user.email ?? session.user.name ?? "usuário sem e-mail";

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: `Controle financeiro <${from}>`,
                to: [to],
                subject: `sugestão de ${author}`,
                // Responder no cliente de e-mail já endereça quem escreveu.
                reply_to: session.user.email ?? undefined,
                html: `<p><strong>de:</strong> ${escapeHtml(author)}</p><pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
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
