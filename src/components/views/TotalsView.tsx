"use client";

import { formatCurrency, formatPercent } from "@/lib/format";
import type { AnnualSavings, MonthSummary } from "@/lib/ledger";
import { TX_TYPE_META, type Transaction } from "@/lib/types";
import { TypeBadge } from "@/components/ui/TypeBadge";

interface TotalsViewProps {
  summary: MonthSummary;
  annual: AnnualSavings;
  onSelectDay: (dateStr: string) => void;
}

export function TotalsView({ summary, annual, onSelectDay }: TotalsViewProps) {
  const {
    totals,
    totalGastos,
    performance,
    economiasPercent,
    diarioMedioOnly,
    diarioPrevisto,
    orcamentoMensal,
    sobraOrcamento,
    projecaoMes,
    gastoUsadoPercent,
    daysElapsed,
    daysInMonth,
    gastos,
  } = summary;

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="performance"
            value={formatCurrency(performance)}
            color={performance >= 0 ? "var(--entrada)" : "var(--saida)"}
            hint="entradas − gastos − economias"
            wide
          />
          <StatCard
            label="entradas"
            value={formatCurrency(totals.entrada)}
            color="var(--entrada)"
            hint={`${daysElapsed} de ${daysInMonth} dias decorridos`}
          />
          <StatCard
            label="custo de vida"
            value={formatCurrency(totalGastos)}
            color="var(--saida)"
            hint="saídas + cartão + diários"
          />
          <StatCard
            label="economias"
            value={formatCurrency(totals.investimento)}
            color="var(--economia)"
            hint={`${formatPercent(economiasPercent)} do que entrou`}
            progress={economiasPercent}
          />
          <StatCard
            label="diário médio"
            value={formatCurrency(diarioMedioOnly)}
            color="var(--diario)"
            hint={`previsto ${formatCurrency(diarioPrevisto)}/dia`}
          />
          <StatCard
            label="cartão"
            value={formatCurrency(totals.cartao)}
            color="var(--cartao)"
            hint="faturas lançadas no mês"
          />
          <StatCard
            label="saídas"
            value={formatCurrency(totals.saida)}
            color="var(--saida)"
            hint="contas e despesas avulsas"
          />
        </section>

        <section className="rounded-2xl border border-border-base bg-surface p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold lowercase">orçamento do mês</h2>
            <span className="text-sm text-fg-muted tabular">
              {formatCurrency(totals.gasto_diario)} de {formatCurrency(orcamentoMensal)}
            </span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                width: `${Math.min(gastoUsadoPercent, 100)}%`,
                background: gastoUsadoPercent > 100 ? "var(--saida)" : "var(--diario)",
              }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            <MiniStat
              label={sobraOrcamento >= 0 ? "ainda pode gastar" : "passou do orçamento"}
              value={formatCurrency(Math.abs(sobraOrcamento))}
              color={sobraOrcamento >= 0 ? "var(--entrada)" : "var(--saida)"}
            />
            <MiniStat
              label="projeção do mês"
              value={formatCurrency(projecaoMes)}
              color={projecaoMes <= orcamentoMensal ? "var(--entrada)" : "var(--saida)"}
            />
            <MiniStat
              label="uso do orçamento"
              value={formatPercent(gastoUsadoPercent)}
              color="var(--fg)"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-border-base bg-surface p-5">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold lowercase">economias em {annual.year}</h2>
            <span className="text-sm text-fg-muted tabular">
              {formatCurrency(annual.totalInvestido)} · {formatPercent(annual.totalPercent)}
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {annual.months
              .filter((m) => m.entradas > 0 || m.investido > 0)
              .map((m) => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="w-8 shrink-0 text-xs lowercase text-fg-muted">{m.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${Math.min(m.percent, 100)}%`,
                        background: "var(--economia)",
                      }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs tabular text-fg-muted">
                    {formatCurrency(m.investido)}
                  </span>
                  <span className="w-10 shrink-0 text-right text-xs font-semibold tabular">
                    {formatPercent(m.percent, 0)}
                  </span>
                </div>
              ))}

            {annual.months.every((m) => m.entradas === 0 && m.investido === 0) && (
              <p className="py-6 text-center text-sm text-fg-subtle lowercase">
                nenhum lançamento em {annual.year}.
              </p>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border-base bg-surface">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-base px-5 py-4">
            <h2 className="text-base font-semibold lowercase">gastos do mês</h2>
            <span className="text-sm tabular" style={{ color: "var(--saida)" }}>
              {formatCurrency(totalGastos)}
            </span>
          </div>

          {gastos.length === 0 ? (
            <p className="py-12 text-center text-sm lowercase text-fg-subtle">
              nenhum gasto neste mês.
            </p>
          ) : (
            <ul>
              {gastos.map((tx) => (
                <GastoRow key={tx.id} tx={tx} onClick={() => onSelectDay(tx.date)} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  color,
  hint,
  progress,
  wide,
}: {
  label: string;
  value: string;
  color: string;
  hint?: string;
  progress?: number;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-border-base bg-surface p-4 ${
        wide ? "col-span-2 lg:col-span-1" : ""
      }`}
    >
      <p className="text-xs font-medium lowercase text-fg-muted">{label}</p>
      <p className="mt-1.5 text-xl font-bold tabular md:text-2xl" style={{ color }}>
        {value}
      </p>
      {progress !== undefined && (
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${Math.min(progress, 100)}%`, background: color }}
          />
        </div>
      )}
      {hint && <p className="mt-2 text-[11px] text-fg-subtle">{hint}</p>}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <p className="text-[11px] lowercase text-fg-muted">{label}</p>
      <p className="mt-0.5 font-semibold tabular" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function GastoRow({ tx, onClick }: { tx: Transaction; onClick: () => void }) {
  const meta = TX_TYPE_META[tx.type];
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 border-b border-border-base px-5 py-3.5 text-left transition-colors last:border-0 hover:bg-surface-2"
      >
        <TypeBadge type={tx.type} size={20} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium lowercase">{tx.description}</span>
          <span className="block text-xs lowercase text-fg-subtle">
            {tx.date.split("-").reverse().join("/")} · {meta.singular}
          </span>
        </span>
        <span className="shrink-0 font-semibold tabular" style={{ color: meta.color }}>
          {formatCurrency(tx.amount)}
        </span>
      </button>
    </li>
  );
}
