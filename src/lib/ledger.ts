import type { Budget, Transaction, TxType } from "@/lib/types";
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

function groupByDate(transactions: Transaction[]): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const bucket = map.get(tx.date);
    if (bucket) bucket.push(tx);
    else map.set(tx.date, [tx]);
  }
  return map;
}

/** Mês da transação mais antiga, ou null se não houver nenhuma. */
function earliestTxMonth(transactions: Transaction[]): YearMonth | null {
  let earliest: YearMonth | null = null;
  for (const tx of transactions) {
    const [year, month] = tx.date.split("-").map(Number);
    const candidate = { year, month: month - 1 };
    if (!earliest || compareYearMonth(candidate, earliest) < 0) earliest = candidate;
  }
  return earliest;
}

interface BuildLedgerOptions {
  transactions: Transaction[];
  budgets: Budget[];
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
  today,
  from,
  to,
}: BuildLedgerOptions): MonthEntry[] {
  const drainPerDay = dailyDrain(budgets);
  const byDate = groupByDate(transactions);

  const todayMonth: YearMonth = { year: today.getFullYear(), month: today.getMonth() };
  const todayStr = toDateStr(today);

  let start: YearMonth = compareYearMonth(from, todayMonth) < 0 ? from : todayMonth;
  const earliest = earliestTxMonth(transactions);
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
  gastos: Transaction[];
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
    .flatMap((d) => d.transactions)
    .filter((tx) => tx.type === "saida" || tx.type === "cartao" || tx.type === "gasto_diario")
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

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
