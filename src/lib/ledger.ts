import type { Budget, Card, Transaction, TxType } from "@/lib/types";
import { monthLongLabel, monthShortLabel, toDateStr } from "@/lib/format";

export interface YearMonth {
  year: number;
  month: number;
}

export type TypeTotals = Record<TxType, number>;

export interface DayEntry {
  dateStr: string;
  day: number;
  year: number;
  month: number;
  totals: TypeTotals;
  /** Coluna "diários": gasto diário real no passado, cota projetada de hoje em diante. */
  diario: number;
  /** Quanto do orçamento foi reservado neste dia (0 no passado). */
  drain: number;
  /** Saldo acumulado ao fim do dia. */
  saldo: number;
  isPast: boolean;
  isToday: boolean;
  transactions: Transaction[];
}

export interface MonthEntry {
  key: string;
  year: number;
  month: number;
  label: string;
  longLabel: string;
  isCurrent: boolean;
  days: DayEntry[];
  totals: TypeTotals;
}

function emptyTotals(): TypeTotals {
  return { entrada: 0, saida: 0, gasto_diario: 0, investimento: 0, cartao: 0 };
}

/** Cota diária que os orçamentos fixos drenam do saldo projetado. */
export function dailyDrain(budgets: Budget[]): number {
  return budgets.reduce((sum, b) => {
    const amount = Number(b.amount) || 0;
    const divideBy = Number(b.divideBy) || 30;
    return sum + amount / divideBy;
  }, 0);
}

export function monthlyBudgetTotal(budgets: Budget[]): number {
  return budgets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const shifted = new Date(year, month + delta, 1);
  return { year: shifted.getFullYear(), month: shifted.getMonth() };
}

function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

export type CardIndex = Map<string, Card>;

export function indexCards(cards: Card[]): CardIndex {
  return new Map(cards.map((card) => [card.id, card]));
}

/** O vencimento cai no último dia quando o mês é curto demais (dia 31 em abril). */
function clampDueDay(year: number, month: number, dueDay: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Math.min(Math.max(dueDay, 1), daysInMonth);
}

/**
 * Data em que o lançamento efetivamente sai do bolso.
 *
 * Só difere da data do lançamento no cartão: a compra fica registrada no dia em
 * que foi feita, mas o dinheiro sai no primeiro vencimento igual ou posterior a
 * ela — o que joga boa parte das compras do mês para a fatura do mês seguinte.
 */
export function chargeDateOf(tx: Transaction, cards: CardIndex): string {
  if (tx.type !== "cartao" || !tx.cardId) return tx.date;
  const card = cards.get(tx.cardId);
  if (!card) return tx.date;
  return nextDueDate(tx.date, card.dueDay);
}

/** Primeiro vencimento igual ou posterior a `dateStr`. */
export function nextDueDate(dateStr: string, dueDay: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  let dueYear = year;
  let dueMonth = month - 1;

  if (day > clampDueDay(dueYear, dueMonth, dueDay)) {
    const next = new Date(dueYear, dueMonth + 1, 1);
    dueYear = next.getFullYear();
    dueMonth = next.getMonth();
  }

  return toDateStr(new Date(dueYear, dueMonth, clampDueDay(dueYear, dueMonth, dueDay)));
}

function groupByChargeDate(
  transactions: Transaction[],
  cards: CardIndex,
): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const key = chargeDateOf(tx, cards);
    const bucket = map.get(key);
    if (bucket) bucket.push(tx);
    else map.set(key, [tx]);
  }
  return map;
}

/** Mês da cobrança mais antiga, ou null se não houver nenhuma. */
function earliestTxMonth(transactions: Transaction[], cards: CardIndex): YearMonth | null {
  let earliest: YearMonth | null = null;
  for (const tx of transactions) {
    const [year, month] = chargeDateOf(tx, cards).split("-").map(Number);
    const candidate = { year, month: month - 1 };
    if (!earliest || compareYearMonth(candidate, earliest) < 0) earliest = candidate;
  }
  return earliest;
}

interface BuildLedgerOptions {
  transactions: Transaction[];
  budgets: Budget[];
  /** Cartões cadastrados: definem para qual dia a fatura empurra a compra. */
  cards?: Card[];
  today: Date;
  /** Primeiro mês a devolver. */
  from: YearMonth;
  /** Último mês a devolver (inclusive). */
  to: YearMonth;
}

