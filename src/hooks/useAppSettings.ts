"use client";

import { useCallback, useEffect, useState } from "react";
import type { ViewKey } from "@/components/shell/AppShell";

/** Preferências de tela, salvas na conta (valem em qualquer aparelho). */
export interface AppSettings {
  /** Tela e cards do apartamento. Sem escolha, aparece só para quem tem plano. */
  apartamento?: boolean;
  /** Ordem da barra lateral; telas fora da lista vão para o fim. */
  ordem?: ViewKey[];
}

/** Cópia local só para a primeira pintura não piscar; quem manda é a conta. */
const CACHE_KEY = "config";

function readCache(): AppSettings {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "{}") as AppSettings;
  } catch {
    return {};
  }
}

function writeCache(settings: AppSettings) {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
}

function save(settings: AppSettings) {
  return fetch("/api/account/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
}

function isEmpty(settings: AppSettings) {
  return settings.apartamento === undefined && !settings.ordem;
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(readCache);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/settings")
      .then((res) => (res.ok ? (res.json() as Promise<AppSettings>) : null))
      .then((remote) => {
        if (cancelled || !remote) return;
        const local = readCache();
        // Primeira vez com a conta: o que já estava escolhido neste navegador sobe.
        if (isEmpty(remote) && !isEmpty(local)) {
          void save(local);
          return;
        }
        writeCache(remote);
        setSettings(remote);
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(
    (changes: Partial<AppSettings>) => {
      const next = { ...settings, ...changes };
      setSettings(next);
      writeCache(next);
      save(next).catch((error) => console.error(error));
    },
    [settings],
  );

  return { settings, update };
}
