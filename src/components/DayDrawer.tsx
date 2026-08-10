"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { dayShortLabel, formatCurrency, formatDayMonth } from "@/lib/format";
import { TX_TYPE_META, TX_TYPE_ORDER, type Transaction, type TxType } from "@/lib/types";
import { TypeBadge } from "@/components/ui/TypeBadge";

/** Exportado porque quem abre o drawer decide o filtro inicial. */
export type DayFilter = TxType | "todos";

interface DayDrawerProps {
  dateStr: string;
  transactions: Transaction[];
  /** Controlado de fora: clicar numa coluna da tabela já abre filtrado nela. */
  filter: DayFilter;
  onFilterChange: (filter: DayFilter) => void;
  onClose: () => void;
  onStepDay: (delta: number) => void;
  onAdd: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

export function DayDrawer({
  dateStr,
  transactions,
  filter,
  onFilterChange,
  onClose,
  onStepDay,
  onAdd,
  onEdit,
  onDelete,
}: DayDrawerProps) {

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onStepDay(-1);
      if (e.key === "ArrowRight") onStepDay(1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onStepDay]);

  const visible =
    filter === "todos" ? transactions : transactions.filter((tx) => tx.type === filter);

  // Sem filtro o rodapé mostra o saldo líquido do dia; filtrado, o total daquele
  // tipo — somar entrada e saída faria o número não bater com a lista visível.
  const total =
    filter === "todos"
      ? visible.reduce((sum, tx) => sum + (tx.type === "entrada" ? tx.amount : -tx.amount), 0)
      : visible.reduce((sum, tx) => sum + tx.amount, 0);

  const totalColor =
    filter === "todos"
      ? total >= 0
        ? "var(--entrada)"
        : "var(--saida)"
      : TX_TYPE_META[filter].color;

  return (
    <>
      <div
        className="animate-fade-in fixed inset-0 z-[130]"
        style={{ background: "var(--overlay)" }}
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Lançamentos de ${dayShortLabel(dateStr)}`}
        className="animate-slide-up fixed inset-x-0 bottom-0 z-[140] flex max-h-[85dvh] flex-col rounded-t-3xl border border-border-base bg-surface shadow-e3 md:animate-slide-in-right md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[26rem] md:rounded-none md:border-y-0 md:border-r-0"
      >
        <header className="flex shrink-0 items-center justify-between gap-2 px-3 py-3 md:px-4 md:py-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-9 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onStepDay(-1)}
              aria-label="Dia anterior"
              className="grid size-8 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-20 text-center text-lg font-semibold lowercase tabular">
              {dayShortLabel(dateStr)}
            </span>
            <button
              type="button"
              onClick={() => onStepDay(1)}
              aria-label="Próximo dia"
              className="grid size-8 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <button
            type="button"
            onClick={onAdd}
            aria-label="Adicionar lançamento neste dia"
            className="grid size-9 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
          >
            <Plus size={22} />
          </button>
        </header>

        <div className="shrink-0 px-3 pb-3 md:px-4">
          <FilterSelect value={filter} onChange={onFilterChange} />
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="px-6 py-16 text-center text-sm text-fg-subtle">
              nenhum lançamento {filter === "todos" ? "neste dia" : `de ${TX_TYPE_META[filter].label}`}.
            </p>
          ) : (
            <ul>
              {visible.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  onEdit={() => onEdit(tx)}
                  onDelete={() => onDelete(tx)}
                />
              ))}
            </ul>
          )}
        </div>

        {visible.length > 0 && (
          <footer
            className="flex shrink-0 items-center justify-between border-t border-border-base px-5 py-3.5 text-sm"
            style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
          >
            <span className="lowercase text-fg-muted">
              {filter === "todos" ? "saldo do dia" : `total de ${TX_TYPE_META[filter].label}`}
            </span>
            <span className="font-semibold tabular" style={{ color: totalColor }}>
              {formatCurrency(total)}
            </span>
          </footer>
        )}
      </aside>
    </>
  );
}

/* ------------------------------------------------------------------ */

function FilterSelect({
  value,
  onChange,
}: {
  value: DayFilter;
  onChange: (value: DayFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const timer = setTimeout(() => document.addEventListener("pointerdown", onPointerDown), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-full border border-border-base px-4 py-2.5 text-sm transition-colors hover:bg-surface-2"
      >
        {value === "todos" ? (
          <span className="size-4 shrink-0 rounded-full border-2 border-fg-subtle" />
        ) : (
          <TypeBadge type={value} size={18} />
        )}
        <span className="flex-1 text-left lowercase">
          {value === "todos" ? "todos os tipos" : TX_TYPE_META[value].label}
        </span>
        <ChevronDown size={16} className={`text-fg-subtle transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="animate-pop-in absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-2xl border border-border-base bg-surface p-1.5 shadow-e3">
          <FilterOption
            active={value === "todos"}
            onClick={() => {
              onChange("todos");
              setOpen(false);
            }}
          >
            <span className="size-4 shrink-0 rounded-full border-2 border-fg-subtle" />
            todos os tipos
          </FilterOption>
          {TX_TYPE_ORDER.map((type) => (
            <FilterOption
              key={type}
              active={value === type}
              onClick={() => {
                onChange(type);
                setOpen(false);
              }}
            >
              <TypeBadge type={type} size={18} />
              {TX_TYPE_META[type].label}
            </FilterOption>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterOption({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm lowercase transition-colors ${
        active ? "bg-surface-3 font-medium" : "hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */

function TransactionRow({
  tx,
  onEdit,
  onDelete,
}: {
  tx: Transaction;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const meta = TX_TYPE_META[tx.type];

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const timer = setTimeout(() => document.addEventListener("pointerdown", onPointerDown), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  return (
    <li
      ref={ref}
      className="relative border-b border-border-base px-5 py-4 transition-colors last:border-0 hover:bg-surface-2"
    >
      <div className="flex items-center gap-3">
        <TypeBadge type={tx.type} size={20} />
        <span className="min-w-0 flex-1 truncate font-medium lowercase">{tx.description}</span>
        <span className="shrink-0 font-semibold tabular" style={{ color: meta.color }}>
          {formatCurrency(tx.amount)}
        </span>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Ações do lançamento"
          className="-mr-2 grid size-8 shrink-0 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg"
        >
          <MoreVertical size={16} />
        </button>
      </div>

      <div className="mt-1 flex items-center justify-between pl-8 text-xs text-fg-subtle">
        <span className="tabular">{formatDayMonth(tx.date)}</span>
        <span className="lowercase">
          {meta.singular}
          {tx.groupId && " · recorrente"}
        </span>
      </div>

      {menuOpen && (
        <div className="animate-pop-in absolute top-12 right-4 z-20 w-40 overflow-hidden rounded-xl border border-border-base bg-surface p-1.5 shadow-e3">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onEdit();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm lowercase transition-colors hover:bg-surface-2"
          >
            <Pencil size={15} /> editar
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onDelete();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm lowercase text-saida transition-colors hover:bg-saida-soft"
          >
            <Trash2 size={15} /> excluir
          </button>
        </div>
      )}
    </li>
  );
}
