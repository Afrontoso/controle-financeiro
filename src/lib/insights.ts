/**
 * Leituras derivadas dos lançamentos para as telas de cartões, fluxo de caixa,
 * contas e renda. Tudo puro: recebe lançamentos já carregados e devolve números.
 */
import type { Card, Transaction, TxType } from "@/lib/types";
import { chargeDateOf, indexCards, nextDueDate, type DayEntry, type YearMonth } from "@/lib/ledger";
import { fromDateStr, monthShortLabel, toDateStr } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Nomes                                                               */
/* ------------------------------------------------------------------ */

const PREFIXES = [
  /^transfer[eê]ncia enviada pelo pix\s*·\s*/i,
  /^transfer[eê]ncia enviada\s*·\s*/i,
  /^pix enviado\s+/i,
  /^pagamento com pix\s+/i,
  /^compra no d[eé]bito\s*·\s*/i,
  /^pix recebido\s+/i,
  /^transfer[eê]ncia recebida\s*·?\s*/i,
];

/** Marca de parcela no fim: "mac m5 (3/4)", "oticas komfo 8/10", "(antecipada)". */
const INSTALLMENT = /\s*(\(\d+\/\d+\)|\b\d+\/\d+)\s*$/;
const ANTECIPADA = /\s*\(antecipada\)\s*$/i;

/** Nome de quem recebe/paga, sem o "pix enviado" e sem a parcela. */
export function payeeLabel(description: string): string {
  let text = description.trim().replace(ANTECIPADA, "");
  for (const prefix of PREFIXES) text = text.replace(prefix, "");
  text = text.replace(INSTALLMENT, "").trim();
  return text || description.trim();
}

