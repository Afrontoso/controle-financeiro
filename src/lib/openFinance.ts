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
  reserved?: {
    /** Id do cofrinho no banco; falta nos retratos antigos. */
    id?: string | null;
    name: string;
    amount: number;
  }[];
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
  /** Id da aplicação na Pluggy; falta nos retratos antigos. */
  id?: string | null;
  type: string;
  subtype: string | null;
  name: string;
  balance: number;
  /** Ticker de ação, fundo ou ETF. */
  code?: string | null;
  quantity?: number | null;
  /** Preço unitário: o da cota, nas ações e nos fundos. */
  unitValue?: number | null;
  /** Quanto foi aplicado; `balance - amountOriginal` é o rendimento. */
  amountOriginal?: number | null;
  /** 115 + "CDI" = 115% do CDI. */
  rate?: number | null;
  rateType?: string | null;
  /** YYYY-MM-DD. */
  issueDate?: string | null;
  dueDate?: string | null;
}

/** Aporte ou resgate em uma aplicação, como o banco informa. */
export interface InvestmentMove {
  id: string;
  /** YYYY-MM-DD. */
  date: string;
  kind: "aporte" | "resgate";
  amount: number;
  /** Subtipo da aplicação ("CDB"), para separar por classe. */
  subtype: string | null;
  rate: number | null;
  rateType: string | null;
}

