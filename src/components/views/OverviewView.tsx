"use client";

import { useMemo, useState } from "react";
import { Building2, Check, ChevronRight, CreditCard, Info, PiggyBank, TriangleAlert } from "lucide-react";
import { formatCurrency, formatDayMonth, formatPercent } from "@/lib/format";
import {
  buildSchedule,
  COMPONENTS,
  isPlanComplete,
  type ApartmentPremises,
  type Deadline,
} from "@/lib/apartment";
import {
  billsOfMonth,
  breakdownMonth,
  cardForecasts,
  cardLimitUsage,
  type BillItem,
  type CardLimitUsage,
  type BillDay,
  type CardForecast,
  type MonthBreakdown,
  type MonthEntry,
  type SavingsTotal,
} from "@/lib/ledger";
import type { Card, Transaction } from "@/lib/types";
import type { FixedCost, VaultBalance } from "@/lib/vaults";
import { Brl, KeepRs } from "@/components/ui/Brl";

/** Quantos dias à frente uma conta conta como "vence logo". */
const SOON_DAYS = 5;

/** Prazos do imóvel que aparecem no topo da visão geral. */
const DEADLINE_WINDOW_DAYS = 90;

interface OverviewViewProps {
  /** O mês em tela primeiro, seguido dos próximos (para projeção e faturas). */
  months: MonthEntry[];
  cards: Card[];
  /** Todos os lançamentos: para o limite usado dos cartões. */
  transactions: Transaction[];
  onTogglePaid: (ids: string[], paid: boolean) => void;
  savings: SavingsTotal;
  today: Date;
  /** Plano do apartamento, se houver: liga o card de moradia e os prazos. */
  plan?: ApartmentPremises | null;
  onSelectDay: (dateStr: string) => void;
  onOpenMonth: (year: number, month: number) => void;
  onOpenApartment: () => void;
  onOpenVaults: () => void;
  /** Saldo da reserva de emergência, se houver um cofre marcado como tal. */
  reserve: VaultBalance | null;
  fixedCost: FixedCost;
}

