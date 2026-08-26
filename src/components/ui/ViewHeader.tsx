"use client";

import { ChevronLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface ViewHeaderProps {
  title: string;
  /** Presente nas telas abertas a partir do menu, que precisam de volta. */
  onBack?: () => void;
  children?: React.ReactNode;
}

export function ViewHeader({ title, onBack, children }: ViewHeaderProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border-base bg-surface px-4 py-3 md:px-6 md:py-4">
      <div className="flex min-w-0 flex-1 items-center gap-1.5 md:flex-none">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar"
            className="-ml-2 grid size-9 shrink-0 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <h1 className="truncate text-xl font-semibold lowercase tracking-tight md:text-2xl">
          {title}
        </h1>

        {/* No celular o seletor de período ocupa a linha inteira embaixo, então
            o tema fica aqui em cima, ao lado do título. */}
        <ThemeToggle className="-mr-2 ml-auto md:hidden" />
      </div>

      <div className="flex items-center gap-2">
        {children}
        <ThemeToggle className="hidden md:grid" />
      </div>
    </header>
  );
}
