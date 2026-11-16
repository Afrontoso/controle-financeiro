"use client";

import { useCallback, useEffect, useState } from "react";
import type { BankSnapshotData } from "@/lib/openFinance";

export interface SyncSummary {
  novas: number;
  movimentos: number;
  internas: number;
  atualizadas: number;
  primeiraVez: boolean;
}

interface OpenFinanceResponse {
  enabled: boolean;
  syncedAt?: string | null;
  snapshot?: BankSnapshotData | null;
}

async function fetchOpenFinance(): Promise<OpenFinanceResponse | null> {
  const res = await fetch("/api/open-finance");
  return res.ok ? ((await res.json()) as OpenFinanceResponse) : null;
}

/**
 * Open Finance do usuário, só leitura: o retrato das contas para a aba de open
 * finance. Nada daqui vira lançamento do app.
 *
 * `enabled` fica false para quem não é o dono das credenciais do Meu Pluggy (o
 * app é público; os bancos são de um CPF só).
 */
export function useOpenFinance() {
  const [enabled, setEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<BankSnapshotData | null>(null);
  const [syncing, setSyncing] = useState(false);

  const apply = useCallback((data: OpenFinanceResponse) => {
    setEnabled(Boolean(data.enabled));
    if (data.enabled) {
      setSyncedAt(data.syncedAt ?? null);
      setSnapshot(data.snapshot ?? null);
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

  return { enabled, loaded, syncedAt, snapshot, syncing, sync, reload: load };
}