/**
 * Simula o saldo dia a dia e devolve só a janela pedida.
 *
 * A simulação sempre parte do mês mais antigo entre a primeira transação, hoje e
 * o início da janela — o saldo é acumulado desde o zero, então começar depois
 * disso daria um saldo inicial errado. Dias anteriores à primeira transação não
 * movimentam nada (no passado a cota diária não é drenada), logo o resultado
 * independe de quão cedo a simulação comece.
 */
export function buildLedger({
  transactions,
  budgets,
  cards = [],
  today,
  from,
  to,
}: BuildLedgerOptions): MonthEntry[] {
  const drainPerDay = dailyDrain(budgets);
  const cardIndex = indexCards(cards);
  const byDate = groupByChargeDate(transactions, cardIndex);

  const todayMonth: YearMonth = { year: today.getFullYear(), month: today.getMonth() };
  const todayStr = toDateStr(today);

  let start: YearMonth = compareYearMonth(from, todayMonth) < 0 ? from : todayMonth;
  const earliest = earliestTxMonth(transactions, cardIndex);
  if (earliest && compareYearMonth(earliest, start) < 0) start = earliest;

  const cursor = new Date(start.year, start.month, 1);
  const end = new Date(to.year, to.month + 1, 0);

  let runningBalance = 0;
  const months: MonthEntry[] = [];
  let currentMonth: MonthEntry | null = null;

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const day = cursor.getDate();
    const dateStr = toDateStr(cursor);

    const isToday = dateStr === todayStr;
    const isPast = dateStr < todayStr;

    const dayTxs = byDate.get(dateStr) ?? [];
    const totals = emptyTotals();
    for (const tx of dayTxs) totals[tx.type] += tx.amount;

    const spent = totals.saida + totals.cartao + totals.gasto_diario;
    // No passado a cota já virou gasto real; de hoje em diante ela é reservada.
    const drain = isPast ? 0 : drainPerDay;
    // A coluna mostra o que de fato saiu no passado e a cota reservada à frente.
    const diario = isPast ? totals.gasto_diario : drainPerDay;

    runningBalance += totals.entrada - (spent + totals.investimento) - drain;

    const inWindow =
      compareYearMonth({ year, month }, from) >= 0 &&
      compareYearMonth({ year, month }, to) <= 0;

    if (inWindow) {
      if (!currentMonth || currentMonth.year !== year || currentMonth.month !== month) {
        currentMonth = {
          key: `${year}-${String(month + 1).padStart(2, "0")}`,
          year,
          month,
          label: monthShortLabel(year, month),
          longLabel: monthLongLabel(year, month),
          isCurrent: year === todayMonth.year && month === todayMonth.month,
          days: [],
          totals: emptyTotals(),
        };
        months.push(currentMonth);
      }

      currentMonth.days.push({
        dateStr,
        day,
        year,
        month,
        totals,
        diario,
        drain,
        saldo: runningBalance,
        isPast,
        isToday,
        transactions: dayTxs,
      });

      currentMonth.totals.entrada += totals.entrada;
      currentMonth.totals.saida += totals.saida;
      currentMonth.totals.gasto_diario += totals.gasto_diario;
      currentMonth.totals.investimento += totals.investimento;
      currentMonth.totals.cartao += totals.cartao;
    }

    cursor.setDate(day + 1);
  }

  return months;
}

export interface MonthSummary {
  year: number;
  month: number;
  longLabel: string;
  daysInMonth: number;
  daysElapsed: number;
  totals: TypeTotals;
  /** Saídas + cartão + gasto diário. */
  totalGastos: number;
  /** Entradas − gastos − reservas. */
  performance: number;
  economiasPercent: number;
  diarioMedio: number;
  /** Média usando só os lançamentos de gasto diário. */
  diarioMedioOnly: number;
  orcamentoMensal: number;
  diarioPrevisto: number;
  sobraOrcamento: number;
  projecaoMes: number;
  gastoUsadoPercent: number;
  gastos: GastoEntry[];
}

