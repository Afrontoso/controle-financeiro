"use client";

import { useEffect, useRef } from "react";
import { formatCurrency, heatTone } from "@/lib/format";
import type { DayEntry, MonthEntry } from "@/lib/ledger";
import { TX_TYPE_META, TX_TYPE_ORDER, type TxType } from "@/lib/types";
import { TypeBadge } from "@/components/ui/TypeBadge";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface BalancesViewProps {
  months: MonthEntry[];
  /** No mobile só cabe uma coluna de tipo por vez. */
  mobileType: TxType;
  onMobileTypeChange: (type: TxType) => void;
  onSelectDay: (dateStr: string) => void;
  /** Incrementado quando o usuário pede "ir pra hoje". */
  scrollToTodayToken: number;
}

/** Valor exibido na célula — "diários" tem regra própria (projeção). */
function cellValue(day: DayEntry, type: TxType): number {
  return type === "gasto_diario" ? day.diario : day.totals[type];
}

function columnTotal(month: MonthEntry, type: TxType): number {
  return type === "gasto_diario"
    ? month.days.reduce((sum, d) => sum + d.diario, 0)
    : month.totals[type];
}

export function BalancesView({
  months,
  mobileType,
  onMobileTypeChange,
  onSelectDay,
  scrollToTodayToken,
}: BalancesViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLTableRowElement>(null);
  const currentMonthRef = useRef<HTMLElement>(null);

  // Cinco colunas de valor só cabem no desktop; no celular mostramos a escolhida.
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const columns = isDesktop ? TX_TYPE_ORDER : [mobileType];

  // Abre já posicionado no mês corrente, e reposiciona a cada "ir pra hoje".
  useEffect(() => {
    const container = scrollRef.current;
    const monthNode = currentMonthRef.current;
    if (!container || !monthNode) return;

    const behavior = scrollToTodayToken === 0 ? "auto" : "smooth";
    // offsetLeft é relativo ao offsetParent, que aqui não é o container de
    // scroll — medir pelos rects evita somar a largura da sidebar.
    const delta =
      monthNode.getBoundingClientRect().left - container.getBoundingClientRect().left - 16;
    container.scrollBy({ left: delta, behavior });
    todayRef.current?.scrollIntoView({ block: "center", inline: "nearest", behavior });
  }, [scrollToTodayToken, months]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TypeChips value={mobileType} onChange={onMobileTypeChange} />

      {/* O container rola só na horizontal; cada mês rola na vertical por dentro,
          o que mantém o cabeçalho e o rodapé de totais fixos no cartão. */}
      <div
        ref={scrollRef}
        className="scrollbar-thin flex min-h-0 flex-1 snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden p-3 md:gap-6 md:p-6"
      >
        {months.map((month) => (
          <MonthTable
            key={month.key}
            ref={month.isCurrent ? currentMonthRef : undefined}
            todayRowRef={todayRef}
            month={month}
            columns={columns}
            onSelectDay={onSelectDay}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TypeChips({
  value,
  onChange,
}: {
  value: TxType;
  onChange: (type: TxType) => void;
}) {
  return (
    <div className="scrollbar-none flex shrink-0 gap-2 overflow-x-auto border-b border-border-base bg-surface px-3 py-2 md:hidden">
      {TX_TYPE_ORDER.map((type) => {
        const meta = TX_TYPE_META[type];
        const active = value === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium lowercase transition-colors"
            style={{
              borderColor: active ? meta.color : "var(--border)",
              background: active ? meta.softColor : "transparent",
              color: active ? meta.color : "var(--fg-muted)",
            }}
          >
            <TypeBadge type={type} size={14} muted={!active} />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */

interface MonthTableProps {
  month: MonthEntry;
  /** Colunas de valor a renderizar — varia entre mobile e desktop. */
  columns: TxType[];
  onSelectDay: (dateStr: string) => void;
  ref?: React.Ref<HTMLElement>;
  todayRowRef: React.Ref<HTMLTableRowElement>;
}

function MonthTable({ month, columns, onSelectDay, ref, todayRowRef }: MonthTableProps) {
  // Com uma coluna só (mobile) o selo fica colado ao valor em vez de solto na ponta.
  const cellLayout =
    columns.length === 1 ? "justify-end gap-2" : "justify-between gap-1";

  return (
    <section
      ref={ref}
      className="scrollbar-thin w-full shrink-0 snap-start overflow-y-auto rounded-2xl border border-border-base bg-surface shadow-e1 md:w-[54rem] 2xl:w-[58rem]"
    >
      {/* border-separate (e não collapse): com collapse o Chrome não pinta o fundo
          das linhas fixas, e o conteúdo rolando vaza na faixa da borda. */}
      <table className="w-full table-fixed border-separate border-spacing-0">
        <colgroup>
          <col className="w-11 md:w-14" />
          {columns.map((type) => (
            <col key={type} />
          ))}
          <col className="w-28 md:w-36" />
        </colgroup>

        {/* O fundo vai também no thead: com border-collapse a faixa da borda não
            é pintada pelas células e o conteúdo rolando aparece por baixo. */}
        <thead className="sticky top-0 z-10 bg-surface">
          <tr>
            <th
              colSpan={columns.length + 2}
              className="border-b border-border-base bg-surface px-4 py-3 text-left text-base font-semibold lowercase"
            >
              {month.longLabel}
            </th>
          </tr>
          <tr className="text-[11px] font-medium tracking-wide text-fg-muted lowercase">
            <th className="border-b border-border-base bg-surface-2 px-2 py-2.5 text-center font-medium">dia</th>
            {columns.map((type) => (
              <th
                key={type}
                className="border-b border-border-base bg-surface-2 px-1.5 py-2.5 font-medium"
              >
                <span className={`flex items-center ${cellLayout}`}>
                  <TypeBadge type={type} size={16} />
                  <span className="truncate">{TX_TYPE_META[type].label}</span>
                </span>
              </th>
            ))}
            <th className="border-b border-border-base bg-surface-2 px-3 py-2.5 text-right font-medium">
              saldos
            </th>
          </tr>
        </thead>

        <tbody>
          {month.days.map((day) => (
            <tr
              key={day.dateStr}
              ref={day.isToday ? todayRowRef : undefined}
              onClick={() => onSelectDay(day.dateStr)}
              className="group cursor-pointer hover:bg-surface-2 [&:last-child>td]:border-b-0"
            >
              <td className="border-b border-border-base/60 p-0 text-center align-middle">
                <span
                  className={`grid h-9 place-items-center text-[13px] tabular ${
                    day.isToday
                      ? "bg-brand font-bold text-brand-fg"
                      : day.isPast
                        ? "bg-surface-3/60 text-fg-subtle"
                        : "text-fg-muted"
                  }`}
                >
                  {day.day}
                </span>
              </td>

              {columns.map((type) => {
                const value = cellValue(day, type);
                const zero = value === 0;
                return (
                  <td key={type} className="border-b border-border-base/60 px-1.5 py-2">
                    <span className={`flex items-center ${cellLayout}`}>
                      <TypeBadge type={type} size={16} muted={zero} />
                      <span
                        className={`truncate text-xs tabular md:text-[13px] ${
                          zero ? "text-fg-subtle/60" : "font-medium"
                        }`}
                        style={zero ? undefined : { color: TX_TYPE_META[type].color }}
                      >
                        {formatCurrency(value)}
                      </span>
                    </span>
                  </td>
                );
              })}

              <td className="border-b border-border-base/60 p-0">
                <span
                  className="flex h-9 items-center justify-end px-3 text-[13px] font-semibold tabular"
                  style={{
                    background: heatTone(day.saldo).bg,
                    color: heatTone(day.saldo).fg,
                  }}
                >
                  {formatCurrency(day.saldo)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>

        <tfoot className="sticky bottom-0 bg-surface-2">
          <tr className="text-[13px] font-semibold">
            <td className="border-t border-border-base bg-surface-2 px-2 py-2.5" />
            {columns.map((type) => (
              <td key={type} className="border-t border-border-base bg-surface-2 px-1.5 py-2.5">
                <span className={`flex items-center ${cellLayout}`}>
                  <TypeBadge type={type} size={16} />
                  <span
                    className="truncate text-xs tabular md:text-[13px]"
                    style={{ color: TX_TYPE_META[type].color }}
                  >
                    {formatCurrency(columnTotal(month, type))}
                  </span>
                </span>
              </td>
            ))}
            <td className="border-t border-border-base bg-surface-2 px-3 py-2.5 text-right text-fg-subtle">
              <span className="text-[11px] font-medium lowercase">totais do mês</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
