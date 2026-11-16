/**
 * Regras do Open Finance (Pluggy), sem acesso a rede nem banco: o servidor usa
 * para marcar o que chega. Nada daqui vira lançamento do app: a aba de open
 * finance é só leitura.
 *
 * A aba hoje mostra só o retrato das contas; o extrato continua sendo guardado
 * a cada sincronização, então `cleanDescription` e `isOutflow` ficam aqui para
 * quando ele voltar à tela.
 *
 * O que a Pluggy manda e precisa de cuidado (visto nos dados reais):
 *  - na conta, negativo é saída; no cartão, positivo é compra e negativo é
 *    pagamento, estorno ou desconto;
 *  - "pagamento de fatura" aparece na conta E no cartão: o gasto já está nas
 *    compras do cartão, então os dois lados saem do extrato;
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

/**
 * "pending" é movimento de verdade e "ignored" é interno (transferência entre
 * contas suas, pagamento de fatura, cofrinho, rendimento). "imported",
 * "linked" e "history" ficam de linhas antigas, de quando o banco lançava no
 * app; hoje o extrato só mostra, nunca lança.
 */
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
 * Diz se a transação é dinheiro entrando ou saindo de verdade ("pending") ou só
 * movimento interno ("ignored"), com o motivo para o extrato mostrar. `owner`
 * (ver ownerKey) pega Pix para você mesmo que o banco não categorizou como
 * transferência própria.
 */
export function classify(
  tx: PluggyTransaction,
  account: PluggyAccountRef,
  owner: string | null = null,
): { status: "pending" | "ignored"; reason?: string } {
  const category = tx.category ?? "";
  const description = tx.description ?? "";

  if (category === "Credit card payment" || CARD_PAYMENT.test(description)) {
    return { status: "ignored", reason: "pagamento de fatura: o gasto está nas compras do cartão" };
  }

  const move = vaultMove(description);
  if (move) {
    // Reservar e retirar do cofrinho é dinheiro andando dentro da própria conta.
    return { status: "ignored", reason: `${move.kind === "guardar" ? "reservado no" : "retirado do"} cofrinho "${move.name}"` };
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

/** "Compra no débito|CLEBER DA SILVA" -> "compra no débito · cleber da silva". */
export function cleanDescription(tx: Pick<BankTx, "description" | "installmentNumber" | "totalInstallments">): string {
  let text = tx.description.split("|").map((part) => part.trim()).filter(Boolean).join(" · ");
  if (tx.totalInstallments && tx.installmentNumber && !/\d+\/\d+/.test(text)) {
    text += ` (${tx.installmentNumber}/${tx.totalInstallments})`;
  }
  return text.toLowerCase();
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
