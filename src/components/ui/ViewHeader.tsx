"use client";

import { ChevronLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import type { PersonFilter } from "@/lib/types";

interface ViewHeaderProps {
  title: string;
  /** Presente nas telas abertas a partir do menu, que precisam de volta. */
  onBack?: () => void;
  children?: React.ReactNode;
  /** De quem o app está mostrando; sem isso o seletor não aparece. */
  person?: PersonFilter;
  onPersonChange?: (person: PersonFilter) => void;
}

const PEOPLE: { key: PersonFilter; label: string }[] = [
  { key: "todos", label: "todos" },
  { key: "eu", label: "eu" },
  { key: "esposa", label: "esposa" },
];

export function ViewHeader({ title, onBack, children, person, onPersonChange }: ViewHeaderProps) {
  const switcher = person && onPersonChange && (
    <div
      role="group"
      aria-label="Mostrar lançamentos de quem"
      className="flex shrink-0 gap-0.5 rounded-full bg-surface-3 p-0.5 text-xs lowercase"
    >
      {PEOPLE.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => onPersonChange(p.key)}
          aria-pressed={person === p.key}
          className={`rounded-full px-2.5 py-1 font-medium transition-colors ${
            person === p.key ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border-base bg-surface px-4 py-3 md:px-6 md:py-4">
      <div className="flex min-w-0 basis-full items-center gap-1.5 md:basis-auto md:flex-none">
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
        <div className="ml-auto flex items-center gap-1 md:hidden">
          {switcher}
          <ThemeToggle className="-mr-2" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {children}
        <div className="hidden md:block">{switcher}</div>
        <ThemeToggle className="hidden md:grid" />
      </div>
    </header>
  );
}
