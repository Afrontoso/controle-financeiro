import { activeSeries } from "@/lib/series";
import type { Budget, Transaction, Vault } from "@/lib/types";
import { toDateStr } from "@/lib/format";
import { monthlyBudgetTotal } from "@/lib/ledger";

/**
 * Cofres: dinheiro separado para um fim. Guardar é uma economia ligada ao cofre
 * (sai do saldo), resgatar é uma entrada ligada a ele (volta para o saldo). O
 * saldo do cofre é derivado desses lançamentos, sem conta paralela.
 */

export interface VaultBalance {
  vault: Vault;
  /** Saldo hoje: inicial + guardado − resgatado, só o que já aconteceu. */
  saldo: number;
  /** Movimento já agendado para datas futuras (guardar − resgatar). */
  previsto: number;
  /** Quanto entrou no cofre no mês corrente (líquido). */
  noMes: number;
  /** Meta em reais: a fixa, ou N meses do custo fixo quando automática; null sem meta. */
  meta: number | null;
  /** A meta acompanha o custo de vida fixo. */
  metaAutomatica: boolean;
  /** Fração da meta atingida (0–1+); null sem meta. */
  progresso: number | null;
  /** Quanto falta para a meta (0 se passou); null sem meta. */
  falta: number | null;
  /** Movimentos já acontecidos, do mais recente ao mais antigo. */
  movimentos: Transaction[];
}

/** Sinal do lançamento no cofre: economia entra, entrada (resgate) sai. */
function vaultDelta(tx: Transaction): number {
  if (tx.type === "investimento") return tx.amount;
  if (tx.type === "entrada") return -tx.amount;
  return 0;
}

export function vaultBalances(
  vaults: Vault[],
  transactions: Transaction[],
  today: Date,
  fixedCost?: FixedCost,
): VaultBalance[] {
  const todayStr = toDateStr(today);
  const monthPrefix = todayStr.slice(0, 7);
  const byVault = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (!tx.vaultId) continue;
    const bucket = byVault.get(tx.vaultId);
    if (bucket) bucket.push(tx);
    else byVault.set(tx.vaultId, [tx]);
  }

  return vaults.map((vault) => {
    const txs = byVault.get(vault.id) ?? [];
    let saldo = vault.initial;
    let previsto = 0;
    let noMes = 0;
    const movimentos: Transaction[] = [];

    for (const tx of txs) {
      // O "já guardado" informado na criação já conta o que veio antes.
      const delta = vault.createdAt && tx.date < vault.createdAt ? 0 : vaultDelta(tx);
      if (tx.date <= todayStr) {
        saldo += delta;
        movimentos.push(tx);
        if (tx.date.startsWith(monthPrefix)) noMes += delta;
      } else {
        previsto += delta;
      }
    }

    movimentos.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const metaAutomatica = Boolean(vault.goalMonths && fixedCost);
    const goal = metaAutomatica
      ? fixedCost!.total * vault.goalMonths! || null
      : vault.goal && vault.goal > 0
        ? vault.goal
        : null;

    return {
      vault,
      saldo,
      previsto,
      noMes,
      meta: goal,
      metaAutomatica,
      progresso: goal ? saldo / goal : null,
      falta: goal ? Math.max(goal - saldo, 0) : null,
      movimentos,
    };
  });
}

/** Reserva primeiro, depois por nome. */
export function sortVaults(balances: VaultBalance[]): VaultBalance[] {
  return [...balances].sort((a, b) => {
    if (a.vault.kind !== b.vault.kind) return a.vault.kind === "reserva" ? -1 : 1;
    return a.vault.name.localeCompare(b.vault.name, "pt-BR");
  });
}

/**
 * Custo de vida fixo: o valor mensal das contas marcadas como essenciais
 * (água, internet, aluguel...) mais os orçamentos. Não depende do que está
 * lançado no mês: uma conta essencial conta pelo valor da próxima cobrança.
 */
export interface FixedCost {
  total: number;
  /** Soma das contas essenciais (valor mensal de cada uma). */
  essenciais: number;
  orcamentos: number;
  /** As contas que entram, para mostrar de onde vem o número. */
  itens: { label: string; amount: number }[];
}

export function fixedLivingCost(transactions: Transaction[], budgets: Budget[], today: Date): FixedCost {
  const itens = activeSeries(transactions, ["saida", "cartao"], today)
    .filter((s) => s.essencial && s.nextDate !== null)
    .map((s) => ({ label: s.label, amount: s.amount }))
    .sort((a, b) => b.amount - a.amount);
  const essenciais = itens.reduce((sum, i) => sum + i.amount, 0);
  const orcamentos = monthlyBudgetTotal(budgets);
  return { total: essenciais + orcamentos, essenciais, orcamentos, itens };
}

/** Meses de custo de vida que costumam ser recomendados para a reserva. */
export const RESERVE_MONTHS = 6;

/**
 * Em quantos meses a meta é atingida guardando `porMes`; null se não há meta,
 * já atingiu ou não está guardando nada.
 */
export function monthsToGoal(balance: VaultBalance, porMes: number): number | null {
  if (balance.falta === null || balance.falta <= 0 || porMes <= 0) return null;
  return Math.ceil(balance.falta / porMes);
}
