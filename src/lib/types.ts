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
}

export interface Budget {
  id: string;
  name: string;
  amount: number;
  divideBy: number;
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
