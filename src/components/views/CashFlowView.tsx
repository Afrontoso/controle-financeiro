"use client";

import { useMemo, useState } from "react";
import { formatDayMonth, fromDateStr } from "@/lib/format";
import type { DayEntry, YearMonth } from "@/lib/ledger";
import { flowMovements, incomeByMonth, outflowsByPayee } from "@/lib/insights";
import { Brl } from "@/components/ui/Brl";
import { BarChart, LineChart, RankRow, Stat, Tile } from "@/components/ui/Dashboard";
import type { Card, Transaction } from "@/lib/types";

/** Quantos movimentos aparecem antes do "ver mais". */
const FIRST_MOVES = 8;
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

interface CashFlowViewProps {
  /** Hoje e os dias seguintes da previsão. */
  days: DayEntry[];
  transactions: Transaction[];
  cards: Card[];
  /** Cota diária dos orçamentos. */
  dailyQuota: number;
  today: Date;
  onSelectDay: (dateStr: string) => void;
}

export function CashFlowView({ days, transactions, cards, dailyQuota, today, onSelectDay }: CashFlowViewProps) {
  const [showAll, setShowAll] = useState(false);
  const moves = useMemo(() => flowMovements(days.slice(1), cards), [days, cards]);
  const payees = useMemo(() => outflowsByPayee(transactions, today, 30), [transactions, today]);
  const income = useMemo(() => {
    const from: YearMonth = { year: today.getFullYear(), month: today.getMonth() - 5 };
    return incomeByMonth(transactions, from, 7);
  }, [transactions, today]);

  if (days.length === 0) return null;
  const hoje = days[0];
  const lowest = days.reduce((a, b) => (b.saldo < a.saldo ? b : a));
  const last = days[days.length - 1];
  const cabeGuardar = Math.max(lowest.saldo, 0);
  const visible = showAll ? moves : moves.slice(0, FIRST_MOVES);
  const incomeWithValue = income.filter((m) => m.total > 0);
  const mediaRenda = incomeWithValue.length > 0 ? incomeWithValue.reduce((s, m) => s + m.total, 0) / incomeWithValue.length : 0;
  const totalSaidas = payees.reduce((s, p) => s + p.total, 0);

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
        <Tile
          title="previsão do saldo"
          subtitle={`conta nos próximos ${days.length - 1} dias`}
          info="o saldo projetado dia a dia, com tudo o que está lançado, as faturas no vencimento e a cota dos orçamentos. 'cabe guardar' é quanto dá para tirar hoje sem a conta ficar negativa em nenhum dia do período."
          illustration="chart_increasing"
          className="lg:col-span-2"
        >
          <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat
              label="saldo hoje"
              value={<Brl value={hoje.saldo} />}
              color={hoje.saldo < 0 ? "var(--saida)" : undefined}
              onClick={() => onSelectDay(hoje.dateStr)}
            />
            <Stat
              label="ponto mais baixo"
              value={<Brl value={lowest.saldo} />}
              hint={`em ${formatDayMonth(lowest.dateStr)}`}
              color={lowest.saldo < 0 ? "var(--saida)" : undefined}
              onClick={() => onSelectDay(lowest.dateStr)}
            />
            <Stat
              label="cabe guardar"
              value={<Brl value={cabeGuardar} />}
              hint={cabeGuardar > 0 ? `sem negativar até ${formatDayMonth(last.dateStr)}` : "a conta já aperta no período"}
              color={cabeGuardar > 0 ? "var(--entrada)" : "var(--saida)"}
            />
            <Stat label="dia a dia" value={<Brl value={dailyQuota} />} hint="por dia, pela cota dos orçamentos" />
          </div>

          <LineChart
            values={days.map((d) => d.saldo)}
            labels={days.map((d) => d.dateStr)}
            onSelect={onSelectDay}
            ariaLabel={`Saldo previsto nos próximos ${days.length - 1} dias`}
            heightClass="h-40 md:h-52"
          />

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">próximos movimentos</p>
          <ul className="mt-1 flex flex-col divide-y divide-border-base">
            {visible.map((m) => {
              const d = fromDateStr(m.dateStr);
              return (
                <li key={m.key}>
                  <button
                    type="button"
                    onClick={() => onSelectDay(m.dateStr)}
                    className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-surface-2"
                  >
                    <span className="w-9 shrink-0 text-center leading-tight">
                      <span className="block text-sm font-bold tabular">{d.getDate()}</span>
                      <span className="block text-[10px] lowercase text-fg-subtle">{WEEKDAYS[d.getDay()]}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium lowercase">{m.label}</span>
                      <span className="block text-[11px] lowercase text-fg-subtle">
                        {m.count > 1 && `${m.count} compras · `}saldo depois: <Brl value={m.saldoDepois} />
                      </span>
                    </span>
                    <span
                      className="shrink-0 text-sm font-semibold tabular"
                      style={{ color: m.amount > 0 ? "var(--entrada)" : undefined }}
                    >
                      {m.amount > 0 ? "+ " : "− "}
                      <Brl value={Math.abs(m.amount)} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {moves.length === 0 && (
            <p className="mt-2 text-sm lowercase text-fg-subtle">nada lançado para os próximos dias.</p>
          )}
          {moves.length > FIRST_MOVES && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mx-auto mt-3 text-xs font-medium lowercase text-fg-muted hover:text-fg"
            >
              {showAll ? "ver menos" : `ver mais ${moves.length - FIRST_MOVES}`}
            </button>
          )}
        </Tile>

        <Tile
          title="entradas"
          info="o que entrou em cada mês, sem contar dinheiro tirado de cofre. a linha tracejada é a média dos meses com entrada. o mês atual fica em destaque; o seguinte é o que já está lançado para ele."
          illustration="money_bag"
        >
          <p className="mt-0.5 text-xs lowercase text-fg-muted">
            média de <Brl value={mediaRenda} /> por mês
          </p>
          <BarChart bars={income.map((m) => ({ key: m.key, label: m.label.split("/")[0], value: m.total }))} highlight={5} />
          <dl className="mt-4 grid grid-cols-2 gap-2">
            <Stat label="fixas neste mês" value={<Brl value={income[5]?.fixa ?? 0} />} hint="salário, bolsa: o que se repete" />
            <Stat label="avulsas neste mês" value={<Brl value={income[5]?.avulsa ?? 0} />} hint="pix e transferências recebidas" />
          </dl>
        </Tile>

        <Tile
          title="saídas da conta"
          info="para onde foi o dinheiro nos últimos 30 dias, por destino: contas, pix, compras no débito e no cartão (pelo dia da compra)."
          illustration="bar_chart"
        >
          <p className="mt-0.5 text-xs lowercase text-fg-muted">
            <Brl value={totalSaidas} /> em 30 dias · os {payees.length} maiores destinos
          </p>
          <ul className="mt-4 flex flex-col">
            {payees.map((p) => (
              <RankRow
                key={p.key}
                label={p.label}
                value={p.total}
                max={payees[0]?.total ?? 1}
                hint={p.count > 1 ? `${p.count}×` : undefined}
              />
            ))}
          </ul>
          {payees.length === 0 && <p className="mt-4 text-sm lowercase text-fg-subtle">nenhuma saída nos últimos 30 dias.</p>}
        </Tile>
      </div>
    </div>
  );
}
