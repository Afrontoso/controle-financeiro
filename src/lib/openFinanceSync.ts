/**
 * Sincronização do Open Finance (só servidor): lê os bancos na Pluggy, guarda
 * as transações novas (já marcadas como movimento real ou interno) e o retrato
 * das contas. Só escreve nas tabelas do open finance: lançamentos, cofres,
 * cartões e orçamentos do app não são tocados.
 */
import { prisma } from "@/lib/prisma";
import { pluggyClient, pluggyConfig, type PluggyAccount, type PluggyInvestment } from "@/lib/pluggy";
import { classify, ownerKey, toBankTx, type BankSnapshotData, type PluggyAccountRef } from "@/lib/openFinance";

/** Na primeira leitura, quantos dias para trás buscar. */
const FIRST_SYNC_DAYS = 60;
/** Nas seguintes, relê esta janela para pegar compras que mudaram de PENDING para POSTED. */
const RESYNC_DAYS = 30;

/**
 * Chave geral (o Meu Pluggy lê as contas de UM CPF, então é uso pessoal): o Open Finance só liga com OPEN_FINANCE_ENABLED=true. Desligado,
 * o app funciona só com lançamentos manuais e nenhuma tela de banco aparece.
 */
export function openFinanceEnabled(): boolean {
  return process.env.OPEN_FINANCE_ENABLED?.trim().toLowerCase() === "true";
}

export function isOpenFinanceOwner(email: string | null | undefined): boolean {
  if (!openFinanceEnabled()) return false;
  const owner = process.env.OPEN_FINANCE_OWNER_EMAIL?.trim().toLowerCase();
  return Boolean(owner && email && email.trim().toLowerCase() === owner && pluggyConfig());
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export interface SyncResult {
  novas: number;
  /** Das novas, quantas são dinheiro entrando ou saindo de verdade. */
  movimentos: number;
  /** Das novas, quantas são movimento interno (transferência, fatura, cofrinho). */
  internas: number;
  atualizadas: number;
  primeiraVez: boolean;
}

export async function syncOpenFinance(userId: string): Promise<SyncResult> {
  const config = pluggyConfig();
  if (!config) throw new Error("Open Finance não configurado");

  const [user, existingCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.bankTransaction.count({ where: { userId } }),
  ]);
  const owner = ownerKey(user?.name);
  const primeiraVez = existingCount === 0;
  const dateFrom = daysAgo(primeiraVez ? FIRST_SYNC_DAYS : RESYNC_DAYS);

  const client = await pluggyClient(config);
  const snapshot: BankSnapshotData = { items: [], accounts: [], investments: [] };
  const fetched: ReturnType<typeof toBankTx>[] = [];
  const classification = new Map<string, { status: string; reason?: string }>();

  for (const itemId of config.itemIds) {
    const item = await client.item(itemId);
    snapshot.items.push({
      id: item.id,
      connector: item.connector?.name ?? "banco",
      status: item.status,
      lastUpdatedAt: item.lastUpdatedAt ?? null,
      consentExpiresAt: item.consentExpiresAt ?? null,
      error: item.error?.message ?? null,
    });

    const accounts = await client.accounts(itemId);
    for (const account of accounts) {
      snapshot.accounts.push(snapshotAccount(account));
      const ref: PluggyAccountRef = { id: account.id, itemId, type: account.type, name: accountLabel(account) };
      for (const raw of await client.transactions(account.id, dateFrom)) {
        const tx = toBankTx(raw, ref);
        fetched.push(tx);
        classification.set(tx.id, classify(raw, ref, owner));
      }
    }

    for (const inv of await client.investments(itemId)) {
      // A Pluggy manda também o que já foi resgatado, com saldo zero.
      if ((inv.balance ?? 0) > 0) snapshot.investments.push(snapshotInvestment(inv));
    }
  }

  // Grava só o que é novo; nas já conhecidas, atualiza status do banco e valor
  // (compra PENDING vira POSTED).
  const known = await prisma.bankTransaction.findMany({
    where: { id: { in: fetched.map((t) => t.id) } },
    select: { id: true, bankStatus: true, amount: true, status: true, reason: true },
  });
  const knownById = new Map(known.map((k) => [k.id, k]));
  const novas = fetched.filter((t) => !knownById.has(t.id));
  /** Marcação de uma linha que já está no banco de dados pode mudar de regra. */
  const remarcar = (t: (typeof fetched)[number]) => {
    const k = knownById.get(t.id);
    const c = classification.get(t.id);
    if (!k || !c) return false;
    // Linhas antigas, de quando o banco lançava no app, ficam como estão.
    if (k.status !== "pending" && k.status !== "ignored") return false;
    return k.status !== c.status || (k.reason ?? null) !== (c.reason ?? null);
  };
  const mudaram = fetched.filter((t) => {
    const k = knownById.get(t.id);
    return k && (k.bankStatus !== t.bankStatus || k.amount !== t.amount || remarcar(t));
  });

  if (novas.length > 0) {
    await prisma.bankTransaction.createMany({
      data: novas.map((t) => {
        const c = classification.get(t.id)!;
        return {
          ...t,
          date: new Date(`${t.date}T12:00:00.000Z`),
          status: c.status,
          reason: c.reason ?? null,
          userId,
        };
      }),
      skipDuplicates: true,
    });
  }
  for (const t of mudaram) {
    const c = classification.get(t.id)!;
    await prisma.bankTransaction.update({
      where: { id: t.id },
      data: {
        bankStatus: t.bankStatus,
        amount: t.amount,
        ...(remarcar(t) ? { status: c.status, reason: c.reason ?? null } : {}),
      },
    });
  }

  await prisma.bankSnapshot.upsert({
    where: { userId },
    create: { userId, data: snapshot as object },
    update: { data: snapshot as object, syncedAt: new Date() },
  });

  return {
    novas: novas.length,
    movimentos: novas.filter((t) => classification.get(t.id)?.status === "pending").length,
    internas: novas.filter((t) => classification.get(t.id)?.status === "ignored").length,
    atualizadas: mudaram.length,
    primeiraVez,
  };
}

