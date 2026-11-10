"use client";

import { useCallback, useEffect, useState } from "react";
import type { BankSnapshotData, BankTx } from "@/lib/openFinance";

export interface ResolveAction {
  id: string;
  action: "import" | "link" | "ignore" | "restore";
  type?: string;
  description?: string;
  amount?: number;
  date?: string;
  cardId?: string | null;
  vaultId?: string | null;
  transactionId?: string;
}

export interface SyncSummary {
  novas: number;
  naCaixa: number;
  ignoradas: number;
  atualizadas: number;
  primeiraVez: boolean;
}

interface OpenFinanceResponse {
  enabled: boolean;
  syncedAt?: string | null;
  snapshot?: BankSnapshotData | null;
  pending?: BankTx[];
  ignored?: BankTx[];
  linkedTransactionIds?: string[];
}

async function fetchOpenFinance(): Promise<OpenFinanceResponse | null> {
  const res = await fetch("/api/open-finance");
  return res.ok ? ((await res.json()) as OpenFinanceResponse) : null;
}

/**
 * Open Finance do usuário. `enabled` fica false para quem não é o dono das
 * credenciais do Meu Pluggy (o app é público; os bancos são de um CPF só).
 */
export function useOpenFinance() {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<BankSnapshotData | null>(null);
  const [pending, setPending] = useState<BankTx[]>([]);
  const [ignored, setIgnored] = useState<BankTx[]>([]);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);

  const apply = useCallback((data: OpenFinanceResponse) => {
    setEnabled(Boolean(data.enabled));
    if (data.enabled) {
      setSyncedAt(data.syncedAt ?? null);
      setSnapshot(data.snapshot ?? null);
      setPending(data.pending ?? []);
      setIgnored(data.ignored ?? []);
      setLinkedIds(data.linkedTransactionIds ?? []);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await fetchOpenFinance();
      if (data) apply(data);
    } catch (error) {
      console.error("Erro ao carregar o Open Finance", error);
    }
  }, [apply]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchOpenFinance();
        if (!cancelled && data) apply(data);
      } catch (error) {
        console.error("Erro ao carregar o Open Finance", error);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const sync = useCallback(async (): Promise<SyncSummary> => {
    setSyncing(true);
    try {
      const res = await fetch("/api/open-finance/sync", { method: "POST" });
      if (!res.ok) throw new Error("Falha ao sincronizar");
      const summary = (await res.json()) as SyncSummary;
      await load();
      return summary;
    } finally {
      setSyncing(false);
    }
  }, [load]);

  /** Aplica decisões da caixa de entrada; tira da lista na hora e recarrega depois. */
  const resolve = useCallback(
    async (actions: ResolveAction[]) => {
      const ids = new Set(actions.map((a) => a.id));
      setPending((list) => list.filter((t) => !ids.has(t.id) || actions.find((a) => a.id === t.id)?.action === "restore"));
      const res = await fetch("/api/open-finance/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actions }),
      });
      await load();
      if (!res.ok) throw new Error("Falha ao aplicar");
      const { failed } = (await res.json()) as { failed: string[] };
      return { failed };
    },
    [load],
  );

  return { enabled, loaded, syncedAt, snapshot, pending, ignored, linkedIds, syncing, sync, resolve, reload: load };
}