export function OverviewView({
  months,
  cards,
  transactions,
  onTogglePaid,
  savings,
  today,
  plan,
  onSelectDay,
  onOpenMonth,
  onOpenApartment,
  onOpenVaults,
  reserve,
  fixedCost,
}: OverviewViewProps) {
  const breakdowns = useMemo(() => months.map(breakdownMonth), [months]);
  const current = months[0];
  const summary = breakdowns[0];
  const bills = useMemo(() => (current ? billsOfMonth(current, cards) : []), [current, cards]);
  const forecasts = useMemo(() => cardForecasts(months.slice(0, 4), cards), [months, cards]);
  const usage = useMemo(() => cardLimitUsage(transactions, cards, today), [transactions, cards, today]);

  const hasPlan = Boolean(plan && isPlanComplete(plan));

  if (!current || !summary) return null;

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-3 md:gap-4 lg:grid-cols-3">
        {plan && <DeadlineBanner prazos={plan.prazos} today={today} onOpen={onOpenApartment} />}
        <SobraCard summary={summary} className="lg:col-span-2" />
        <ComprometidoCard summary={summary} />
        <BillsCard
          bills={bills}
          today={today}
          monthStatus={
            current.isCurrent
              ? "atual"
              : current.year * 12 + current.month < today.getFullYear() * 12 + today.getMonth()
                ? "passado"
                : "futuro"
          }
          onSelectDay={onSelectDay}
          onTogglePaid={onTogglePaid}
          className="lg:col-span-2 lg:row-span-2"
        />
        <CardsCard forecasts={forecasts} usage={usage} />
        <EconomiasCard
          summary={summary}
          savings={savings}
          reserve={reserve}
          fixedCost={fixedCost}
          onOpenVaults={onOpenVaults}
        />
        {hasPlan && plan && (
          <MoradiaCard plan={plan} summary={summary} onOpen={onOpenApartment} />
        )}
        <ProjecaoCard
          breakdowns={breakdowns}
          onOpenMonth={onOpenMonth}
          className={hasPlan ? "lg:col-span-2" : "lg:col-span-3"}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

const SEGMENTS = [
  { key: "contas", label: "contas", color: "var(--saida)" },
  { key: "cartao", label: "cartão", color: "var(--cartao)" },
  { key: "diarios", label: "diários", color: "var(--diario)" },
  { key: "economias", label: "economias", color: "var(--economia)" },
] as const;

function SobraCard({ summary, className }: { summary: MonthBreakdown; className?: string }) {
  const { entradas, sobra } = summary;
  const negativa = sobra < 0;
  // Se faltar dinheiro, a barra é medida pelo total gasto, e não pela renda.
  const base = Math.max(entradas, entradas - sobra, 1);

  return (
    <Panel
      title="sobra do mês"
      info="entradas do mês menos contas, faturas do cartão que vencem nele, gastos diários (o real até ontem e a cota dos orçamentos de hoje em diante) e economias. é quanto o saldo muda do dia 1 ao último dia."
      className={className}
    >
      <Money value={sobra} color={negativa ? "var(--saida)" : "var(--entrada)"} big />
      <p className="mt-0.5 text-xs lowercase text-fg-subtle">
        {negativa ? "faltam" : "sobram"}{" "}
        {entradas > 0 ? `${formatPercent((Math.abs(sobra) / entradas) * 100, 0)} das entradas` : "sem entradas no mês"}
        {" · "}saldo no fim do mês <Brl value={summary.saldoFinal} />
      </p>

      <div className="mt-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-surface-3">
        {SEGMENTS.map((seg) => {
          const value = summary[seg.key];
          if (value <= 0) return null;
          return (
            <div
              key={seg.key}
              className="h-full transition-[width] duration-700"
              style={{ width: `${(value / base) * 100}%`, background: seg.color }}
              title={`${seg.label}: ${formatCurrency(value)}`}
            />
          );
        })}
        {!negativa && sobra > 0 && (
          <div
            className="h-full"
            style={{ width: `${(sobra / base) * 100}%`, background: "var(--entrada)", opacity: 0.35 }}
            title={`sobra: ${formatCurrency(sobra)}`}
          />
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <Legend label="entradas" value={entradas} color="var(--entrada)" />
        {SEGMENTS.map((seg) => (
          <Legend
            key={seg.key}
            label={seg.label}
            value={summary[seg.key]}
            color={seg.color}
            percent={entradas > 0 ? (summary[seg.key] / entradas) * 100 : undefined}
          />
        ))}
      </dl>
    </Panel>
  );
}

function ComprometidoCard({ summary }: { summary: MonthBreakdown }) {
  const { entradas, contas, cartao } = summary;
  const comprometido = contas + cartao;
  const percent = entradas > 0 ? (comprometido / entradas) * 100 : 0;
  const tone = percent > 70 ? "var(--saida)" : percent > 50 ? "var(--diario)" : "var(--entrada)";

  return (
    <Panel
      title="comprometido"
      info="contas e faturas do mês em % das entradas. é o que já tem destino antes de você decidir qualquer coisa. acima de 50% começa a apertar; acima de 70% qualquer imprevisto vira dívida."
    >
      {entradas > 0 ? (
        <>
          <p className="text-2xl font-bold tabular md:text-3xl" style={{ color: tone }}>
            {formatPercent(percent, 0)}
          </p>
          <p className="mt-0.5 text-xs lowercase text-fg-subtle">
            <Brl value={comprometido} /> de <Brl value={entradas} />
          </p>
          <div className="relative mt-4 h-2.5 w-full rounded-full bg-surface-3">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${Math.min(percent, 100)}%`, background: tone }}
            />
            {/* Marcas de referência: 50% e 70%. */}
            {[50, 70].map((mark) => (
              <span
                key={mark}
                className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-fg"
                style={{ left: `${mark}%`, opacity: 0.5 }}
              />
            ))}
          </div>
          <p className="mt-2 flex justify-between text-[11px] text-fg-subtle tabular">
            <span>0%</span>
            <span>50% · 70%</span>
            <span>100%</span>
          </p>
        </>
      ) : (
        <Empty>sem entradas lançadas neste mês.</Empty>
      )}
    </Panel>
  );
}

type MonthStatus = "passado" | "atual" | "futuro";

function BillsCard({
  bills,
  today,
  monthStatus,
  onSelectDay,
  onTogglePaid,
  className,
}: {
  bills: BillDay[];
  today: Date;
  monthStatus: MonthStatus;
  onSelectDay: (dateStr: string) => void;
  onTogglePaid: (ids: string[], paid: boolean) => void;
  className?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  // Meses que já passaram contam como pagos: senão o histórico todo viraria "atrasado".
  const settled = (item: BillItem) => item.paid || monthStatus === "passado";
  const total = bills.reduce((sum, day) => sum + day.total, 0);
  const pendente = bills.reduce(
    (sum, day) => sum + day.items.filter((item) => !settled(item)).reduce((s, item) => s + item.amount, 0),
    0,
  );
  const vencidas = bills.filter((day) => monthStatus === "atual" && day.isPast && day.items.some((i) => !i.paid));
  const visible = showAll ? bills : bills.slice(0, 8);
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  return (
    <Panel
      title="contas do mês"
      info="saídas e faturas de cartão agrupadas pelo dia em que saem do saldo. toque no círculo para marcar como paga (a fatura do cartão é marcada inteira); isso é só um registro e não muda o saldo projetado. no mês atual, o que venceu e não foi marcado fica em vermelho. toque no dia para ver e editar os lançamentos."
      aside={
        <span className="text-sm tabular text-fg-muted">
          falta <Brl value={pendente} /> <span className="text-fg-subtle">de <Brl value={total} /></span>
        </span>
      }
      className={className}
    >
      {vencidas.length > 0 && (
        <p
          className="mb-2 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs lowercase"
          style={{ background: "var(--saida-soft)", color: "var(--saida)" }}
        >
          <TriangleAlert size={13} className="shrink-0" />
          {vencidas.length === 1 ? "1 dia com conta vencida" : `${vencidas.length} dias com contas vencidas`} e não
          marcada como paga. se já pagou, toque no círculo.
        </p>
      )}

      {bills.length === 0 ? (
        <Empty>nenhuma conta neste mês.</Empty>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {visible.map((day) => {
            const [y, m, d] = day.dateStr.split("-").map(Number);
            const daysAway = Math.round((new Date(y, m - 1, d).getTime() - todayMs) / 86_400_000);
            const allSettled = day.items.every(settled);
            const overdue = monthStatus === "atual" && day.isPast && !day.allPaid;
            const soon = !day.isPast && !allSettled && daysAway <= SOON_DAYS;

            const badgeStyle = allSettled
              ? { background: "var(--entrada-soft)", color: "var(--entrada)" }
              : overdue || soon
                ? { background: "var(--saida)", color: "white" }
                : { background: "var(--saida-soft)", color: "var(--saida)" };

            return (
              <li key={day.dateStr} className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-2">
                <button
                  type="button"
                  onClick={() => onSelectDay(day.dateStr)}
                  aria-label={`Abrir o dia ${day.day}`}
                  className="grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold tabular"
                  style={badgeStyle}
                >
                  {allSettled ? <Check size={16} /> : day.day}
                </button>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onSelectDay(day.dateStr)}
                    className="flex w-full items-baseline justify-between gap-2 text-left"
                  >
                    <span className="text-xs lowercase" style={{ color: overdue ? "var(--saida)" : "var(--fg-subtle)" }}>
                      {overdue
                        ? `dia ${day.day} · venceu`
                        : day.isToday
                          ? "hoje"
                          : day.isPast
                            ? `dia ${day.day}`
                            : daysAway === 1
                              ? "amanhã"
                              : soon
                                ? `em ${daysAway} dias`
                                : `dia ${day.day}`}
                    </span>
                    <span className={`shrink-0 text-sm font-semibold tabular ${allSettled ? "text-fg-subtle line-through" : ""}`}>
                      <Brl value={day.total} />
                    </span>
                  </button>

                  <ul className="mt-1 flex flex-col gap-0.5">
                    {day.items.map((item) => {
                      const done = settled(item);
                      return (
                        <li key={item.id} className="flex min-w-0 items-center gap-2 text-sm lowercase">
                          <button
                            type="button"
                            onClick={() => onTogglePaid(item.txIds, !item.paid)}
                            aria-pressed={item.paid}
                            aria-label={item.paid ? `Desmarcar ${item.label} como paga` : `Marcar ${item.label} como paga`}
                            title={item.paid ? "paga · toque para desmarcar" : "marcar como paga"}
                            className="grid size-[18px] shrink-0 place-items-center rounded-full border transition-colors"
                            style={
                              item.paid
                                ? { background: "var(--entrada)", borderColor: "var(--entrada)", color: "white" }
                                : { borderColor: item.type === "cartao" ? "var(--cartao)" : "var(--saida)" }
                            }
                          >
                            {item.paid && <Check size={11} strokeWidth={3} />}
                          </button>
                          <span className={`min-w-0 flex-1 truncate ${done ? "text-fg-subtle line-through" : ""}`}>
                            <KeepRs text={item.label} />
                            {item.count > 1 && <span className="text-fg-subtle"> · {item.count} compras</span>}
                          </span>
                          {day.items.length > 1 && (
                            <span className="shrink-0 text-xs text-fg-subtle tabular">
                              <Brl value={item.amount} />
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {bills.length > 8 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 w-full rounded-full py-2 text-sm lowercase text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          {showAll ? "ver menos" : `ver mais ${bills.length - 8} dias`}
        </button>
      )}
    </Panel>
  );
}

function CardsCard({ forecasts, usage }: { forecasts: CardForecast[]; usage: CardLimitUsage[] }) {
  const usageById = new Map(usage.map((u) => [u.card.id, u]));

  return (
    <Panel
      title="cartões"
      info="fatura de cada cartão pelo mês em que vence, com as três seguintes. conta só o que já está lançado: parcelas futuras aparecem, compras que você ainda vai fazer não. o limite livre desconta tudo o que ainda não foi marcado como pago neste cartão, parcelas futuras incluídas, como o banco faz."
    >
      {forecasts.length === 0 ? (
        <Empty>nenhum cartão cadastrado. cadastre em menu → cartões de crédito.</Empty>
      ) : (
        <ul className="flex flex-col gap-4">
          {forecasts.map(({ card, months }) => {
            const max = Math.max(...months.map((m) => m.amount), 1);
            const u = usageById.get(card.id);
            const usado = u?.limite ? Math.min(u.emAberto / u.limite, 1) : 0;
            return (
              <li key={card.id}>
                <div className="flex items-center gap-2.5">
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-lg"
                    style={{ background: "var(--cartao-soft)", color: "var(--cartao)" }}
                  >
                    <CreditCard size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium lowercase">{card.name}</span>
                    <span className="block text-[11px] lowercase text-fg-subtle">vence dia {card.dueDay}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular" style={{ color: "var(--cartao)" }}>
                    <Brl value={months[0]?.amount ?? 0} />
                  </span>
                </div>

                {u?.limite ? (
                  <div className="mt-2">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full transition-[width] duration-700"
                        style={{
                          width: `${usado * 100}%`,
                          background: usado > 0.8 ? "var(--saida)" : "var(--cartao)",
                        }}
                      />
                    </div>
                    <p className="mt-1 flex justify-between text-[11px] lowercase text-fg-subtle tabular">
                      <span style={{ color: (u.livre ?? 0) < 0 ? "var(--saida)" : undefined }}>
                        livre <Brl value={u.livre ?? 0} />
                      </span>
                      <span>
                        de <Brl value={u.limite} />
                      </span>
                    </p>
                  </div>
                ) : (
                  <p className="mt-1.5 text-[11px] lowercase text-fg-subtle">
                    em aberto <Brl value={u?.emAberto ?? 0} /> · informe o limite no cartão para ver o livre
                  </p>
                )}

                <div className="mt-2.5 grid grid-cols-4 items-end gap-1.5">
                  {months.map((m, i) => (
                    <div key={m.key} className="flex flex-col items-center gap-1">
                      <div className="flex h-10 w-full items-end overflow-hidden rounded-md bg-surface-3">
                        <div
                          className="w-full rounded-md transition-[height] duration-700"
                          style={{
                            height: `${(m.amount / max) * 100}%`,
                            background: "var(--cartao)",
                            opacity: i === 0 ? 1 : 0.45,
                          }}
                          title={`${m.label}: ${formatCurrency(m.amount)}`}
                        />
                      </div>
                      <span className="text-[10px] lowercase text-fg-subtle">{m.label.split("/")[0]}</span>
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function EconomiasCard({
  summary,
  savings,
  reserve,
  fixedCost,
  onOpenVaults,
}: {
  summary: MonthBreakdown;
  savings: SavingsTotal;
  reserve: VaultBalance | null;
  fixedCost: FixedCost;
  onOpenVaults: () => void;
}) {
  const percent = summary.entradas > 0 ? (summary.economias / summary.entradas) * 100 : 0;
  const meses = reserve && fixedCost.total > 0 ? reserve.saldo / fixedCost.total : null;

  return (
    <Panel
      title={reserve ? "reserva de emergência" : "economias"}
      info={
        reserve
          ? "saldo do cofre marcado como reserva: o que estava guardado quando você criou o cofre, mais o que guardou nele, menos o que resgatou. “segura” é quantos meses do custo de vida fixo (saídas recorrentes + orçamentos do mês) ela cobre. embaixo, quanto deste mês vai para economias."
          : "tudo o que você lançou como economia até hoje, somando todos os anos. o que já está agendado para datas futuras fica de fora, porque ainda não foi guardado. embaixo, quanto deste mês vai para economias."
      }
      aside={
        <button type="button" onClick={onOpenVaults} className="flex items-center gap-1 text-xs lowercase text-fg-subtle hover:text-fg">
          <PiggyBank size={13} /> cofres
        </button>
      }
    >
      {reserve ? (
        <>
          <Money value={reserve.saldo} color="var(--economia)" big />
          <p className="mt-0.5 text-xs lowercase text-fg-subtle">
            {reserve.meta ? (
              <>
                {formatPercent((reserve.progresso ?? 0) * 100, 0)} de <Brl value={reserve.meta} />
              </>
            ) : (
              "sem meta definida"
            )}
            {meses !== null &&
              ` · segura ${meses.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${meses >= 1 && meses < 2 ? "mês" : "meses"}`}
          </p>
          {reserve.progresso !== null && (
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${Math.min(reserve.progresso * 100, 100)}%`, background: "var(--economia)" }}
              />
            </div>
          )}
        </>
      ) : (
        <>
          <Money value={savings.guardado} color="var(--economia)" big />
          <p className="mt-0.5 text-xs lowercase text-fg-subtle">
            guardado até hoje
            {savings.primeiroAno !== null && ` · desde ${savings.primeiroAno}`}
          </p>
        </>
      )}
      <div className="mt-4 rounded-xl bg-surface-2 px-3 py-2.5">
        <p className="flex items-baseline justify-between gap-2 text-sm">
          <span className="lowercase text-fg-muted">neste mês</span>
          <span className="font-semibold tabular"><Brl value={summary.economias} /></span>
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${Math.min(percent, 100)}%`, background: "var(--economia)" }}
          />
        </div>
        <p className="mt-1.5 text-[11px] lowercase text-fg-subtle">{formatPercent(percent)} das entradas</p>
      </div>
    </Panel>
  );
}

function ProjecaoCard({
  breakdowns,
  onOpenMonth,
  className,
}: {
  breakdowns: MonthBreakdown[];
  onOpenMonth: (year: number, month: number) => void;
  className?: string;
}) {
  const max = Math.max(...breakdowns.map((b) => Math.abs(b.sobra)), 1);
  const temNegativo = breakdowns.some((b) => b.sobra < 0);

  return (
    <Panel
      title={`próximos ${breakdowns.length} meses`}
      info="a sobra de cada mês com o que já está lançado: recorrências, parcelas, faturas e a cota dos orçamentos. mês vermelho é mês em que sai mais do que entra. toque num mês para abrir os totais dele."
      aside={
        temNegativo ? (
          <span className="text-xs lowercase" style={{ color: "var(--saida)" }}>
            tem mês fechando no vermelho
          </span>
        ) : undefined
      }
      className={className}
    >
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {breakdowns.map((b) => {
          const negativa = b.sobra < 0;
          const color = negativa ? "var(--saida)" : "var(--entrada)";
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => onOpenMonth(b.year, b.month)}
              className="flex flex-col gap-2 rounded-xl p-2.5 text-left transition-colors hover:bg-surface-2"
            >
              <span className="text-xs lowercase text-fg-muted">{b.label}</span>
              {/* Barra centrada no zero: positivo cresce pra cima, negativo pra baixo. */}
              <div className="flex h-16 w-full flex-col overflow-hidden rounded-md bg-surface-3">
                <div className="flex flex-1 items-end">
                  {!negativa && (
                    <div
                      className="w-full transition-[height] duration-700"
                      style={{ height: `${(b.sobra / max) * 100}%`, background: color }}
                    />
                  )}
                </div>
                <div className="h-px w-full bg-border-strong" />
                <div className="flex flex-1 items-start">
                  {negativa && (
                    <div
                      className="w-full transition-[height] duration-700"
                      style={{ height: `${(-b.sobra / max) * 100}%`, background: color }}
                    />
                  )}
                </div>
              </div>
              <span className="text-sm font-semibold tabular" style={{ color }}>
                <Brl value={b.sobra} />
              </span>
              <span className="text-[11px] tabular text-fg-subtle">saldo <Brl value={b.saldoFinal} /></span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function DeadlineBanner({
  prazos,
  today,
  onOpen,
}: {
  prazos: Deadline[];
  today: Date;
  onOpen: () => void;
}) {
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const proximos = prazos
    .map((p) => ({ ...p, days: Math.round((Date.parse(`${p.data}T00:00:00`) - todayMs) / 86_400_000) }))
    .filter((p) => p.days >= 0 && p.days <= DEADLINE_WINDOW_DAYS);

  if (proximos.length === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-3 rounded-2xl border p-4 text-left lg:col-span-3"
      style={{ borderColor: "var(--saida)", background: "var(--saida-soft)", color: "var(--saida)" }}
    >
      <TriangleAlert size={20} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1">
        {proximos.map((p) => (
          <span key={`${p.data}-${p.titulo}`} className="block text-sm lowercase">
            <span className="font-semibold tabular">
              {p.days === 0 ? "hoje" : p.days === 1 ? "amanhã" : `em ${p.days} dias`} ({formatDayMonth(p.data)})
            </span>{" "}
            · <KeepRs text={p.titulo} />
          </span>
        ))}
      </span>
      <ChevronRight size={18} className="mt-0.5 shrink-0" />
    </button>
  );
}

const MORADIA_COLORS: Record<string, string> = {
  aluguel: "var(--fg-subtle)",
  construtora: "var(--cartao)",
  despachante: "var(--diario)",
  jurosObra: "var(--saida)",
  banco: "#2563eb",
  amortizacao: "#0891b2",
  condominio: "var(--economia)",
};

function MoradiaCard({
  plan,
  summary,
  onOpen,
}: {
  plan: ApartmentPremises;
  summary: MonthBreakdown;
  onOpen: () => void;
}) {
  const [m] = buildSchedule(plan, summary.key, summary.key);
  if (!m) return null;

  const pctBanco = plan.rendaBanco > 0 ? (m.total / plan.rendaBanco) * 100 : 0;
  const pctEntradas = summary.entradas > 0 ? (m.total / summary.entradas) * 100 : 0;
  const tone = pctBanco > 50 ? "var(--saida)" : pctBanco > 30 ? "var(--diario)" : "var(--entrada)";

  return (
    <Panel
      title="moradia"
      info="aluguel e tudo do apê neste mês (construtora, despachante, juros de obra, banco, condomínio), calculado pelas premissas do imóvel. o percentual principal é sobre a renda que o banco considera; a caixa aprova parcela até 30% dela."
      aside={
        <button type="button" onClick={onOpen} className="flex items-center gap-1 text-xs lowercase text-fg-subtle hover:text-fg">
          <Building2 size={13} /> apê
        </button>
      }
    >
      {plan.rendaBanco > 0 ? (
        <p className="text-2xl font-bold tabular md:text-3xl" style={{ color: tone }}>
          {formatPercent(pctBanco, 0)}
          <span className="ml-1.5 text-xs font-normal lowercase text-fg-subtle">da renda do banco</span>
        </p>
      ) : (
        <Money value={m.total} color="var(--fg)" big />
      )}
      <p className="mt-0.5 text-xs lowercase text-fg-subtle">
        <Brl value={m.total} />
        {summary.entradas > 0 && ` · ${formatPercent(pctEntradas, 0)} de todas as entradas`} · {m.fase}
      </p>

      <div className="relative mt-4 h-2.5 w-full rounded-full bg-surface-3">
        <div className="flex h-full overflow-hidden rounded-full" style={{ width: `${Math.min(pctBanco, 100)}%` }}>
          {COMPONENTS.map((c) =>
            m[c.key] > 0 ? (
              <div key={c.key} style={{ width: `${(m[c.key] / m.total) * 100}%`, background: MORADIA_COLORS[c.key] }} />
            ) : null,
          )}
        </div>
        {plan.rendaBanco > 0 && (
          <span className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-fg" style={{ left: "30%", opacity: 0.5 }} />
        )}
      </div>

      <dl className="mt-3 flex flex-col gap-1 text-xs">
        {COMPONENTS.filter((c) => m[c.key] > 0).map((c) => (
          <div key={c.key} className="flex items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: MORADIA_COLORS[c.key] }} />
            <dt className="lowercase text-fg-muted">{c.label}</dt>
            <dd className="ml-auto tabular"><Brl value={m[c.key]} /></dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Peças                                                               */
/* ------------------------------------------------------------------ */

function Panel({
  title,
  info,
  aside,
  className = "",
  children,
}: {
  title: string;
  /** Explicação curta de onde sai o número, aberta pelo botão "i". */
  info: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <section className={`flex min-w-0 flex-col rounded-2xl border border-border-base bg-surface p-4 md:p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-1.5 text-base font-semibold lowercase">
          {title}
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            aria-expanded={infoOpen}
            aria-label={`Como é calculado: ${title}`}
            className={`grid size-6 place-items-center rounded-full transition-colors hover:bg-surface-3 hover:text-fg ${
              infoOpen ? "bg-surface-3 text-fg" : "text-fg-subtle"
            }`}
          >
            <Info size={14} />
          </button>
        </h2>
        {aside}
      </div>
      {infoOpen && (
        <p className="animate-fade-in mb-3 rounded-xl bg-surface-2 px-3 py-2.5 text-xs lowercase leading-relaxed text-fg-muted">
          {info}
        </p>
      )}
      {children}
    </section>
  );
}

/** Valor com os centavos menores, como no resto do app. */
function Money({ value, color, big }: { value: number; color: string; big?: boolean }) {
  const formatted = formatCurrency(value);
  const comma = formatted.lastIndexOf(",");
  const main = comma >= 0 ? formatted.slice(0, comma) : formatted;
  const cents = comma >= 0 ? formatted.slice(comma) : "";

  return (
    <p className={`font-bold tabular ${big ? "text-3xl md:text-4xl" : "text-xl"}`} style={{ color }}>
      {main}
      <span className="text-[0.55em] font-semibold opacity-60">{cents}</span>
    </p>
  );
}

function Legend({
  label,
  value,
  color,
  percent,
}: {
  label: string;
  value: number;
  color: string;
  percent?: number;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />
      <dt className="truncate lowercase text-fg-muted">{label}</dt>
      <dd className="ml-auto shrink-0 font-medium tabular">
        <Brl value={value} />
        {percent !== undefined && (
          <span className="ml-1 text-[11px] text-fg-subtle">{formatPercent(percent, 0)}</span>
        )}
      </dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm lowercase text-fg-subtle">{children}</p>;
}
