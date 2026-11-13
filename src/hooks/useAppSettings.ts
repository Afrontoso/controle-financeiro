"use client";

import { useCallback, useState } from "react";
import type { ViewKey } from "@/components/shell/AppShell";

/** Preferências de tela. Ficam neste navegador, como o filtro de pessoa. */
export interface AppSettings {
  /** Tela e cards do apartamento. Sem escolha, aparece só para quem tem plano. */
  apartamento?: boolean;
  /** Ordem da barra lateral; telas fora da lista vão para o fim. */
  ordem?: ViewKey[];
}

const KEY = "config";

function load(): AppSettings {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as AppSettings;
    return {
      apartamento: typeof raw.apartamento === "boolean" ? raw.apartamento : undefined,
      ordem: Array.isArray(raw.ordem) ? raw.ordem.filter((k) => typeof k === "string") : undefined,
    };
  } catch {
    return {};
  }
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(load);

  const update = useCallback((changes: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...changes };
      window.localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { settings, update };
}
