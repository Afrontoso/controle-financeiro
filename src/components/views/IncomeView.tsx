"use client";

import { formatPercent, fromDateStr, monthLongLabel, toDateStr } from "@/lib/format";
import { incomeByMonth, incomeSources, isInstallment } from "@/lib/insights";
import { Brl } from "@/components/ui/Brl";
import { BarChart, BigMoney, Stat, Tile } from "@/components/ui/Dashboard";
import type { Transaction } from "@/lib/types";

const HISTORY_MONTHS = 12;

interface IncomeViewProps {
  transactions: Transaction[];
  today: Date;
  /** Renda que a Caixa considera no financiamento, se houver plano. */
  rendaBanco?: number | null;
}

interface EndingIncome {
  key: string;
  label: string;
  amount: number;
  lastDate: string;
  restantes: number;
}

/** Entradas parceladas ("bolsa (3/23)"): renda com data para acabar. */
function endingIncomes(transactions: Transaction[], today: Date): EndingIncome[] {
  const todayStr = toDateStr(today);
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (tx.type !== "entrada" || !tx.groupId || !isInstallment(tx)) continue;
    const list = groups.get(tx.groupId);
    if (list) list.push(tx);
    else groups.set(tx.groupId, [tx]);
  }
  const result: EndingIncome[] = [];
  for (const [key, list] of groups) {
    const last = list.reduce((a, b) => (b.date > a.date ? b : a));
    if (last.date < todayStr) continue;
    result.push({
      key,
      label: last.description.replace(/\s*\(\d+\/\d+\)\s*$/, ""),
      amount: last.amount,
      lastDate: last.date,
      restantes: list.filter((t) => t.date >= todayStr).length,
    });
  }
  return result.sort((a, b) => (a.lastDate < b.lastDate ? -1 : 1));
}

export function IncomeView({ transactions, today, rendaBanco }: IncomeViewProps) {
  const todayYm = { year: today.getFullYear(), month: today.getMonth() };
  // Contas baratas: sem memo, o compilador do React cuida do resto.
  const history = incomeByMonth(
    transactions,
    { year: today.getFullYear(), month: today.getMonth() - (HISTORY_MONTHS - 2) },
    HISTORY_MONTHS,
  );
  const sources = incomeSources(transactions, todayYm, today);
  const ending = endingIncomes(transactions, today);

  const current = history[HISTORY_MONTHS - 2];
  const past = history.slice(0, HISTORY_MONTHS - 1).filter((m) => m.total > 0);
  const mediaFixa = past.length > 0 ? past.reduce((s, m) => s + m.fixa, 0) / past.length : 0;
  const mediaAvulsa = past.length > 0 ? past.reduce((s, m) => s + m.avulsa, 0) / past.length : 0;
  const total = current?.total ?? 0;
  const mes = monthLongLabel(todayYm.year, todayYm.month).split(" ")[0];

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className="grid grid-cols-1 items-start gap-3 md:gap-4 lg:grid-cols-2">
        <Tile
          title={`renda de ${mes}`}
          subtitle="tudo o que entra no mês, sem resgate de cofre"
          info="as entradas do mês: as fixas (lançadas com repetição, como salário e bolsa) e as avulsas (pix e transferências que chegaram). dinheiro tirado de cofre não é renda e fica de fora."
          illustration="purse"
        >
          <div className="mt-6">
            <BigMoney value={total} size="lg" />
          </div>
          {total > 0 && (
            <div className="mt-4 flex h-2.5 w-full gap-1 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${((current?.fixa ?? 0) / total) * 100}%`, background: "var(--ov-navy)" }} />
              <div className="h-full rounded-full" style={{ width: `${((current?.avulsa ?? 0) / total) * 100}%`, background: "var(--ov-blue)" }} />
            </div>
          )}
          <ul className="mt-4 flex flex-col divide-y divide-border-base">
            {sources.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-start gap-2">
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full"
                    style={{ background: s.fixa ? "var(--ov-navy)" : "var(--ov-blue)" }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium lowercase">{s.label}</p>
                    <p className="text-[11px] lowercase text-fg-subtle">
                      {s.fixa ? "fixa" : "avulsa"} · {s.futura ? "cai" : "caiu"} dia {s.day}
                      {s.count > 1 && ` · ${s.count} vezes`}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular" style={{ color: s.futura ? "var(--fg-muted)" : undefined }}>
                  <Brl value={s.amount} />
                </span>
              </li>
            ))}
          </ul>
          {sources.length === 0 && <p className="mt-4 text-sm lowercase text-fg-subtle">nenhuma entrada neste mês.</p>}
        </Tile>

        <Tile
          title="histórico"
          subtitle={`últimos ${HISTORY_MONTHS - 1} meses e o próximo`}
          info="entradas de cada mês. a linha tracejada é a média dos meses com entrada; o mês atual fica em destaque. o próximo mês só tem o que já está lançado."
          illustration="bar_chart"
        >
          <BarChart
            bars={history.map((m) => ({ key: m.key, label: m.label.split("/")[0], value: m.total }))}
            highlight={HISTORY_MONTHS - 2}
          />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat label="média das fixas" value={<Brl value={mediaFixa} />} hint="por mês com entrada" />
            <Stat label="média das avulsas" value={<Brl value={mediaAvulsa} />} hint="varia mês a mês" />
          </div>
        </Tile>

        {(ending.length > 0 || rendaBanco) && (
          <Tile
            title="renda com data para acabar"
            info="entradas lançadas com número de parcelas, como a bolsa. quando acabarem, o orçamento precisa fechar sem elas. a renda que a caixa considera vem do plano do apartamento."
          >
            <ul className="mt-4 flex flex-col divide-y divide-border-base">
              {ending.map((e) => {
                const d = fromDateStr(e.lastDate);
                return (
                  <li key={e.key} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium lowercase">{e.label}</p>
                      <p className="text-[11px] lowercase text-fg-subtle">
                        última em {monthLongLabel(d.getFullYear(), d.getMonth())} · faltam {e.restantes}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular">
                      <Brl value={e.amount} />
                    </span>
                  </li>
                );
              })}
            </ul>
            {rendaBanco ? (
              <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2.5 text-xs lowercase text-fg-muted">
                a caixa considera <Brl value={rendaBanco} /> de renda
                {mediaFixa > 0 && <> ({formatPercent((rendaBanco / mediaFixa) * 100, 0)} da sua renda fixa média)</>}.
              </p>
            ) : null}
          </Tile>
        )}
      </div>
    </div>
  );
}
