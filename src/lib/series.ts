/**
 * Séries: lançamentos que se repetem (mesmo groupId), vistos como uma coisa só.
 * É o que a tela de rendas e contas fixas mostra e edita.
 */
import type { Transaction, TxType } from "@/lib/types";
import { toDateStr } from "@/lib/format";

/** "(3/12)" no fim do nome: a API numera as repetições com fim. */
const SUFFIX = /\s*\(\d+\/\d+\)\s*$/;

export function stripSuffix(description: string): string {
  return description.replace(SUFFIX, "").trim();
}

export interface Series {
  groupId: string;
  type: TxType;
  label: string;
  /** Valor da próxima ocorrência (ou da última, se já acabou). */
  amount: number;
  /** Dia do mês em que cai. */
  day: number;
  cardId?: string;
  /** Próxima ocorrência de hoje em diante; null se já acabou. */
  nextDate: string | null;
  lastDate: string;
  /** Ocorrências de hoje em diante. */
  restantes: number;
  total: number;
  /** Sem número de parcelas: repete até você encerrar. */
  semFim: boolean;
}

/**
 * Séries dos tipos pedidos que ainda valem no mês atual ou depois, da que cai
 * mais cedo no mês para a mais tarde.
 */
export function activeSeries(transactions: Transaction[], types: TxType[], today: Date): Series[] {
  const todayStr = toDateStr(today);
  const monthStart = `${todayStr.slice(0, 7)}-01`;
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (!tx.groupId || !types.includes(tx.type)) continue;
    const list = groups.get(tx.groupId);
    if (list) list.push(tx);
    else groups.set(tx.groupId, [tx]);
  }

  const result: Series[] = [];
  for (const [groupId, list] of groups) {
    list.sort((a, b) => (a.date < b.date ? -1 : 1));
    const last = list[list.length - 1];
    if (last.date < monthStart) continue;
    const futuras = list.filter((t) => t.date >= todayStr);
    const ref = futuras[0] ?? last;
    result.push({
      groupId,
      type: ref.type,
      label: stripSuffix(ref.description),
      amount: ref.amount,
      day: Number(ref.date.slice(8)),
      cardId: ref.cardId,
      nextDate: futuras[0]?.date ?? null,
      lastDate: last.date,
      restantes: futuras.length,
      total: list.length,
      semFim: !list.some((t) => SUFFIX.test(t.description)),
    });
  }
  return result.sort((a, b) => a.day - b.day || b.amount - a.amount);
}

/** Quanto as séries somam no mês de `today` (o que de fato cai nele). */
export function seriesTotalThisMonth(transactions: Transaction[], series: Series[], today: Date): number {
  const prefix = toDateStr(today).slice(0, 7);
  const ids = new Set(series.map((s) => s.groupId));
  return transactions
    .filter((t) => t.groupId && ids.has(t.groupId) && t.date.startsWith(prefix))
    .reduce((sum, t) => sum + t.amount, 0);
}