export function payeeKey(description: string): string {
  return payeeLabel(description)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Lançamento parcelado ("(3/4)" ou "3/10" no fim do nome). */
export function isInstallment(tx: Pick<Transaction, "description">): boolean {
  return INSTALLMENT.test(tx.description.replace(ANTECIPADA, ""));
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function addDays(dateStr: string, days: number): string {
  const d = fromDateStr(dateStr);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function daysUntil(from: string, to: string): number {
  return Math.round((fromDateStr(to).getTime() - fromDateStr(from).getTime()) / 86_400_000);
}

/* ------------------------------------------------------------------ */
/* Cartões                                                             */
/* ------------------------------------------------------------------ */

/** Quantas faturas fechadas entram na média do "dia a dia até fechar". */
const CARD_AVERAGE_BILLS = 3;

export interface OpenBill {
  dueDate: string;
  /** Dias até o vencimento (0 = vence hoje). */
  diasParaVencer: number;
  /** Compras feitas até hoje que caem nesta fatura. */
  lancado: number;
  lancadoCount: number;
  /** Lançamentos com data futura que já caem nela: parcelas e assinaturas. */
  futuro: number;
  futuroLabels: string[];
  /** Média mensal das compras avulsas nas últimas faturas × dias até o vencimento / 30. Só estimativa. */
  estimativa: number;
  mediaMensal: number;
  total: number;
}

/**
 * A fatura que ainda vai vencer. Neste app a compra cai no primeiro vencimento
 * igual ou posterior a ela, então a fatura aberta junta tudo até o vencimento.
 */
export function openBill(transactions: Transaction[], card: Card, today: Date): OpenBill {
  const todayStr = toDateStr(today);
  const cards = indexCards([card]);
  const dueDate = nextDueDate(todayStr, card.dueDay);
  const due = fromDateStr(dueDate);
  const closed = new Map<string, number>();
  for (let i = 1; i <= CARD_AVERAGE_BILLS; i++) {
    closed.set(nextDueDate(toDateStr(new Date(due.getFullYear(), due.getMonth() - i, 1)), card.dueDay), 0);
  }

  let lancado = 0;
  let lancadoCount = 0;
  let futuro = 0;
  const futuroLabels: string[] = [];

  for (const tx of transactions) {
    if (tx.type !== "cartao" || tx.cardId !== card.id) continue;
    const charge = chargeDateOf(tx, cards);
    // Para a média, só compras avulsas: parcelas e assinaturas já aparecem lançadas.
    if (closed.has(charge) && !tx.groupId && !isInstallment(tx)) closed.set(charge, closed.get(charge)! + tx.amount);
    if (charge !== dueDate) continue;
    if (tx.date <= todayStr) {
      lancado += tx.amount;
      lancadoCount += 1;
    } else {
      futuro += tx.amount;
      futuroLabels.push(tx.description);
    }
  }

  const diasParaVencer = Math.max(daysUntil(todayStr, dueDate), 0);
  const comCompras = [...closed.values()].filter((v) => v > 0);
  const mediaMensal = comCompras.length > 0 ? comCompras.reduce((a, b) => a + b, 0) / comCompras.length : 0;
  const estimativa = (mediaMensal * Math.min(diasParaVencer, 30)) / 30;

  return {
    dueDate,
    diasParaVencer,
    lancado,
    lancadoCount,
    futuro,
    futuroLabels,
    estimativa,
    mediaMensal,
    total: lancado + futuro + estimativa,
  };
}

export type BillState = "paga" | "aberta" | "prevista";

export interface TimelineBill {
  dueDate: string;
  label: string;
  amount: number;
  count: number;
  /** Lançamentos parcelados ou recorrentes dentro dela. */
  parcelas: number;
  parcelasValor: number;
  state: BillState;
}

/** A última fatura vencida, a aberta e as `ahead` seguintes. */
export function billTimeline(transactions: Transaction[], card: Card, today: Date, ahead = 3): TimelineBill[] {
  const todayStr = toDateStr(today);
  const cards = indexCards([card]);
  const open = nextDueDate(todayStr, card.dueDay);
  const openDate = fromDateStr(open);

  const dues: string[] = [];
  for (let i = -1; i <= ahead; i++) {
    const d = new Date(openDate.getFullYear(), openDate.getMonth() + i, 1);
    dues.push(nextDueDate(toDateStr(d), card.dueDay));
  }

  const byDue = new Map(dues.map((due) => [due, { amount: 0, count: 0, parcelas: 0, parcelasValor: 0 }]));
  for (const tx of transactions) {
    if (tx.type !== "cartao" || tx.cardId !== card.id) continue;
    const entry = byDue.get(chargeDateOf(tx, cards));
    if (!entry) continue;
    entry.amount += tx.amount;
    entry.count += 1;
    if (tx.groupId || isInstallment(tx)) {
      entry.parcelas += 1;
      entry.parcelasValor += tx.amount;
    }
  }

  return dues.map((due) => {
    const entry = byDue.get(due)!;
    const date = fromDateStr(due);
    return {
      dueDate: due,
      label: monthShortLabel(date.getFullYear(), date.getMonth()),
      ...entry,
      state: due < todayStr ? "paga" : due === open ? "aberta" : "prevista",
    };
  });
}

export interface Subscription {
  key: string;
  label: string;
  amount: number;
  day: number;
  /** "recorrente": lançada como repetição no app; "banco": achada repetindo no extrato. */
  origem: "recorrente" | "banco";
}

/**
 * O que se repete todo mês no cartão: repetições lançadas no app (sem parcela no
 * nome) e compras do banco que aparecem em meses diferentes com valor parecido.
 */
export function subscriptions(transactions: Transaction[], card: Card, today: Date): Subscription[] {
  const todayStr = toDateStr(today);
  const since = addDays(todayStr, -120);
  const result = new Map<string, Subscription>();

  // Repetições do app: a ocorrência mais recente até um mês à frente.
  const horizon = addDays(todayStr, 31);
  const latest = new Map<string, string>();
  // Uma série com alguma parcela no nome é compra parcelada, não assinatura.
  const parceladas = new Set(
    transactions.filter((t) => t.type === "cartao" && t.groupId && isInstallment(t)).map((t) => t.groupId),
  );
  for (const tx of transactions) {
    if (tx.type !== "cartao" || tx.cardId !== card.id || !tx.groupId || parceladas.has(tx.groupId)) continue;
    if (tx.date > horizon) continue;
    const prev = latest.get(tx.groupId);
    if (!prev || tx.date > prev) {
      latest.set(tx.groupId, tx.date);
      result.set(tx.groupId, {
        key: tx.groupId,
        label: tx.description,
        amount: tx.amount,
        day: Number(tx.date.slice(8)),
        origem: "recorrente",
      });
    }
  }

  // Do banco: mesmo nome em pelo menos dois meses, valores dentro de 15%.
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (tx.type !== "cartao" || tx.cardId !== card.id || tx.groupId || isInstallment(tx)) continue;
    if (tx.source !== "pluggy" || tx.date < since || tx.date > todayStr) continue;
    const key = payeeKey(tx.description);
    const list = groups.get(key);
    if (list) list.push(tx);
    else groups.set(key, [tx]);
  }
  const recurringNames = new Set([...result.values()].map((s) => payeeKey(s.label)));
  for (const [key, list] of groups) {
    if (recurringNames.has(key)) continue;
    const months = new Set(list.map((t) => monthKey(t.date)));
    if (months.size < 2) continue;
    const amounts = list.map((t) => t.amount);
    if (Math.max(...amounts) > Math.min(...amounts) * 1.15) continue;
    const last = list.reduce((a, b) => (b.date > a.date ? b : a));
    result.set(`banco:${key}`, {
      key: `banco:${key}`,
      label: payeeLabel(last.description),
      amount: last.amount,
      day: Number(last.date.slice(8)),
      origem: "banco",
    });
  }

  return [...result.values()].sort((a, b) => b.amount - a.amount);
}

/* ------------------------------------------------------------------ */
/* Fluxo de caixa                                                      */
/* ------------------------------------------------------------------ */

export interface FlowMovement {
  key: string;
  dateStr: string;
  label: string;
  /** Com sinal: entrada positiva, o resto negativo. */
  amount: number;
  type: TxType;
  /** Faturas juntam as compras do cartão no vencimento. */
  count: number;
  /** Saldo ao fim do dia do movimento. */
  saldoDepois: number;
}

/** Movimentos dos dias dados, com as compras de cada cartão somadas em uma fatura. */
export function flowMovements(days: DayEntry[], cards: Card[]): FlowMovement[] {
  const names = new Map(cards.map((c) => [c.id, c.name]));
  const result: FlowMovement[] = [];
  for (const day of days) {
    const faturas = new Map<string, FlowMovement>();
    const items: FlowMovement[] = [];
    for (const tx of day.transactions) {
      const signed = tx.type === "entrada" ? tx.amount : -tx.amount;
      if (tx.type === "cartao" && tx.cardId) {
        const f = faturas.get(tx.cardId);
        if (f) {
          f.amount += signed;
          f.count += 1;
        } else {
          faturas.set(tx.cardId, {
            key: `${day.dateStr}:fatura:${tx.cardId}`,
            dateStr: day.dateStr,
            label: `fatura ${names.get(tx.cardId) ?? "cartão"}`,
            amount: signed,
            type: "cartao",
            count: 1,
            saldoDepois: day.saldo,
          });
        }
        continue;
      }
      items.push({
        key: tx.id,
        dateStr: day.dateStr,
        label: tx.description,
        amount: signed,
        type: tx.type,
        count: 1,
        saldoDepois: day.saldo,
      });
    }
    // Entradas primeiro: é a ordem em que o dinheiro costuma chegar e sair.
    result.push(...items.filter((i) => i.amount > 0), ...faturas.values(), ...items.filter((i) => i.amount <= 0));
  }
  return result;
}

export interface PayeeTotal {
  key: string;
  label: string;
  total: number;
  count: number;
}

/** Para onde foi o dinheiro nos últimos `days` dias, por destino. */
export function outflowsByPayee(transactions: Transaction[], today: Date, days = 30, limit = 8): PayeeTotal[] {
  const todayStr = toDateStr(today);
  const since = addDays(todayStr, -days);
  const map = new Map<string, PayeeTotal>();
  for (const tx of transactions) {
    if (tx.type !== "saida" && tx.type !== "gasto_diario" && tx.type !== "cartao") continue;
    if (tx.date <= since || tx.date > todayStr) continue;
    const key = payeeKey(tx.description);
    const entry = map.get(key);
    if (entry) {
      entry.total += tx.amount;
      entry.count += 1;
    } else {
      map.set(key, { key, label: payeeLabel(tx.description), total: tx.amount, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Renda                                                               */
/* ------------------------------------------------------------------ */

export interface IncomeMonth {
  key: string;
  label: string;
  year: number;
  month: number;
  /** Entradas que se repetem (salário, bolsa). */
  fixa: number;
  avulsa: number;
  total: number;
}

/** Entradas por mês, sem contar dinheiro tirado de cofre. */
export function incomeByMonth(transactions: Transaction[], from: YearMonth, count: number): IncomeMonth[] {
  const months: IncomeMonth[] = [];
  const byKey = new Map<string, IncomeMonth>();
  for (let i = 0; i < count; i++) {
    const d = new Date(from.year, from.month + i, 1);
    const key = toDateStr(d).slice(0, 7);
    const entry = { key, label: monthShortLabel(d.getFullYear(), d.getMonth()), year: d.getFullYear(), month: d.getMonth(), fixa: 0, avulsa: 0, total: 0 };
    months.push(entry);
    byKey.set(key, entry);
  }
  for (const tx of transactions) {
    if (tx.type !== "entrada" || tx.vaultId) continue;
    const entry = byKey.get(monthKey(tx.date));
    if (!entry) continue;
    if (tx.groupId) entry.fixa += tx.amount;
    else entry.avulsa += tx.amount;
    entry.total += tx.amount;
  }
  return months;
}

export interface IncomeSource {
  key: string;
  label: string;
  amount: number;
  /** Dia do mês em que caiu (ou cai). */
  day: number;
  fixa: boolean;
  count: number;
  /** Ainda vai cair neste mês. */
  futura: boolean;
  /** Renda da esposa. */
  conjuge: boolean;
}

/** De onde veio (ou vem) a renda do mês, agrupada por pagador. */
export function incomeSources(transactions: Transaction[], ym: YearMonth, today: Date): IncomeSource[] {
  const prefix = `${ym.year}-${String(ym.month + 1).padStart(2, "0")}`;
  const todayStr = toDateStr(today);
  const map = new Map<string, IncomeSource>();
  for (const tx of transactions) {
    if (tx.type !== "entrada" || tx.vaultId || !tx.date.startsWith(prefix)) continue;
    const key = tx.groupId ?? payeeKey(tx.description);
    const entry = map.get(key);
    if (entry) {
      entry.amount += tx.amount;
      entry.count += 1;
      entry.futura = entry.futura && tx.date > todayStr;
    } else {
      map.set(key, {
        key,
        label: tx.groupId ? tx.description.replace(INSTALLMENT, "") : payeeLabel(tx.description),
        amount: tx.amount,
        day: Number(tx.date.slice(8)),
        fixa: Boolean(tx.groupId),
        count: 1,
        futura: tx.date > todayStr,
        conjuge: Boolean(tx.conjuge),
      });
    }
  }
  return [...map.values()].sort((a, b) => Number(b.fixa) - Number(a.fixa) || b.amount - a.amount);
}

/* ------------------------------------------------------------------ */
/* Contas                                                              */
/* ------------------------------------------------------------------ */

export interface FixedBill {
  key: string;
  label: string;
  amount: number;
  /** Dia do mês da próxima ocorrência. */
  day: number;
  nextDate: string;
  /** Parcelas que ainda faltam (só parceladas). */
  restantes: number | null;
  kind: "fixa" | "parcelada" | "apartamento";
  /** Um lançamento da série, para editar. */
  sample: Transaction;
}

const APTO_LABELS: Record<string, string> = {
  "apto:aluguel": "aluguel",
  "apto:construtora": "construtora",
  "apto:despachante": "despachante (ITBI)",
  "apto:jurosObra": "juros de obra",
  "apto:banco": "parcela da Caixa",
  "apto:amortizacao": "amortização",
  "apto:condominio": "condomínio + IPTU",
};

/**
 * Saídas que se repetem: repetições lançadas no app e o que o plano do
 * apartamento gera. Mostra a próxima ocorrência a partir do começo do mês.
 */
export function fixedBills(transactions: Transaction[], today: Date): FixedBill[] {
  const todayStr = toDateStr(today);
  const monthStart = `${todayStr.slice(0, 7)}-01`;
  const series = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (tx.type !== "saida") continue;
    const key = tx.groupId ?? (tx.source?.startsWith("apto:") ? tx.source : null);
    if (!key) continue;
    const list = series.get(key);
    if (list) list.push(tx);
    else series.set(key, [tx]);
  }

  const result: FixedBill[] = [];
  for (const [key, list] of series) {
    const upcoming = list.filter((t) => t.date >= monthStart).sort((a, b) => (a.date < b.date ? -1 : 1));
    // Sem ocorrência de hoje em diante a série acabou (ou foi encerrada): sai da lista.
    const next = upcoming.find((t) => t.date >= todayStr);
    if (!next) continue;
    const apto = key.startsWith("apto:");
    const parcelada = !apto && isInstallment(next);
    result.push({
      key,
      label: apto ? (APTO_LABELS[key] ?? key.slice(5)) : next.description.replace(INSTALLMENT, ""),
      amount: next.amount,
      day: Number(next.date.slice(8)),
      nextDate: next.date,
      restantes: parcelada ? upcoming.filter((t) => t.date >= todayStr).length : null,
      kind: apto ? "apartamento" : parcelada ? "parcelada" : "fixa",
      sample: next,
    });
  }
  return result.sort((a, b) => a.day - b.day);
}

export interface RecurringCandidate {
  key: string;
  label: string;
  /** Valor da última vez. */
  amount: number;
  day: number;
  months: number;
  lastDate: string;
}

/**
 * Pagamentos do banco que se repetem em meses diferentes e ainda não estão nas
 * contas fixas: candidatos a virar conta fixa.
 */
export function recurringCandidates(transactions: Transaction[], today: Date): RecurringCandidate[] {
  const todayStr = toDateStr(today);
  const since = addDays(todayStr, -120);
  const fixedNames = new Set(
    transactions.filter((t) => t.type === "saida" && t.groupId).map((t) => payeeKey(t.description.replace(INSTALLMENT, ""))),
  );
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if ((tx.type !== "saida" && tx.type !== "gasto_diario") || tx.groupId || tx.source !== "pluggy") continue;
    if (tx.date < since || tx.date > todayStr || isInstallment(tx)) continue;
    const key = payeeKey(tx.description);
    const list = groups.get(key);
    if (list) list.push(tx);
    else groups.set(key, [tx]);
  }

  const result: RecurringCandidate[] = [];
  for (const [key, list] of groups) {
    if (fixedNames.has(key)) continue;
    const months = new Set(list.map((t) => monthKey(t.date)));
    if (months.size < 2) continue;
    const amounts = list.map((t) => t.amount);
    if (Math.max(...amounts) > Math.min(...amounts) * 1.3) continue;
    const last = list.reduce((a, b) => (b.date > a.date ? b : a));
    result.push({
      key,
      label: payeeLabel(last.description),
      amount: last.amount,
      day: Number(last.date.slice(8)),
      months: months.size,
      lastDate: last.date,
    });
  }
  return result.sort((a, b) => b.amount - a.amount);
}
