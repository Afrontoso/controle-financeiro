"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { monthShortLabel } from "@/lib/format";
import { shiftMonth, type YearMonth } from "@/lib/ledger";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

interface PeriodPickerProps {
  start: YearMonth;
  /** Quantidade de meses da janela. */
  span: number;
  onChange: (start: YearMonth) => void;
}

export function PeriodPicker({ start, span, onChange }: PeriodPickerProps) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(start.year);
  const ref = useRef<HTMLDivElement>(null);

  const end = shiftMonth(start, span - 1);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const timer = setTimeout(() => document.addEventListener("pointerdown", onPointerDown), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-center gap-0.5">
      <NavButton label="Voltar 1 ano" onClick={() => onChange(shiftMonth(start, -span))}>
        <ChevronsLeft size={18} />
      </NavButton>
      <NavButton label="Voltar 1 mês" onClick={() => onChange(shiftMonth(start, -1))}>
        <ChevronLeft size={18} />
      </NavButton>

      <button
        type="button"
        onClick={() => {
          // A grade sempre abre no ano do mês inicial da janela.
          if (!open) setPickerYear(start.year);
          setOpen((o) => !o);
        }}
        className="mx-1 flex h-9 items-center gap-2 rounded-full border border-border-base px-3 text-sm font-medium transition-colors hover:bg-surface-2 md:px-4"
      >
        <span className="tabular whitespace-nowrap">
          {monthShortLabel(start.year, start.month)}
          {span > 1 && ` – ${monthShortLabel(end.year, end.month)}`}
        </span>
        <ChevronDown size={15} className={`text-fg-subtle transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <NavButton label="Avançar 1 mês" onClick={() => onChange(shiftMonth(start, 1))}>
        <ChevronRight size={18} />
      </NavButton>
      <NavButton label="Avançar 1 ano" onClick={() => onChange(shiftMonth(start, span))}>
        <ChevronsRight size={18} />
      </NavButton>

      {open && (
        <div className="animate-pop-in absolute top-full right-0 z-50 mt-2 w-64 rounded-2xl border border-border-base bg-surface p-3 shadow-e3">
          <div className="mb-2 flex items-center justify-between">
            <NavButton label="Ano anterior" onClick={() => setPickerYear((y) => y - 1)}>
              <ChevronLeft size={16} />
            </NavButton>
            <span className="text-sm font-semibold tabular">{pickerYear}</span>
            <NavButton label="Próximo ano" onClick={() => setPickerYear((y) => y + 1)}>
              <ChevronRight size={16} />
            </NavButton>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {MONTHS.map((label, month) => {
              const isStart = pickerYear === start.year && month === start.month;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    onChange({ year: pickerYear, month });
                    setOpen(false);
                  }}
                  className={`rounded-lg py-2 text-sm lowercase transition-colors ${
                    isStart
                      ? "bg-brand text-brand-fg"
                      : "text-fg-muted hover:bg-surface-3 hover:text-fg"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <p className="mt-3 border-t border-border-base pt-2 text-xs text-fg-subtle">
            janela de {span} meses a partir do mês escolhido
          </p>
        </div>
      )}
    </div>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-9 shrink-0 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
    >
      {children}
    </button>
  );
}