/** Gasto do mês junto do dia em que ele sai do saldo (no cartão, o vencimento). */
export interface GastoEntry extends Transaction {
  chargeDate: string;
}

/** Métricas do painel de totais, derivadas de um mês já simulado. */
export function summarizeMonth(
  month: MonthEntry,
  budgets: Budget[],
  today: Date,
): MonthSummary {
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const totals = month.totals;
  const totalGastos = totals.saida + totals.cartao + totals.gasto_diario;

  const gastos = month.days
    .flatMap((day) => day.transactions.map((tx) => ({ ...tx, chargeDate: day.dateStr })))
    .filter((tx) => tx.type === "saida" || tx.type === "cartao" || tx.type === "gasto_diario")
    .sort((a, b) =>
      a.chargeDate !== b.chargeDate
        ? a.chargeDate < b.chargeDate
          ? 1
          : -1
        : a.date < b.date
          ? 1
          : a.date > b.date
            ? -1
            : 0,
    );

  let daysElapsed = daysInMonth;
  if (month.year === today.getFullYear() && month.month === today.getMonth()) {
    daysElapsed = today.getDate();
  } else if (
    month.year > today.getFullYear() ||
    (month.year === today.getFullYear() && month.month > today.getMonth())
  ) {
    daysElapsed = 0;
  }

  const orcamentoMensal = monthlyBudgetTotal(budgets);
  const diarioPrevisto = dailyDrain(budgets);

  return {
    year: month.year,
    month: month.month,
    longLabel: month.longLabel,
    daysInMonth,
    daysElapsed,
    totals,
    totalGastos,
    performance: totals.entrada - totalGastos - totals.investimento,
    economiasPercent: totals.entrada > 0 ? (totals.investimento / totals.entrada) * 100 : 0,
    diarioMedio: daysInMonth > 0 ? totalGastos / daysInMonth : 0,
    diarioMedioOnly: daysInMonth > 0 ? totals.gasto_diario / daysInMonth : 0,
    orcamentoMensal,
    diarioPrevisto,
    sobraOrcamento: orcamentoMensal - totals.gasto_diario,
    projecaoMes: daysElapsed > 0 ? (totals.gasto_diario / daysElapsed) * daysInMonth : 0,
    gastoUsadoPercent:
      orcamentoMensal > 0 ? (totals.gasto_diario / orcamentoMensal) * 100 : 0,
    gastos,
  };
}

/* ------------------------------------------------------------------ */
/* Visão geral                                                         */
/* ------------------------------------------------------------------ */

/**
 * Para onde vai o dinheiro do mês. Soma exatamente o que o ledger movimenta no
 * saldo, dia a dia: `sobra` é a variação do saldo do primeiro ao último dia.
 */
export interface MonthBreakdown {
  key: string;
  year: number;
  month: number;
  label: string;
  /** Renda do mês: entradas que não são resgate de cofre. */
  entradas: number;
  /** Dinheiro tirado dos cofres (entradas ligadas a um cofre). Não é renda. */
  resgates: number;
  /** Saídas avulsas e recorrentes. */
  contas: number;
  /** Faturas que vencem no mês (compras do cartão empurradas pro vencimento). */
  cartao: number;
  /** Gasto diário lançado + cota dos orçamentos de hoje em diante. */
  diarios: number;
  economias: number;
  /** entradas + resgates − contas − cartão − diários − economias: quanto o saldo muda no mês. */
  sobra: number;
  /** Saldo no último dia do mês anterior. */
  saldoInicial: number;
  /** Saldo acumulado no último dia do mês. */
  saldoFinal: number;
  isCurrent: boolean;
}

export function breakdownMonth(month: MonthEntry): MonthBreakdown {
  let diarios = 0;
  let resgates = 0;
  // Igual ao buildLedger: o lançado conta sempre, e a cota só de hoje em diante
  // (no passado `drain` já é zero).
  for (const day of month.days) {
    diarios += day.totals.gasto_diario + day.drain;
    for (const tx of day.transactions) {
      if (tx.type === "entrada" && tx.vaultId) resgates += tx.amount;
    }
  }
  const { entrada, saida, cartao, investimento } = month.totals;
  const sobra = entrada - saida - cartao - diarios - investimento;
  const saldoFinal = month.days.at(-1)?.saldo ?? 0;

  return {
    key: month.key,
    year: month.year,
    month: month.month,
    label: month.label,
    entradas: entrada - resgates,
    resgates,
    contas: saida,
    cartao,
    diarios,
    economias: investimento,
    sobra,
    saldoInicial: saldoFinal - sobra,
    saldoFinal,
    isCurrent: month.isCurrent,
  };
}

