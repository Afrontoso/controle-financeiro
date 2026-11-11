export const TX_TYPES = [
  "entrada",
  "saida",
  "gasto_diario",
  "investimento",
  "cartao",
] as const;

export type TxType = (typeof TX_TYPES)[number];

export interface Transaction {
  id: string;
  /** Sempre YYYY-MM-DD no fuso local — nunca ISO com hora. */
  date: string;
  description: string;
  /** Valor absoluto. O sinal é derivado do `type`. */
  amount: number;
  type: TxType;
  category?: string;
  groupId?: string;
  /** Só em lançamentos de cartão: a cobrança vai para o vencimento da fatura. */
  cardId?: string;
  /** Economia guardada neste cofre, ou entrada resgatada dele. */
  vaultId?: string;
  /** Gerado por um plano (ex.: "apto:banco"); ausente nos manuais. */
  source?: string;
  /** Marcado como pago. Só registro: não muda o saldo projetado. */
  paid?: boolean;
  /** Responsável é a esposa, não você (gravado como category "<tipo>:conjuge"). */
  conjuge?: boolean;
}

/** Sufixo de `category` que marca o lançamento como da esposa. */
const CONJUGE_SUFFIX = ":conjuge";

export function categoryFor(type: TxType, conjuge?: boolean): string {
  return conjuge ? `${type}${CONJUGE_SUFFIX}` : type;
}

export function isConjugeCategory(category: string | null | undefined): boolean {
  return Boolean(category?.endsWith(CONJUGE_SUFFIX));
}

/** De quem o app está mostrando: os dois, só você ou só a esposa. */
export type PersonFilter = "todos" | "eu" | "esposa";

export function matchesPerson(tx: Pick<Transaction, "conjuge">, filter: PersonFilter): boolean {
  if (filter === "todos") return true;
  return filter === "esposa" ? Boolean(tx.conjuge) : !tx.conjuge;
}

export type VaultKind = "reserva" | "cofre";

export interface Vault {
  id: string;
  name: string;
  /** Meta em reais; null = sem meta. */
  goal: number | null;
  /** Meta automática: N meses do custo de vida fixo; vale no lugar de `goal`. */
  goalMonths: number | null;
  /** O que já estava guardado quando o cofre foi criado no app. */
  initial: number;
  kind: VaultKind;
  /**
   * Dia em que o cofre foi criado (YYYY-MM-DD). `initial` já inclui tudo que
   * aconteceu antes: movimentos anteriores entram no histórico, não no saldo.
   */
  createdAt?: string;
}

export interface Budget {
  id: string;
  name: string;
  amount: number;
  divideBy: number;
}

export interface Card {
  id: string;
  name: string;
  /** Dia do vencimento da fatura (1–31). */
  dueDay: number;
  /** Limite de crédito; null = não informado. */
  limit?: number | null;
  /** Conta de cartão no Open Finance que corresponde a este cartão. */
  pluggyAccountId?: string | null;
}

export interface TxTypeMeta {
  key: TxType;
  /** Rótulo em caixa baixa, no plural, como aparece nas colunas. */
  label: string;
  /** Rótulo no singular, para o formulário. */
  singular: string;
  /** Letra do selo circular na tabela. */
  badge: string;
  color: string;
  softColor: string;
}

export const TX_TYPE_META: Record<TxType, TxTypeMeta> = {
  entrada: {
    key: "entrada",
    label: "entradas",
    singular: "entrada",
    badge: "E",
    color: "var(--entrada)",
    softColor: "var(--entrada-soft)",
  },
  saida: {
    key: "saida",
    label: "saídas",
    singular: "saída",
    badge: "S",
    color: "var(--saida)",
    softColor: "var(--saida-soft)",
  },
  gasto_diario: {
    key: "gasto_diario",
    label: "diários",
    singular: "gasto diário",
    badge: "D",
    color: "var(--diario)",
    softColor: "var(--diario-soft)",
  },
  investimento: {
    key: "investimento",
    label: "economias",
    singular: "economia",
    badge: "R",
    color: "var(--economia)",
    softColor: "var(--economia-soft)",
  },
  cartao: {
    key: "cartao",
    label: "cartão",
    singular: "cartão",
    badge: "C",
    color: "var(--cartao)",
    softColor: "var(--cartao-soft)",
  },
};

/** Ordem das colunas na tabela de saldos, igual à do formulário. */
export const TX_TYPE_ORDER: TxType[] = [
  "entrada",
  "saida",
  "gasto_diario",
  "investimento",
  "cartao",
];

export function isTxType(value: unknown): value is TxType {
  return typeof value === "string" && (TX_TYPES as readonly string[]).includes(value);
}
