"use client";

import { ChevronLeft } from "lucide-react";

interface ViewHeaderProps {
  title: string;
  /** Presente nas telas abertas a partir do menu, que precisam de volta. */
  onBack?: () => void;
  children?: React.ReactNode;
}

export function ViewHeader({ title, onBack, children }: ViewHeaderProps) {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border-base bg-surface px-4 py-3 md:px-6 md:py-4">
      <div className="flex min-w-0 items-center gap-1.5">
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
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}