/** Nome curto da conta: o Nubank manda "Nu Pagamentos S.A. - Instituição de Pagamento". */
function accountLabel(account: PluggyAccount): string {
  const name = account.marketingName || account.name;
  if (/^nu pagamentos/i.test(name)) return "Nubank";
  if (account.subtype === "CREDIT_CARD" && account.name.length <= 12) return `cartão ${account.name}`;
  return name;
}

function snapshotInvestment(inv: PluggyInvestment): BankSnapshotData["investments"][number] {
  return {
    type: inv.type,
    subtype: inv.subtype ?? null,
    name: inv.name,
    balance: inv.balance,
    code: inv.code ?? null,
    quantity: inv.quantity ?? null,
    unitValue: inv.value ?? null,
    amountOriginal: inv.amountOriginal ?? null,
    rate: inv.rate ?? null,
    rateType: inv.rateType ?? null,
    issueDate: inv.issueDate?.slice(0, 10) ?? null,
    dueDate: inv.dueDate?.slice(0, 10) ?? null,
  };
}

function snapshotAccount(account: PluggyAccount): BankSnapshotData["accounts"][number] {
  const reserved = (account.bankData?.reservedBalances ?? []).map((r) => ({
    name: r.name?.trim() || "cofrinho sem nome",
    amount: (r.availableAmounts ?? []).reduce((s, a) => s + (a.amount ?? 0), 0),
  }));
  return {
    id: account.id,
    itemId: account.itemId,
    type: account.type,
    subtype: account.subtype,
    name: accountLabel(account),
    balance: account.balance,
    creditLimit: account.creditData?.creditLimit ?? null,
    availableCreditLimit: account.creditData?.availableCreditLimit ?? null,
    balanceDueDate: account.creditData?.balanceDueDate ?? null,
    reserved: reserved.length > 0 ? reserved : undefined,
  };
}
