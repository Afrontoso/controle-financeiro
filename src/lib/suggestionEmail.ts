/** Escapa o texto do usuário: ele vai dentro do HTML do e-mail. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface SuggestionEmail {
  message: string;
  /** Contatos que a pessoa escolheu deixar — os dois são opcionais. */
  contactEmail: string | null;
  contactPhone: string | null;
  /** Conta usada no app; serve para achar a pessoa se ela não deixar contato. */
  account: string;
}

/**
 * Corpo do e-mail de sugestão. Estilo inline porque cliente de e-mail ignora
 * folha de estilo, e sem depender de imagem: só texto, contato e rodapé.
 */
export function buildSuggestionEmailHtml({
  message,
  contactEmail,
  contactPhone,
  account,
}: SuggestionEmail): string {
  const contatos = [
    contactEmail &&
      `e-mail: <a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a>`,
    contactPhone && `telefone: ${escapeHtml(contactPhone)}`,
  ].filter(Boolean);

  return [
    `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px">`,
    `<pre style="font-family:inherit;white-space:pre-wrap;font-size:15px;line-height:1.5;margin:0">${escapeHtml(message)}</pre>`,
    `<hr style="border:none;border-top:1px solid #ddd;margin:20px 0">`,
    contatos.length
      ? `<p style="font-size:13px;color:#555;margin:0 0 6px">${contatos.join("<br>")}</p>`
      : `<p style="font-size:13px;color:#777;margin:0 0 6px">a pessoa não deixou contato.</p>`,
    `<p style="font-size:12px;color:#999;margin:0">conta usada no app: ${escapeHtml(account)}</p>`,
    `</div>`,
  ].join("");
}
