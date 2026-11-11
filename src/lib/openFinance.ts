import type { Card, Transaction, TxType, Vault } from "@/lib/types";

/**
 * Regras do Open Finance (Pluggy), sem acesso a rede nem banco: o servidor usa
 * para filtrar o que chega e o navegador para sugerir o que fazer na caixa de
 * entrada.
 *
 * O que a Pluggy manda e precisa de cuidado (visto nos dados reais):
 *  - na conta, negativo é saída; no cartão, positivo é compra e negativo é
 *    pagamento, estorno ou desconto;
 *  - "pagamento de fatura" aparece na conta E no cartão: as compras já entram
 *    pelo cartão, então os dois lados ficam de fora;
 *  - transferências entre contas próprias vêm como "Same person transfer" /
 *    "Transfer - Internal" e não são gasto nem renda;
 *  - o Nubank aplica e resgata o saldo em RDB sozinho, e o Mercado Pago lança
 *    rendimentos de centavos todo dia (operationType RESGATE_APLIC_FINANCEIRA);
 *  - cofrinhos do Mercado Pago movimentam com "Dinheiro reservado/retirado X".
 */

/** Subconjunto da transação da Pluggy que o app usa. */
export interface PluggyTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "DEBIT" | "CREDIT";
  status?: string | null;
  category?: string | null;
  operationType?: string | null;
  creditCardMetadata?: { installmentNumber?: number | null; totalInstallments?: number | null } | null;
}

export interface PluggyAccountRef {
  id: string;
  itemId: string;
  /** "BANK" ou "CREDIT". */
  type: string;
  name: string;
}

export type BankTxStatus = "pending" | "imported" | "linked" | "ignored" | "history";

/** Transação do banco como o app guarda e mostra. */
export interface BankTx {
  id: string;
  itemId: string;
  accountId: string;
  accountType: string;
  accountName: string;
  /** YYYY-MM-DD no fuso de Brasília. */
  date: string;
  description: string;
  amount: number;
  direction: "DEBIT" | "CREDIT";
  operationType: string | null;
  category: string | null;
  installmentNumber: number | null;
  totalInstallments: number | null;
  bankStatus: string | null;
  status: BankTxStatus;
  reason: string | null;
  transactionId: string | null;
}

/** "2026-11-09T03:00:00.000Z" -> "2026-11-09" no fuso de Brasília. */
export function toBrazilDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Dinheiro saindo do bolso: na conta é negativo; no cartão, a compra é positiva. */
export function isOutflow(tx: Pick<BankTx, "accountType" | "amount">): boolean {
  return tx.accountType === "CREDIT" ? tx.amount > 0 : tx.amount < 0;
}

const INTERNAL_CATEGORIES = new Set(["Same person transfer", "Transfer - Internal"]);
const CARD_PAYMENT = /pagamento (de fatura|recebido)|pagamento cart[aã]o de cr[eé]dito/i;
const VAULT_MOVE = /^dinheiro (reservado|retirado)\s+(.+)$/i;

/** "Dinheiro reservado Entrada da casa" -> guardar no cofre "entrada da casa". */
export function vaultMove(description: string): { kind: "guardar" | "resgatar"; name: string } | null {
  const match = VAULT_MOVE.exec(description.trim());
  if (!match) return null;
  return { kind: match[1].toLowerCase() === "reservado" ? "guardar" : "resgatar", name: match[2].trim() };
}

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * "Victor Leandro Rocha de Assis" -> "victor leandro": o começo do nome, como
 * aparece nos Pix ("Pix enviado Victor Leandro Ro..."), cortado pelo banco.
 */
export function ownerKey(fullName: string | null | undefined): string | null {
  const parts = normalizeName(fullName ?? "").split(/\s+/).filter(Boolean);
  return parts.length >= 2 ? `${parts[0]} ${parts[1]}` : null;
}

/**
 * Decide se a transação vai para a caixa de entrada ou fica de fora, e por quê.
 * `vaultNames` são os cofres do app (normalizados): movimento de cofrinho só
 * entra se houver cofre com o mesmo nome. `owner` (ver ownerKey) pega Pix para
 * você mesmo que o banco não categorizou como transferência própria.
 */
