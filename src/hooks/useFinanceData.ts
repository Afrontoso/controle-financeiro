"use client";

import { useCallback, useEffect, useState } from "react";
import type { Budget, Card, Transaction, TxType, Vault } from "@/lib/types";
import { isTxType } from "@/lib/types";

interface RawTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type?: string | null;
  category?: string | null;
  groupId?: string | null;
  cardId?: string | null;
  vaultId?: string | null;
  source?: string | null;
}

/**
 * O banco guarda DateTime; a UI raciocina em dia local. Converter direto com
 * toISOString() jogaria lançamentos para o dia anterior em fusos negativos.
 */
function toLocalDateStr(value: string): string {
  const parsed = new Date(value);
  const local = new Date(parsed.getTime() + parsed.getTimezoneOffset() * 60000);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function normalizeTransaction(raw: RawTransaction): Transaction {
  const candidate = raw.type ?? raw.category;
  const type: TxType = isTxType(candidate)
    ? candidate
    : raw.amount > 0
      ? "entrada"
      : "saida";

  return {
    id: raw.id,
    date: toLocalDateStr(raw.date),
    description: raw.description,
    // O sinal vive no `type`; a UI trabalha sempre com o valor absoluto.
    amount: Math.abs(raw.amount),
    type,
    category: raw.category ?? undefined,
    groupId: raw.groupId ?? undefined,
    cardId: raw.cardId ?? undefined,
    vaultId: raw.vaultId ?? undefined,
    source: raw.source ?? undefined,
  };
}

async function loadTransactions(): Promise<Transaction[]> {
  try {
    const res = await fetch("/api/transactions");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.map(normalizeTransaction) : [];
  } catch (error) {
    console.error("Erro ao carregar transações", error);
    return [];
  }
}

async function loadBudgets(): Promise<Budget[]> {
  try {
    const res = await fetch("/api/budgets");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Erro ao carregar orçamentos", error);
    return [];
  }
}

async function loadCards(): Promise<Card[]> {
  try {
    const res = await fetch("/api/cards");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Erro ao carregar cartões", error);
    return [];
  }
}

async function loadVaults(): Promise<Vault[]> {
  try {
    const res = await fetch("/api/vaults");
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data)
      ? data.map((v) => ({
          id: v.id,
          name: v.name,
          goal: v.goal ?? null,
          goalMonths: v.goalMonths ?? null,
          initial: Number(v.initial) || 0,
          kind: v.kind === "reserva" ? "reserva" : "cofre",
        }))
      : [];
  } catch (error) {
    console.error("Erro ao carregar cofres", error);
    return [];
  }
}

export interface VaultPayload {
  id?: string | null;
  name: string;
  goal: number | null;
  goalMonths: number | null;
  initial: number;
  kind: Vault["kind"];
}

export interface TransactionPayload {
  date: string;
  type: TxType;
  amount: number;
  description: string;
  /** null limpa o cartão do lançamento; undefined mantém o que já estava. */
  cardId?: string | null;
  /** Cofre de uma economia (guardar) ou entrada (resgatar); null desvincula. */
  vaultId?: string | null;
  repeatFrequency?: "diario" | "semanal" | "mensal";
  repeatCount?: number;
  isIndeterminate?: boolean;
}

function buildBody(payload: TransactionPayload) {
  const signedAmount =
    payload.type === "entrada" ? Math.abs(payload.amount) : -Math.abs(payload.amount);

  return {
    description: payload.description,
    amount: signedAmount,
    // Meio-dia evita que o fuso empurre o lançamento para o dia vizinho.
    date: new Date(`${payload.date}T12:00:00`).toISOString(),
    type: payload.type,
    category: payload.type,
    // Fora do cartão o vínculo não faz sentido e é sempre desfeito.
    cardId: payload.type === "cartao" ? (payload.cardId ?? null) : null,
    vaultId:
      payload.type === "investimento" || payload.type === "entrada" ? (payload.vaultId ?? null) : null,
  };
}

