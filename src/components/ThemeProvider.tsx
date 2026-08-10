"use client";

import { createContext, useCallback, useContext, useState } from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "cf-theme";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // O tema real já foi aplicado no <html> pelo script inline do layout, antes da
  // hidratação. Aqui só lemos de volta para manter o estado do React em sincronia.
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light",
  );

  // O efeito colateral fica fora do updater: o React pode reexecutar updaters
  // (StrictMode faz isso em dev), e alternar a classe duas vezes desfaz a troca.
  const toggleTheme = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Modo privado / storage bloqueado: o tema só não persiste entre sessões.
    }
    setTheme(next);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
  );
}