export function classify(
  tx: PluggyTransaction,
  account: PluggyAccountRef,
  vaultNames: Set<string>,
  owner: string | null = null,
): { status: "pending" | "ignored"; reason?: string } {
  const category = tx.category ?? "";
  const description = tx.description ?? "";

  if (category === "Credit card payment" || CARD_PAYMENT.test(description)) {
    return { status: "ignored", reason: "pagamento de fatura: as compras já entram pelo cartão" };
  }

  const move = vaultMove(description);
  if (move) {
    return vaultNames.has(normalizeName(move.name))
      ? { status: "pending" }
      : { status: "ignored", reason: `movimento do cofrinho "${move.name}" (crie um cofre com esse nome para acompanhar)` };
  }

  if (
    INTERNAL_CATEGORIES.has(category) ||
    (owner && /pix|transfer[eê]ncia/i.test(description) && normalizeName(description).includes(owner))
  ) {
    return { status: "ignored", reason: "transferência entre suas contas" };
  }

  if (account.type === "BANK" && tx.operationType === "RESGATE_APLIC_FINANCEIRA") {
    return { status: "ignored", reason: "aplicação, resgate automático ou rendimento" };
  }

  if (account.type === "CREDIT" && tx.amount < 0) {
    return { status: "ignored", reason: "estorno ou desconto no cartão" };
  }

  return { status: "pending" };
}

