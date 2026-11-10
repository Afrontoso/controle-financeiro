/**
 * Sincronização do Open Finance (só servidor): lê os bancos na Pluggy, guarda
 * as transações novas (já classificadas) e o retrato das contas.
 */
import { prisma } from "@/lib/prisma";
import { pluggyClient, pluggyConfig, type PluggyAccount } from "@/lib/pluggy";
import {
  classify,
  normalizeName,
  ownerKey,
  toBankTx,
  type BankSnapshotData,
  type PluggyAccountRef,
} from "@/lib/openFinance";

/** Na primeira leitura, quantos dias para trás buscar. */
const FIRST_SYNC_DAYS = 60;
/** Nas seguintes, relê esta janela para pegar compras que mudaram de PENDING para POSTED. */
const RESYNC_DAYS = 30;

/** Só o dono das credenciais usa: o Meu Pluggy lê as contas de UM CPF. */
export function isOpenFinanceOwner(email: string | null | undefined): boolean {
  const owner = process.env.OPEN_FINANCE_OWNER_EMAIL?.trim().toLowerCase();
  return Boolean(owner && email && email.trim().toLowerCase() === owner && pluggyConfig());
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/** Primeiro dia do mês corrente em Brasília. */
function currentMonthStart(): string {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return `${today.slice(0, 7)}-01`;
}

export interface SyncResult {
  novas: number;
  naCaixa: number;
  ignoradas: number;
  atualizadas: number;
  primeiraVez: boolean;
}

export async function syncOpenFinance(userId: string): Promise<SyncResult> {
  const config = pluggyConfig();
  if (!config) throw new Error("Open Finance não configurado");

  const [user, vaults, existingCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.vault.findMany({ where: { userId }, select: { name: true } }),
    prisma.bankTransaction.count({ where: { userId } }),
  ]);
  const vaultNames = new Set(vaults.map((v) => normalizeName(v.name)));
  const owner = ownerKey(user?.name);
  const primeiraVez = existingCount === 0;
  const dateFrom = daysAgo(primeiraVez ? FIRST_SYNC_DAYS : RESYNC_DAYS);
  // Na primeira vez, o que é de meses anteriores vira histórico em vez de lotar a caixa de entrada.
  const historyBefore = primeiraVez ? currentMonthStart() : null;

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
        const c = classify(raw, ref, vaultNames, owner);
        classification.set(tx.id, historyBefore && tx.date < historyBefore && c.status === "pending" ? { status: "history" } : c);
      }
    }

    for (const inv of await client.investments(itemId)) {
      if ((inv.balance ?? 0) > 0) {
        snapshot.investments.push({ type: inv.type, subtype: inv.subtype ?? null, name: inv.name, balance: inv.balance });
      }
    }
  }

  // Grava só o que é novo; nas já conhecidas, atualiza status do banco e valor
  // (compra PENDING vira POSTED), sem mexer na decisão que você já tomou.
  const known = await prisma.bankTransaction.findMany({
    where: { id: { in: fetched.map((t) => t.id) } },
    select: { id: true, bankStatus: true, amount: true },
  });
  const knownById = new Map(known.map((k) => [k.id, k]));
  const novas = fetched.filter((t) => !knownById.has(t.id));
  const mudaram = fetched.filter((t) => {
    const k = knownById.get(t.id);
    return k && (k.bankStatus !== t.bankStatus || k.amount !== t.amount);
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
    await prisma.bankTransaction.update({
      where: { id: t.id },
      data: { bankStatus: t.bankStatus, amount: t.amount },
    });
  }

  await prisma.bankSnapshot.upsert({
    where: { userId },
    create: { userId, data: snapshot as object },
    update: { data: snapshot as object, syncedAt: new Date() },
  });

  // Cartões vinculados acompanham o limite que o banco informa.
  for (const account of snapshot.accounts) {
    if (account.type !== "CREDIT" || !account.creditLimit) continue;
    await prisma.card.updateMany({
      where: { userId, pluggyAccountId: account.id },
      data: { limit: account.creditLimit },
    });
  }

  return {
    novas: novas.length,
    naCaixa: novas.filter((t) => classification.get(t.id)?.status === "pending").length,
    ignoradas: novas.filter((t) => classification.get(t.id)?.status === "ignored").length,
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