/** Uma conta a pagar do mês: uma saída, ou a fatura inteira de um cartão. */
export interface BillItem {
  id: string;
  label: string;
  amount: number;
  type: "saida" | "cartao";
  /** Dia em que sai do saldo (no cartão, o vencimento). */
  dateStr: string;
  /** Quantos lançamentos foram somados (faturas agregam várias compras). */
  count: number;
  /** Lançamentos por trás do item: marcar a fatura como paga marca todas as compras. */
  txIds: string[];
  /** Todos os lançamentos do item estão marcados como pagos. */
  paid: boolean;
}

export interface BillDay {
  dateStr: string;
  day: number;
  isPast: boolean;
  isToday: boolean;
  total: number;
  items: BillItem[];
  /** Todos os itens do dia estão pagos. */
  allPaid: boolean;
}

/**
 * Contas do mês agrupadas pelo dia em que saem do saldo. As compras de cada
 * cartão viram um item só, a fatura, como aparece no extrato do banco.
 */
export function billsOfMonth(month: MonthEntry, cards: Card[]): BillDay[] {
  const cardNames = new Map(cards.map((card) => [card.id, card.name]));
  const result: BillDay[] = [];

  for (const day of month.days) {
    const items: BillItem[] = [];
    const faturas = new Map<string, BillItem>();

    for (const tx of day.transactions) {
      if (tx.type === "saida") {
        items.push({
          id: tx.id,
          label: tx.description,
          amount: tx.amount,
          type: "saida",
          dateStr: day.dateStr,
          count: 1,
          txIds: [tx.id],
          paid: Boolean(tx.paid),
        });
      } else if (tx.type === "cartao") {
        const key = tx.cardId ?? `avulso-${tx.id}`;
        const existing = faturas.get(key);
        if (existing) {
          existing.amount += tx.amount;
          existing.count += 1;
          existing.txIds.push(tx.id);
          existing.paid = existing.paid && Boolean(tx.paid);
        } else {
          const name = tx.cardId ? cardNames.get(tx.cardId) : undefined;
          faturas.set(key, {
            id: `${day.dateStr}-${key}`,
            label: name ? `fatura ${name}` : tx.description,
            amount: tx.amount,
            type: "cartao",
            dateStr: day.dateStr,
            count: 1,
            txIds: [tx.id],
            paid: Boolean(tx.paid),
          });
        }
      }
    }

    items.push(...faturas.values());
    if (items.length === 0) continue;

    items.sort((a, b) => b.amount - a.amount);
    result.push({
      dateStr: day.dateStr,
      day: day.day,
      isPast: day.isPast,
      isToday: day.isToday,
      total: items.reduce((sum, item) => sum + item.amount, 0),
      items,
      allPaid: items.every((item) => item.paid),
    });
  }

  return result;
}

/** Fatura de um cartão num mês, pelo dia em que vence. */
export interface CardBill {
  key: string;
  label: string;
  year: number;
  month: number;
  amount: number;
  /** YYYY-MM-DD do vencimento neste mês. */
  dueDate: string;
  /** Tem compras e todas estão marcadas como pagas. */
  paid: boolean;
  count: number;
}

/** Fatura de cada cartão em cada mês da janela, pelo mês do vencimento. */
export interface CardForecast {
  card: Card;
  months: CardBill[];
}

export function cardForecasts(months: MonthEntry[], cards: Card[]): CardForecast[] {
  return cards.map((card) => ({
    card,
    months: months.map((month) => {
      let amount = 0;
      let count = 0;
      let paid = true;
      for (const day of month.days) {
        for (const tx of day.transactions) {
          if (tx.type === "cartao" && tx.cardId === card.id) {
            amount += tx.amount;
            count += 1;
            paid = paid && Boolean(tx.paid);
          }
        }
      }
      return {
        key: month.key,
        label: month.label,
        year: month.year,
        month: month.month,
        amount,
        dueDate: toDateStr(new Date(month.year, month.month, clampDueDay(month.year, month.month, card.dueDay))),
        paid: count > 0 && paid,
        count,
      };
    }),
  }));
}