/** Converte a transação da Pluggy para o formato guardado (sem status). */
export function toBankTx(
  tx: PluggyTransaction,
  account: PluggyAccountRef,
): Omit<BankTx, "status" | "reason" | "transactionId"> {
  return {
    id: tx.id,
    itemId: account.itemId,
    accountId: account.id,
    accountType: account.type,
    accountName: account.name,
    date: toBrazilDate(tx.date),
    description: tx.description,
    amount: tx.amount,
    direction: tx.type,
    operationType: tx.operationType ?? null,
    category: tx.category ?? null,
    installmentNumber: tx.creditCardMetadata?.installmentNumber ?? null,
    totalInstallments: tx.creditCardMetadata?.totalInstallments ?? null,
    bankStatus: tx.status ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Sugestões da caixa de entrada                                       */
/* ------------------------------------------------------------------ */

/** Categorias de gasto do dia a dia: viram "gasto diário" e descontam dos orçamentos. */
const DAILY_CATEGORIES = new Set([
  "Groceries",
  "Eating out",
  "Food and drinks",
  "Taxi and ride-hailing",
  "Public transportation",
  "Gas stations",
  "Pharmacy",
  "Bakery",
  "Convenience stores",
]);

export interface Suggestion {
  /** "import" cria um lançamento; "link" reconhece um que você já lançou. */
  action: "import" | "link";
  type: TxType;
  description: string;
  amount: number;
  date: string;
  cardId: string | null;
  vaultId: string | null;
  /** Lançamento seu que bate com esta transação (só em "link"). */
  match: Transaction | null;
  /** Explicação curta para a tela. */
  note: string;
}

/** "Compra no débito|CLEBER DA SILVA" -> "compra no débito · cleber da silva". */
export function cleanDescription(tx: Pick<BankTx, "description" | "installmentNumber" | "totalInstallments">): string {
  let text = tx.description.split("|").map((part) => part.trim()).filter(Boolean).join(" · ");
  if (tx.totalInstallments && tx.installmentNumber && !/\d+\/\d+/.test(text)) {
    text += ` (${tx.installmentNumber}/${tx.totalInstallments})`;
  }
  return text.toLowerCase();
}

function daysBetween(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/** Tolerâncias para reconhecer um lançamento seu: valor quase igual e data próxima. */
const MATCH_MAX_DAYS = 7;
function amountsMatch(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1, Math.abs(a) * 0.02);
}

export interface SuggestionContext {
  transactions: Transaction[];
  cards: Card[];
  vaults: Vault[];
  /** Lançamentos já reconhecidos por outra transação do banco. */
  linkedIds: Set<string>;
  /**
   * Outras transações do banco (para notar parcelas antecipadas: várias
   * parcelas da mesma compra no mesmo dia).
   */
  bankTxs?: BankTx[];
}

/** "Jim.Com* Oticas Komfo 8/10" -> "jim.com* oticas komfo" (para agrupar parcelas). */
function purchaseKey(tx: BankTx): string {
  return normalizeName(tx.description).replace(/\s*\d+\/\d+\s*$/, "");
}

export function suggest(tx: BankTx, ctx: SuggestionContext): Suggestion {
  const amount = Math.abs(tx.amount);
  const description = cleanDescription(tx);
  const outflow = isOutflow(tx);
  const base = { description, amount, date: tx.date, cardId: null, vaultId: null, match: null };

  // Cofrinho com cofre de mesmo nome: guardar = economia, retirar = entrada, no cofre.
  const move = vaultMove(tx.description);
  if (move) {
    const vault = ctx.vaults.find((v) => normalizeName(v.name) === normalizeName(move.name)) ?? null;
    return {
      ...base,
      action: "import",
      type: move.kind === "guardar" ? "investimento" : "entrada",
      vaultId: vault?.id ?? null,
      note: move.kind === "guardar" ? `guardar no cofre ${vault?.name ?? move.name}` : `resgate do cofre ${vault?.name ?? move.name}`,
    };
  }

  let type: TxType;
  let cardId: string | null = null;
  let note: string;
  if (tx.accountType === "CREDIT") {
    type = "cartao";
    const card = ctx.cards.find((c) => c.pluggyAccountId === tx.accountId) ?? null;
    cardId = card?.id ?? null;
    note = card ? `compra no cartão ${card.name}` : `compra no cartão ${tx.accountName.toLowerCase()} (vincule ao cartão do app)`;
  } else if (!outflow) {
    type = "entrada";
    note = "entrada na conta";
  } else if (tx.category && DAILY_CATEGORIES.has(tx.category)) {
    type = "gasto_diario";
    note = "gasto do dia a dia";
  } else {
    type = "saida";
    note = "saída da conta";
  }

  // Reconhecer um lançamento seu: mesma direção, valor e data próximos, não
  // vindo do banco e ainda sem par. O mais próximo na data vence.
  const outflowTypes: TxType[] = ["saida", "gasto_diario", "cartao"];
  const candidates = ctx.transactions.filter(
    (t) =>
      t.source !== "pluggy" &&
      !ctx.linkedIds.has(t.id) &&
      (outflow ? outflowTypes.includes(t.type) : t.type === "entrada") &&
      amountsMatch(t.amount, amount) &&
      daysBetween(t.date, tx.date) <= MATCH_MAX_DAYS,
  );
  candidates.sort((a, b) => daysBetween(a.date, tx.date) - daysBetween(b.date, tx.date));
  const match = candidates[0] ?? null;

  if (match) {
    return {
      ...base,
      action: "link",
      type: match.type,
      cardId: match.cardId ?? cardId,
      vaultId: match.vaultId ?? null,
      match,
      note: `é o seu lançamento “${match.description}” de ${match.date.split("-").reverse().slice(0, 2).join("/")}`,
    };
  }

  if (tx.totalInstallments && ctx.bankTxs) {
    const key = purchaseKey(tx);
    const sameDay = ctx.bankTxs.filter(
      (o) => o.accountId === tx.accountId && o.date === tx.date && o.totalInstallments && purchaseKey(o) === key,
    ).length;
    if (sameDay > 1) {
      // Antecipar parcelas cobra na hora: o dinheiro sai no dia, não na próxima fatura.
      return {
        ...base,
        action: "import",
        type: "saida",
        cardId: null,
        note: `${sameDay} parcelas desta compra no mesmo dia: antecipação, sai do saldo no dia do pagamento`,
      };
    }
  }

  return { ...base, action: "import", type, cardId, note };
}

/* ------------------------------------------------------------------ */
/* Retrato das contas                                                  */
/* ------------------------------------------------------------------ */

export interface SnapshotAccount {
  id: string;
  itemId: string;
  type: string;
  subtype: string;
  name: string;
  balance: number;
  /** Só cartão. */
  creditLimit?: number | null;
  availableCreditLimit?: number | null;
  balanceDueDate?: string | null;
  /** Só conta: cofrinhos (Mercado Pago). */
  reserved?: { name: string; amount: number }[];
}

export interface SnapshotItem {
  id: string;
  connector: string;
  status: string;
  lastUpdatedAt: string | null;
  consentExpiresAt: string | null;
  error: string | null;
}

export interface SnapshotInvestment {
  type: string;
  subtype: string | null;
  name: string;
  balance: number;
}

export interface BankSnapshotData {
  items: SnapshotItem[];
  accounts: SnapshotAccount[];
  investments: SnapshotInvestment[];
}

/** Dinheiro disponível nas contas: saldo + cofrinhos (cartão fica de fora). */
export function liquidTotal(snapshot: BankSnapshotData): number {
  return snapshot.accounts
    .filter((a) => a.type === "BANK")
    .reduce((s, a) => s + a.balance + (a.reserved ?? []).reduce((r, x) => r + x.amount, 0), 0);
}

export function investedTotal(snapshot: BankSnapshotData): number {
  return snapshot.investments.reduce((s, i) => s + i.balance, 0);
}
