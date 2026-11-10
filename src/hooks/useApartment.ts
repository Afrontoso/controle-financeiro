"use client";

import { useCallback, useEffect, useState } from "react";
import { normalizePremises, type ApartmentPremises } from "@/lib/apartment";
import { toDateStr } from "@/lib/format";

/** Plano do apartamento do usuário: `null` enquanto não houver um cadastrado. */
export function useApartment() {
  const [plan, setPlan] = useState<ApartmentPremises | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/apartment");
        const data = res.ok ? await res.json() : null;
        if (!cancelled) setPlan(data ? normalizePremises(data) : null);
      } catch (error) {
        console.error("Erro ao carregar o plano do apartamento", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const savePlan = useCallback(async (premises: ApartmentPremises) => {
    const res = await fetch("/api/apartment", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(premises),
    });
    if (!res.ok) throw new Error("Falha ao salvar o plano");
    setPlan(normalizePremises(await res.json()));
  }, []);

  /** Refaz os lançamentos do plano de hoje em diante. Devolve quantos criou. */
  const syncTransactions = useCallback(async (): Promise<number> => {
    const res = await fetch("/api/apartment/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromDate: toDateStr(new Date()) }),
    });
    if (!res.ok) throw new Error("Falha ao gerar os lançamentos");
    const { created } = await res.json();
    return created as number;
  }, []);

  const deletePlan = useCallback(async () => {
    const res = await fetch("/api/apartment", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromDate: toDateStr(new Date()) }),
    });
    if (!res.ok) throw new Error("Falha ao excluir o plano");
    setPlan(null);
  }, []);

  return { plan, loading, savePlan, syncTransactions, deletePlan };
}