export interface BankSnapshotData {
  items: SnapshotItem[];
  accounts: SnapshotAccount[];
  investments: SnapshotInvestment[];
  /** Movimentos recentes das aplicações; falta nos retratos antigos. */
  moves?: InvestmentMove[];
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

/* ------------------------------------------------------------------ */
/* Composição do patrimônio                                            */
/* ------------------------------------------------------------------ */

/** Investimento sem renda fixa é renda variável (ação, fundo, ETF). */
export function isVariableIncome(inv: SnapshotInvestment): boolean {
  return inv.type === "EQUITY" || inv.subtype === "ETF" || inv.subtype === "MUTUAL_FUND";
}

export interface NetWorth {
  /** Saldo solto nas contas. */
  disponivel: number;
  /** Cofrinhos do banco (dinheiro reservado dentro da conta). */
  reservado: number;
  rendaFixa: number;
  rendaVariavel: number;
  investido: number;
  /** disponivel + reservado + investido. */
  total: number;
  /** Fatura em aberto nos cartões (dívida, fora do total). */
  cartoes: number;
  limite: number;
  limiteLivre: number;
}

/** Quanto o usuário tem em cada lugar, pelo que os bancos informam. */
export function netWorth(snapshot: BankSnapshotData): NetWorth {
  const contas = snapshot.accounts.filter((a) => a.type === "BANK");
  const cartoes = snapshot.accounts.filter((a) => a.type === "CREDIT");
  const disponivel = contas.reduce((s, a) => s + a.balance, 0);
  const reservado = contas.reduce((s, a) => s + (a.reserved ?? []).reduce((r, x) => r + x.amount, 0), 0);
  const rendaVariavel = snapshot.investments.filter(isVariableIncome).reduce((s, i) => s + i.balance, 0);
  const investido = investedTotal(snapshot);

  return {
    disponivel,
    reservado,
    rendaFixa: investido - rendaVariavel,
    rendaVariavel,
    investido,
    total: disponivel + reservado + investido,
    cartoes: cartoes.reduce((s, a) => s + a.balance, 0),
    limite: cartoes.reduce((s, a) => s + (a.creditLimit ?? 0), 0),
    limiteLivre: cartoes.reduce((s, a) => s + (a.availableCreditLimit ?? 0), 0),
  };
}

/** Uma aplicação, como a tela de investimentos mostra. */
export interface InvestmentPosition {
  key: string;
  /** Id da aplicação no banco, para prender um apelido; null nos retratos antigos. */
  id: string | null;
  /** Ticker, ou a data em que foi aplicado, ou o nome do papel. */
  label: string;
  /** Ticker, quando é ação, fundo ou ETF. */
  code: string | null;
  value: number;
  /** `balance - amountOriginal`; null quando o banco não informa o aplicado. */
  profit: number | null;
  quantity: number | null;
  unitValue: number | null;
  rate: number | null;
  rateType: string | null;
  issueDate: string | null;
  dueDate: string | null;
}

export interface InvestmentGroup {
  key: string;
  label: string;
  total: number;
  /** Soma dos rendimentos conhecidos; null se nenhuma aplicação informa. */
  profit: number | null;
  positions: InvestmentPosition[];
}

/**
 * Agrupa as aplicações pelo que o banco diz, sem somar coisas diferentes: o
 * CDB separa por taxa (as caixinhas do Nubank a 115% do CDI não se misturam com
 * o dinheiro guardado a 100%), e ação, fundo imobiliário e tesouro ficam cada
 * um no seu grupo. Dentro do grupo, cada aplicação aparece em uma linha.
 */
export function investmentGroups(snapshot: BankSnapshotData): InvestmentGroup[] {
  const groups = new Map<string, InvestmentGroup>();

  for (const inv of snapshot.investments) {
    const { key, label } = groupOf(inv);
    const group =
      groups.get(key) ?? { key, label, total: 0, profit: null, positions: [] };
    const profit =
      inv.amountOriginal != null && inv.amountOriginal > 0 ? inv.balance - inv.amountOriginal : null;

    group.total += inv.balance;
    if (profit !== null) group.profit = (group.profit ?? 0) + profit;
    group.positions.push({
      key: inv.id ?? `${key}:${group.positions.length}`,
      id: inv.id ?? null,
      label: positionLabel(inv),
      code: isVariableIncome(inv) ? (inv.code ?? null) : null,
      value: inv.balance,
      profit,
      quantity: inv.quantity ?? null,
      unitValue: inv.unitValue ?? null,
      rate: inv.rate ?? null,
      rateType: inv.rateType ?? null,
      issueDate: inv.issueDate ?? null,
      dueDate: inv.dueDate ?? null,
    });
    groups.set(key, group);
  }

  const list = [...groups.values()];
  for (const group of list) group.positions.sort((a, b) => b.value - a.value);
  return list.sort((a, b) => b.total - a.total);
}

function groupOf(inv: SnapshotInvestment): { key: string; label: string } {
  const subtype = inv.subtype ?? "";
  if (subtype === "CDB" || subtype === "RDB" || subtype === "LCI" || subtype === "LCA") {
    const taxa = inv.rate && inv.rateType ? `${formatRate(inv.rate)}% do ${inv.rateType.toLowerCase()}` : null;
    return {
      key: taxa ? `${subtype}:${inv.rate}:${inv.rateType}` : subtype,
      label: taxa ? `${subtype.toLowerCase()} a ${taxa}` : subtype.toLowerCase(),
    };
  }
  if (subtype === "TREASURY") return { key: subtype, label: "tesouro direto" };
  if (subtype === "REAL_ESTATE_FUND") return { key: subtype, label: "fundos imobiliários" };
  if (subtype === "STOCK") return { key: subtype, label: "ações" };
  if (subtype === "ETF") return { key: subtype, label: "etfs" };
  if (subtype === "MUTUAL_FUND") return { key: subtype, label: "fundos de investimento" };
  const label = (subtype || inv.type).toLowerCase().replace(/_/g, " ");
  return { key: subtype || inv.type, label };
}

/** 115 -> "115"; 102.5 -> "102,5". */
function formatRate(rate: number): string {
  return rate.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function positionLabel(inv: SnapshotInvestment): string {
  // Ação e fundo se reconhecem pelo ticker; no tesouro o código é o ISIN
  // ("BRSTNCNTB7T1"), então vale mais o nome ("Tesouro IPCA+ 2032").
  if (inv.code && isVariableIncome(inv)) return inv.code.toLowerCase();
  if (inv.subtype === "TREASURY") return inv.name.toLowerCase();
  if (inv.issueDate) return `aplicado em ${inv.issueDate.split("-").reverse().join("/")}`;
  // "CDB - NU FINANCEIRA S.A. - SOCIEDADE DE..." -> "cdb - nu financeira s.a."
  return inv.name.split(" - ").slice(0, 2).join(" - ").toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Reserva em renda fixa de banco (cdb e parentes)                     */
/* ------------------------------------------------------------------ */

const BANK_FIXED_INCOME = new Set(["CDB", "RDB", "LCI", "LCA"]);

/** CDB, RDB, LCI, LCA: o dinheiro que fica rendendo no banco, pronto para usar. */
export function isBankFixedIncome(inv: { subtype?: string | null }): boolean {
  return BANK_FIXED_INCOME.has(inv.subtype ?? "");
}

export interface ReserveSummary {
  total: number;
  /** Soma do que foi aplicado, onde o banco informa. */
  aplicado: number;
  rendimento: number;
  posicoes: number;
  /** Quanto está em cada taxa ("115% do cdi"). */
  porTaxa: { key: string; label: string; total: number }[];
  aportes: number;
  resgates: number;
  /** Aportes e resgates, do mais novo para o mais velho. */
  moves: InvestmentMove[];
}

/**
 * O bolo de CDB e parentes visto junto: é onde costuma ficar a reserva, e
 * espalhado em dezenas de aplicações fica difícil de achar.
 */
export function reserveSummary(snapshot: BankSnapshotData): ReserveSummary | null {
  const posicoes = snapshot.investments.filter(isBankFixedIncome);
  if (posicoes.length === 0) return null;

  const porTaxa = new Map<string, { key: string; label: string; total: number }>();
  let aplicado = 0;
  let rendimento = 0;
  for (const inv of posicoes) {
    if (inv.amountOriginal != null && inv.amountOriginal > 0) {
      aplicado += inv.amountOriginal;
      rendimento += inv.balance - inv.amountOriginal;
    }
    const key = inv.rate && inv.rateType ? `${inv.rate}:${inv.rateType}` : "sem taxa";
    const label =
      inv.rate && inv.rateType ? `${inv.rate.toLocaleString("pt-BR")}% do ${inv.rateType.toLowerCase()}` : "sem taxa informada";
    const atual = porTaxa.get(key) ?? { key, label, total: 0 };
    atual.total += inv.balance;
    porTaxa.set(key, atual);
  }

  const moves = (snapshot.moves ?? [])
    .filter((m) => BANK_FIXED_INCOME.has(m.subtype ?? ""))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return {
    total: posicoes.reduce((s, i) => s + i.balance, 0),
    aplicado,
    rendimento,
    posicoes: posicoes.length,
    porTaxa: [...porTaxa.values()].sort((a, b) => b.total - a.total),
    aportes: moves.filter((m) => m.kind === "aporte").reduce((s, m) => s + m.amount, 0),
    resgates: moves.filter((m) => m.kind === "resgate").reduce((s, m) => s + m.amount, 0),
    moves,
  };
}