export function useFinanceData() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [txs, bgs, cds, vts] = await Promise.all([
        loadTransactions(),
        loadBudgets(),
        loadCards(),
        loadVaults(),
      ]);
      if (cancelled) return;
      setTransactions(txs);
      setBudgets(bgs);
      setCards(cds);
      setVaults(vts);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshTransactions = useCallback(async () => {
    setTransactions(await loadTransactions());
  }, []);

  const refreshBudgets = useCallback(async () => {
    setBudgets(await loadBudgets());
  }, []);

  const refreshCards = useCallback(async () => {
    setCards(await loadCards());
  }, []);

  const createTransaction = useCallback(
    async (payload: TransactionPayload) => {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildBody(payload),
          repeatFrequency: payload.repeatFrequency,
          repeatCount: payload.repeatCount,
          isIndeterminate: payload.isIndeterminate ?? false,
        }),
      });
      if (!res.ok) throw new Error("Falha ao criar transação");
      await refreshTransactions();
    },
    [refreshTransactions],
  );

  const updateTransaction = useCallback(
    async (id: string, payload: TransactionPayload, updateAll: boolean) => {
      const res = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildBody(payload), updateAll }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar transação");
      await refreshTransactions();
    },
    [refreshTransactions],
  );

  const deleteTransaction = useCallback(
    async (id: string, deleteAll: boolean) => {
      const res = await fetch(`/api/transactions/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAll }),
      });
      if (!res.ok) throw new Error("Falha ao excluir transação");
      await refreshTransactions();
    },
    [refreshTransactions],
  );

  const saveBudget = useCallback(
    async (budget: { id?: string | null; name: string; amount: number; divideBy: number }) => {
      const body = { name: budget.name, amount: budget.amount, divideBy: budget.divideBy };
      const res = budget.id
        ? await fetch(`/api/budgets/${budget.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/budgets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      if (!res.ok) throw new Error("Falha ao salvar orçamento");
      await refreshBudgets();
    },
    [refreshBudgets],
  );

  const deleteBudget = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/budgets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir orçamento");
      await refreshBudgets();
    },
    [refreshBudgets],
  );

  const saveCard = useCallback(
    async (card: { id?: string | null; name: string; dueDay: number }) => {
      const body = { name: card.name, dueDay: card.dueDay };
      const res = card.id
        ? await fetch(`/api/cards/${card.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/cards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      if (!res.ok) throw new Error("Falha ao salvar cartão");
      await refreshCards();
      // Mudar o vencimento reposiciona as faturas já lançadas.
      await refreshTransactions();
    },
    [refreshCards, refreshTransactions],
  );

  const deleteCard = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/cards/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir cartão");
      await refreshCards();
      // Os lançamentos ficam sem cartão e voltam a sair no dia da compra.
      await refreshTransactions();
    },
    [refreshCards, refreshTransactions],
  );

  const refreshVaults = useCallback(async () => {
    setVaults(await loadVaults());
  }, []);

  const saveVault = useCallback(
    async (vault: VaultPayload) => {
      const body = {
        name: vault.name,
        goal: vault.goal,
        goalMonths: vault.goalMonths,
        initial: vault.initial,
        kind: vault.kind,
      };
      const res = await fetch(vault.id ? `/api/vaults/${vault.id}` : "/api/vaults", {
        method: vault.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Falha ao salvar cofre");
      await refreshVaults();
    },
    [refreshVaults],
  );

  const deleteVault = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/vaults/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir cofre");
      await refreshVaults();
      // Os lançamentos ficam, só perdem o vínculo com o cofre.
      await refreshTransactions();
    },
    [refreshVaults, refreshTransactions],
  );

  const resetAllData = useCallback(async () => {
    const res = await fetch("/api/account/data", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "zerar" }),
    });
    if (!res.ok) throw new Error("Falha ao zerar os dados");
    setTransactions([]);
    setBudgets([]);
    setCards([]);
    setVaults([]);
  }, []);

  return {
    transactions,
    budgets,
    cards,
    vaults,
    loading,
    refreshTransactions,
    saveVault,
    deleteVault,
    resetAllData,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    saveBudget,
    deleteBudget,
    saveCard,
    deleteCard,
  };
}
