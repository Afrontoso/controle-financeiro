"use client";

import { useCallback, useEffect, useState } from "react";
import type { Budget, Transaction, TxType } from "@/lib/types";
import { isTxType } from "@/lib/types";

interface RawTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type?: string | null;
  category?: string | null;
  groupId?: string | null;
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

export interface TransactionPayload {
  date: string;
  type: TxType;
  amount: number;
  description: string;
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
  };
}

export function useFinanceData() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [txs, bgs] = await Promise.all([loadTransactions(), loadBudgets()]);
      if (cancelled) return;
      setTransactions(txs);
      setBudgets(bgs);
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

  return {
    transactions,
    budgets,
    loading,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    saveBudget,
    deleteBudget,
  };
}
