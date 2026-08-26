/**
 * Leitura mínima do BR Code do Pix (o "copia e cola").
 *
 * O formato é uma sequência de campos `TTLLvalor`: dois dígitos de tag, dois de
 * tamanho e o valor. Só precisamos do nome do beneficiário (tag 59), para a
 * tela de doação mostrar para quem o dinheiro vai.
 */
export function pixPayeeName(payload: string): string | null {
  let cursor = 0;

  while (cursor + 4 <= payload.length) {
    const tag = payload.slice(cursor, cursor + 2);
    const length = Number(payload.slice(cursor + 2, cursor + 4));
    if (!Number.isInteger(length)) return null;

    const value = payload.slice(cursor + 4, cursor + 4 + length);
    if (tag === "59") return value.trim() || null;

    cursor += 4 + length;
  }

  return null;
}
