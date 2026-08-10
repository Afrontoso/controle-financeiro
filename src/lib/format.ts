const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCurrency(value: number): string {
  return BRL.format(value);
}

/** 13.674,32 -> "13.67K". Usado nas células estreitas do horizonte. */
export function formatCompact(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (abs >= 1000) {
    const k = (abs / 1000).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${sign}${k}K`;
  }

  return `${sign}${abs.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`;
}

/** 13.54 -> "13,5%" */
export function formatPercent(value: number, digits = 1): string {
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

/** "2026-08-10" -> "10/08" */
export function formatDayMonth(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

const MONTHS_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

const MONTHS_LONG = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** (2026, 7) -> "ago/26" */
export function monthShortLabel(year: number, month: number): string {
  return `${MONTHS_SHORT[month]}/${String(year).slice(2)}`;
}

/** (2026, 7) -> "agosto de 2026" */
export function monthLongLabel(year: number, month: number): string {
  return `${MONTHS_LONG[month]} de ${year}`;
}

/** "2026-08-10" -> "10/ago" */
export function dayShortLabel(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${d}/${MONTHS_SHORT[m - 1]}`;
}

export function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export interface HeatTone {
  bg: string;
  fg: string;
}

/**
 * Faixa de cor do saldo projetado. Os cortes são os mesmos do app antigo,
 * só que agora resolvidos por token em vez de classe do Tailwind.
 */
export function heatTone(balance: number): HeatTone {
  if (balance >= 2000) return { bg: "var(--heat-pos-2)", fg: "var(--heat-pos-2-fg)" };
  if (balance > 500) return { bg: "var(--heat-pos-1)", fg: "var(--heat-pos-1-fg)" };
  if (balance >= 100) return { bg: "var(--heat-pos-0)", fg: "var(--heat-pos-0-fg)" };
  if (balance >= 0) return { bg: "var(--heat-zero)", fg: "var(--heat-zero-fg)" };
  if (balance >= -500) return { bg: "var(--heat-neg-0)", fg: "var(--heat-neg-0-fg)" };
  if (balance >= -1000) return { bg: "var(--heat-neg-1)", fg: "var(--heat-neg-1-fg)" };
  return { bg: "var(--heat-neg-2)", fg: "var(--heat-neg-2-fg)" };
}
