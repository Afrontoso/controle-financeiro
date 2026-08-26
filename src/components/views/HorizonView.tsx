"use client";

import { useEffect, useRef } from "react";
import { formatCompact, formatCurrency, heatTone } from "@/lib/format";
import type { MonthEntry } from "@/lib/ledger";

interface HorizonViewProps {
  months: MonthEntry[];
  onSelectDay: (dateStr: string) => void;
  scrollToTodayToken: number;
}

/**
 * Visão panorâmica: um mês por coluna, cada dia colorido pela faixa do saldo
 * projetado. Serve para achar rapidamente quando o saldo vira negativo.
 */
export function HorizonView({ months, onSelectDay, scrollToTodayToken }: HorizonViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  const firstMonthKey = months[0]?.key;
  const lastToken = useRef(scrollToTodayToken);
  const mounted = useRef(false);

  // Mesma regra da tabela de saldos: salvar um lançamento não pode puxar a
  // rolagem de volta para o mês corrente.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const first = !mounted.current;
    const goToday = first || lastToken.current !== scrollToTodayToken;
    const behavior = first ? "auto" : "smooth";
    lastToken.current = scrollToTodayToken;
    mounted.current = true;

    if (!goToday) {
      container.scrollTo({ left: 0, behavior });
      return;
    }

    const node = currentRef.current;
    if (!node) return;
    // Mede por rects: offsetLeft aqui é relativo ao offsetParent, não ao container.
    const delta = node.getBoundingClientRect().left - container.getBoundingClientRect().left - 16;
    container.scrollBy({ left: delta, behavior });
  }, [scrollToTodayToken, firstMonthKey]);

  return (
    <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 overflow-auto p-3 md:p-6">
      <div className="flex w-fit min-w-full gap-2 md:gap-3">
        {months.map((month) => (
          <div
            key={month.key}
            ref={month.isCurrent ? currentRef : undefined}
            className="w-[8.5rem] shrink-0 md:w-44"
          >
            <div
              className={`sticky top-0 z-10 mb-1 rounded-xl px-3 py-2 text-center text-sm font-semibold lowercase ${
                month.isCurrent
                  ? "bg-brand text-brand-fg"
                  : "border border-border-base bg-surface text-fg-muted"
              }`}
            >
              {month.label}
            </div>

            <div className="overflow-hidden rounded-xl border border-border-base">
              {month.days.map((day) => {
                const tone = heatTone(day.saldo);
                return (
                  <button
                    key={day.dateStr}
                    type="button"
                    onClick={() => onSelectDay(day.dateStr)}
                    className="flex w-full items-center gap-1 border-b border-border-base/40 last:border-0"
                    title={`${day.day} · ${formatCurrency(day.saldo)}`}
                  >
                    <span
                      className={`grid w-7 shrink-0 place-items-center self-stretch py-1.5 text-[11px] tabular md:w-8 ${
                        day.isToday
                          ? "bg-brand font-bold text-brand-fg"
                          : "bg-surface-2 text-fg-subtle"
                      }`}
                    >
                      {day.day}
                    </span>
                    <span
                      className="flex-1 py-1.5 pr-2 text-right text-[11px] font-semibold tabular md:text-xs"
                      style={{ background: tone.bg, color: tone.fg }}
                    >
                      {formatCompact(day.saldo)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