/**
 * Quanto do limite de cada cartão está comprometido: compras ainda não pagas
 * cuja fatura vence do mês corrente em diante (parcelas futuras incluídas,
 * como o banco conta). Faturas de meses anteriores são consideradas pagas.
 */
export interface CardLimitUsage {
  card: Card;
  limite: number | null;
  emAberto: number;
  /** limite − em aberto; null sem limite informado. */
  livre: number | null;
}

export function cardLimitUsage(transactions: Transaction[], cards: Card[], today: Date): CardLimitUsage[] {
  const cardIndex = indexCards(cards);
  const monthStart = toDateStr(new Date(today.getFullYear(), today.getMonth(), 1));
  const emAberto = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.type !== "cartao" || !tx.cardId || tx.paid) continue;
    if (chargeDateOf(tx, cardIndex) < monthStart) continue;
    emAberto.set(tx.cardId, (emAberto.get(tx.cardId) ?? 0) + tx.amount);
  }

  return cards.map((card) => {
    const aberto = emAberto.get(card.id) ?? 0;
    const limite = card.limit && card.limit > 0 ? card.limit : null;
    return { card, limite, emAberto: aberto, livre: limite === null ? null : limite - aberto };
  });
}

export interface SavingsTotal {
  /** Tudo que já foi guardado até hoje, somando todos os anos. */
  guardado: number;
  /** Economias já lançadas para datas futuras (recorrências, por exemplo). */
  previsto: number;
  /** Ano da primeira economia, para datar o acumulado. */
  primeiroAno: number | null;
}

/**
 * Acumulado de economias de todos os anos.
 *
 * O que já passou e o que ainda vai acontecer vão separados de propósito: uma
 * recorrência sem prazo lança parcelas por anos à frente, e somá-las ao
 * guardado faria o app dizer que você tem um dinheiro que ainda não guardou.
 */
export function summarizeSavings(transactions: Transaction[], today: Date): SavingsTotal {
  const todayStr = toDateStr(today);
  let guardado = 0;
  let previsto = 0;
  let primeiroAno: number | null = null;

  for (const tx of transactions) {
    if (tx.type !== "investimento") continue;

    if (tx.date <= todayStr) guardado += tx.amount;
    else previsto += tx.amount;

    const year = Number(tx.date.slice(0, 4));
    if (tx.date <= todayStr && (primeiroAno === null || year < primeiroAno)) primeiroAno = year;
  }

  return { guardado, previsto, primeiroAno };
}

export interface AnnualSavings {
  year: number;
  totalEntradas: number;
  totalInvestido: number;
  totalPercent: number;
  months: {
    month: number;
    label: string;
    entradas: number;
    investido: number;
    percent: number;
  }[];
}

/** Entradas × reservas por mês do ano, direto das transações. */
export function summarizeYear(transactions: Transaction[], year: number): AnnualSavings {
  const months = Array.from({ length: 12 }, (_, month) => ({
    month,
    label: monthShortLabel(year, month).split("/")[0],
    entradas: 0,
    investido: 0,
    percent: 0,
  }));

  for (const tx of transactions) {
    const [txYear, txMonth] = tx.date.split("-").map(Number);
    if (txYear !== year) continue;
    const bucket = months[txMonth - 1];
    if (tx.type === "entrada") bucket.entradas += tx.amount;
    if (tx.type === "investimento") bucket.investido += tx.amount;
  }

  let totalEntradas = 0;
  let totalInvestido = 0;
  for (const m of months) {
    m.percent = m.entradas > 0 ? (m.investido / m.entradas) * 100 : 0;
    totalEntradas += m.entradas;
    totalInvestido += m.investido;
  }

  return {
    year,
    totalEntradas,
    totalInvestido,
    totalPercent: totalEntradas > 0 ? (totalInvestido / totalEntradas) * 100 : 0,
    months,
  };
}
