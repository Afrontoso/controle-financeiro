"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Check, ChevronRight, Info, TriangleAlert } from "lucide-react";
import { formatCurrency, formatDayMonth, formatPercent, monthLongLabel, monthShortLabel, toDateStr } from "@/lib/format";
import {
  billsOfMonth,
  breakdownMonth,
  cardForecasts,
  type BillDay,
  type BillItem,
  type CardBill,
  type CardLimitUsage,
  type DayEntry,
  type MonthBreakdown,
  type MonthEntry,
  type SavingsTotal,
} from "@/lib/ledger";
import { buildSchedule, COMPONENTS, isPlanComplete, type ApartmentPremises } from "@/lib/apartment";
import { monthsToGoal, type FixedCost, type VaultBalance } from "@/lib/vaults";
import type { Card } from "@/lib/types";
import { Brl, KeepRs } from "@/components/ui/Brl";

/** Prazos do imóvel que entram em "para ficar de olho". */
const DEADLINE_WINDOW_DAYS = 90;
/** Quantos avisos aparecem antes do "mais N". */
const MAX_ALERTS = 3;
/** Referência da Caixa para aprovar: moradia até 30% da renda. */
const BANK_LIMIT = 0.3;

interface OverviewViewProps {
  /** O mês em tela primeiro, seguido dos próximos (faturas e projeção). */
  months: MonthEntry[];
  /** Hoje e os 30 dias seguintes, para o gráfico do saldo. */
  next30: DayEntry[];
  cards: Card[];
  usage: CardLimitUsage[];
  savings: SavingsTotal;
  today: Date;
  plan?: ApartmentPremises | null;
  reserve: VaultBalance | null;
  fixedCost: FixedCost;
  inboxCount?: number;
  onSelectDay: (dateStr: string) => void;
  onOpenMonth: (year: number, month: number) => void;
  onOpenApartment: () => void;
  onOpenVaults: () => void;
  onOpenBanks?: () => void;
  onTogglePaid: (ids: string[], paid: boolean) => void;
}

type Forecasts = ReturnType<typeof cardForecasts>;
type MonthStatus = "passado" | "atual" | "futuro";

export function OverviewView(props: OverviewViewProps) {
  const { months, next30, cards, usage, today, plan, reserve, fixedCost, savings } = props;

  const breakdowns = useMemo(() => months.map(breakdownMonth), [months]);
  const current = months[0];
  const summary = breakdowns[0];
  const bills = useMemo(() => (current ? billsOfMonth(current, cards) : []), [current, cards]);
  const forecasts = useMemo(() => cardForecasts(months.slice(0, 3), cards), [months, cards]);
  const hasPlan = Boolean(plan && isPlanComplete(plan));

  if (!current || !summary) return null;

  const monthStatus: MonthStatus = current.isCurrent
    ? "atual"
    : current.year * 12 + current.month < today.getFullYear() * 12 + today.getMonth()
      ? "passado"
      : "futuro";

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-3 md:gap-4 lg:grid-cols-3">
        <SaldoCard summary={summary} className="lg:col-span-2" />
        <AlertsCard {...props} bills={bills} monthStatus={monthStatus} forecasts={forecasts} />

        <ContasCard
          bills={bills}
          today={today}
          monthStatus={monthStatus}
          onSelectDay={props.onSelectDay}
          onTogglePaid={props.onTogglePaid}
        />
        {hasPlan && plan ? (
          <ApeCard plan={plan} summary={summary} onOpen={props.onOpenApartment} />
        ) : (
          <ComprometidoCard summary={summary} />
        )}
        <CartoesCard forecasts={forecasts} usage={usage} today={today} onSelectDay={props.onSelectDay} />

        <Next30Card days={next30} onSelectDay={props.onSelectDay} />
        <ReservaCard
          reserve={reserve}
          fixedCost={fixedCost}
          savings={savings}
          summary={summary}
          onOpen={props.onOpenVaults}
        />
        <ProjecaoCard breakdowns={breakdowns} onOpenMonth={props.onOpenMonth} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Saldo previsto                                                      */
/* ------------------------------------------------------------------ */

const SEGMENTS = [
  { key: "contas", label: "contas do mês", color: "var(--ov-navy)" },
  { key: "cartao", label: "cartão", color: "var(--ov-blue)" },
  { key: "diarios", label: "diários", color: "var(--ov-sky)" },
  { key: "economias", label: "guardar", color: "var(--economia)" },
] as const;

function SaldoCard({ summary, className }: { summary: MonthBreakdown; className?: string }) {
  const { entradas, sobra } = summary;
  const negativa = sobra < 0;
  const base = Math.max(entradas, entradas - sobra, 1);
  const pct = entradas > 0 ? (Math.abs(sobra) / entradas) * 100 : 0;

  return (
    <Tile
      title="saldo previsto"
      info="entradas do mês menos contas, faturas do cartão que vencem nele, gastos diários (o lançado e a cota dos orçamentos de hoje em diante) e o que vai ser guardado. é quanto o saldo muda do dia 1 ao último dia do mês."
      illustration="purse"
      className={className}
    >
      <div className="my-6 flex flex-wrap items-center gap-x-6 gap-y-3 md:my-10">
        <BigMoney value={sobra} size="xl" color={negativa ? "var(--saida)" : undefined} />
        <div className="border-l border-border-base pl-4 text-xs lowercase">
          <p
            className="flex items-center gap-1 font-semibold"
            style={{ color: negativa ? "var(--saida)" : "var(--entrada)" }}
          >
            {negativa ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
            {entradas > 0
              ? `${formatPercent(pct, 0)} da renda ${negativa ? "faltando" : "livre"}`
              : "sem entradas no mês"}
          </p>
          <p className="mt-0.5 max-w-60 text-fg-muted">
            estimado depois de pagar as contas e guardar o que está planejado. no fim do mês o saldo fica em{" "}
            <Brl value={summary.saldoFinal} />.
          </p>
        </div>
      </div>

      <div className="mt-6 flex h-2.5 w-full gap-1 overflow-hidden lg:mt-auto">
        {SEGMENTS.map((seg) => {
          const value = summary[seg.key];
          if (value <= 0) return null;
          return (
            <div
              key={seg.key}
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${(value / base) * 100}%`, background: seg.color }}
              title={`${seg.label}: ${formatCurrency(value)}`}
            />
          );
        })}
        {sobra > 0 && (
          <div
            className="h-full rounded-full"
            style={{ width: `${(sobra / base) * 100}%`, background: "var(--entrada)" }}
            title={`sobra: ${formatCurrency(sobra)}`}
          />
        )}
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        <LegendItem label="renda" value={<Brl value={entradas} />} />
        {SEGMENTS.map((seg) => (
          <LegendItem
            key={seg.key}
            label={seg.label}
            dot={seg.color}
            value={
              <>
                − <Brl value={summary[seg.key]} />
              </>
            }
            pct={entradas > 0 ? (summary[seg.key] / entradas) * 100 : undefined}
          />
        ))}
        <LegendItem
          label="= sobra"
          dot={negativa ? "var(--saida)" : "var(--entrada)"}
          value={<Brl value={sobra} />}
          pct={entradas > 0 ? (sobra / entradas) * 100 : undefined}
          color={negativa ? "var(--saida)" : "var(--entrada)"}
        />
      </dl>
    </Tile>
  );
}

function LegendItem({
  label,
  value,
  dot,
  pct,
  color,
}: {
  label: string;
  value: React.ReactNode;
  dot?: string;
  pct?: number;
  color?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs lowercase text-fg-muted">
        {dot && <span className="size-1.5 shrink-0 rounded-full" style={{ background: dot }} />}
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-semibold tabular" style={color ? { color } : undefined}>
        {value}
      </dd>
      {pct !== undefined && <dd className="text-[11px] text-fg-subtle tabular">{formatPercent(pct, 0)} da renda</dd>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Para ficar de olho                                                  */
/* ------------------------------------------------------------------ */

interface Alert {
  id: string;
  tone: "danger" | "info";
  title: React.ReactNode;
  detail?: React.ReactNode;
  onClick?: () => void;
}

function AlertsCard({
  next30,
  plan,
  today,
  reserve,
  fixedCost,
  inboxCount = 0,
  bills,
  monthStatus,
  forecasts,
  onSelectDay,
  onOpenApartment,
  onOpenBanks,
  onOpenVaults,
}: OverviewViewProps & { bills: BillDay[]; monthStatus: MonthStatus; forecasts: Forecasts }) {
  const [showAll, setShowAll] = useState(false);
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const daysUntil = (date: string) => Math.round((Date.parse(`${date}T00:00:00`) - todayMs) / 86_400_000);
  const alerts: Alert[] = [];

  // Saldo negativo nos próximos 30 dias.
  const firstNegative = next30.find((d) => d.saldo < 0);
  if (firstNegative) {
    const lowest = next30.reduce((a, b) => (b.saldo < a.saldo ? b : a));
    alerts.push({
      id: "negativo",
      tone: "danger",
      title: `a conta fica negativa em ${formatDayMonth(firstNegative.dateStr)}`,
      detail: (
        <>
          no ritmo do que está lançado, o saldo chega a <Brl value={lowest.saldo} /> em{" "}
          {formatDayMonth(lowest.dateStr)}.
        </>
      ),
      onClick: () => onSelectDay(firstNegative.dateStr),
    });
  }

  // Contas que venceram e não foram marcadas como pagas.
  if (monthStatus === "atual") {
    const vencidas = bills
      .filter((d) => d.isPast)
      .flatMap((d) => d.items.filter((i) => !i.paid).map((i) => ({ ...i, day: d })));
    if (vencidas.length > 0) {
      alerts.push({
        id: "vencidas",
        tone: "danger",
        title: `${vencidas.length} ${vencidas.length === 1 ? "conta venceu" : "contas venceram"} sem marcar como paga`,
        detail: (
          <>
            {vencidas.slice(0, 3).map((v, i) => (
              <span key={v.id}>
                {i > 0 && ", "}
                <KeepRs text={v.label} />
              </span>
            ))}
            {vencidas.length > 3 && "…"}. se já pagou, marque em contas a pagar.
          </>
        ),
        onClick: () => onSelectDay(vencidas[0].day.dateStr),
      });
    }
  }

  // Prazos do apartamento.
  for (const p of plan?.prazos ?? []) {
    const days = daysUntil(p.data);
    if (days < 0 || days > DEADLINE_WINDOW_DAYS) continue;
    alerts.push({
      id: `prazo-${p.data}-${p.titulo}`,
      tone: days <= 30 ? "danger" : "info",
      title: (
        <>
          <KeepRs text={p.titulo} /> {days === 0 ? "hoje" : `em ${days} dias`}
        </>
      ),
      detail: p.consequencia ? <KeepRs text={p.consequencia} /> : formatDayMonth(p.data),
      onClick: onOpenApartment,
    });
  }

  // Próxima fatura de cada cartão que vence nos próximos 30 dias.
  for (const { card, months } of forecasts) {
    const bill = months.find(
      (b) => b.amount > 0 && !b.paid && daysUntil(b.dueDate) >= 0 && daysUntil(b.dueDate) <= 30,
    );
    if (!bill) continue;
    alerts.push({
      id: `fatura-${card.id}`,
      tone: "info",
      title: (
        <>
          fatura {card.name} vence em {formatDayMonth(bill.dueDate)}: <Brl value={bill.amount} />
        </>
      ),
      detail: `${bill.count} ${bill.count === 1 ? "lançamento" : "lançamentos"} no cartão até agora.`,
      onClick: () => onSelectDay(bill.dueDate),
    });
  }

  if (inboxCount > 0 && onOpenBanks) {
    alerts.push({
      id: "caixa",
      tone: "info",
      title: `${inboxCount} ${inboxCount === 1 ? "transação do banco" : "transações do banco"} na caixa de entrada`,
      detail: "confirme para elas entrarem no saldo.",
      onClick: onOpenBanks,
    });
  }

  if (reserve && fixedCost.total > 0 && reserve.saldo / fixedCost.total < 3) {
    alerts.push({
      id: "reserva",
      tone: "info",
      title: `a reserva segura ${(reserve.saldo / fixedCost.total).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} meses de custo fixo`,
      detail: reserve.meta ? (
        <>
          faltam <Brl value={reserve.falta ?? 0} /> para a meta.
        </>
      ) : undefined,
      onClick: onOpenVaults,
    });
  }

  const visible = showAll ? alerts : alerts.slice(0, MAX_ALERTS);

  return (
    <Tile
      title="para ficar de olho"
      subtitle={
        alerts.length === 0
          ? "nada pedindo atenção"
          : `${alerts.length} ${alerts.length === 1 ? "ponto" : "pontos"} agora`
      }
      info="o que pede atenção agora: saldo que vai ficar negativo nos próximos 30 dias, contas vencidas sem marcar, prazos do apartamento nos próximos 90 dias, faturas chegando, transações do banco esperando e reserva baixa."
    >
      {alerts.length === 0 ? (
        <p className="mt-6 text-sm lowercase text-fg-subtle">tudo tranquilo por aqui.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {visible.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={a.onClick}
                className="flex w-full items-start gap-3 rounded-xl bg-surface-2 px-3 py-2.5 text-left transition-colors hover:bg-surface-3"
              >
                <span
                  className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full"
                  style={
                    a.tone === "danger"
                      ? { background: "var(--saida-soft)", color: "var(--saida)" }
                      : { background: "var(--ov-blue-soft)", color: "var(--ov-blue)" }
                  }
                >
                  {a.tone === "danger" ? <TriangleAlert size={13} /> : <Info size={13} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-1 text-[13px] font-semibold lowercase">{a.title}</span>
                  {a.detail && <span className="mt-0.5 line-clamp-2 text-xs lowercase text-fg-muted">{a.detail}</span>}
                </span>
                <ChevronRight size={16} className="mt-1 shrink-0 text-fg-subtle" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {alerts.length > MAX_ALERTS && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 w-fit text-xs lowercase text-fg-muted hover:text-fg"
        >
          {showAll ? "mostrar menos" : `mais ${alerts.length - MAX_ALERTS}`}
        </button>
      )}
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/* Contas a pagar                                                      */
/* ------------------------------------------------------------------ */

function ContasCard({
  bills,
  today,
  monthStatus,
  onSelectDay,
  onTogglePaid,
}: {
  bills: BillDay[];
  today: Date;
  monthStatus: MonthStatus;
  onSelectDay: (dateStr: string) => void;
  onTogglePaid: (ids: string[], paid: boolean) => void;
}) {
  // Meses que já passaram contam como pagos; senão o histórico inteiro viraria "atrasado".
  const settled = (item: BillItem) => item.paid || monthStatus === "passado";
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const daysUntil = (date: string) => Math.round((Date.parse(`${date}T00:00:00`) - todayMs) / 86_400_000);

  // Abre no primeiro dia com algo por pagar; se não houver, no primeiro do mês.
  const defaultDay =
    bills.find((d) => d.items.some((i) => !settled(i)) && (monthStatus !== "atual" || !d.isPast))?.dateStr ??
    bills.find((d) => d.items.some((i) => !settled(i)))?.dateStr ??
    bills[0]?.dateStr ??
    null;
  const [picked, setPicked] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const selected = bills.find((d) => d.dateStr === (picked ?? defaultDay)) ?? null;

  const pagas = bills.reduce((n, d) => n + d.items.filter(settled).length, 0);
  const total = bills.reduce((n, d) => n + d.items.length, 0);
  const shownDays = showAll ? bills : selected ? [selected] : [];

  return (
    <Tile
      title="contas a pagar"
      subtitle={selected ? `dia ${selected.day}` : "neste mês"}
      info="saídas e faturas de cartão agrupadas pelo dia em que saem do saldo. toque num dia para ver as contas dele e no círculo para marcar como paga (a fatura do cartão é marcada inteira). marcar como paga é só um registro: não muda o saldo projetado."
      illustration="spiral_calendar"
    >
      {bills.length === 0 ? (
        <p className="mt-8 text-sm lowercase text-fg-subtle">nenhuma conta neste mês.</p>
      ) : (
        <>
          {selected && (
            <div className="mt-6">
              <BigMoney value={selected.total} size="lg" />
              <p className="mt-1 text-xs lowercase text-fg-muted">
                {dayDistance(selected, daysUntil(selected.dateStr), monthStatus)} ·{" "}
                <span className="font-semibold text-fg">
                  {pagas} de {total} pagas
                </span>
              </p>
            </div>
          )}

          <div className="scrollbar-thin -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
            {bills.map((d) => {
              const allSettled = d.items.every(settled);
              const overdue = monthStatus === "atual" && d.isPast && !d.allPaid;
              const active = selected?.dateStr === d.dateStr;
              return (
                <button
                  key={d.dateStr}
                  type="button"
                  onClick={() => {
                    setPicked(d.dateStr);
                    setShowAll(false);
                  }}
                  className="flex h-12 min-w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-semibold tabular transition-colors"
                  style={
                    active
                      ? { background: "var(--ov-blue)", borderColor: "var(--ov-blue)", color: "white" }
                      : overdue
                        ? { borderColor: "var(--saida)", color: "var(--saida)" }
                        : allSettled
                          ? { borderColor: "var(--border)", color: "var(--fg-subtle)" }
                          : { borderColor: "var(--border)" }
                  }
                >
                  {String(d.day).padStart(2, "0")}
                  <span className="flex gap-0.5">
                    {d.items.slice(0, 4).map((i) => (
                      <span
                        key={i.id}
                        className="size-1 rounded-full"
                        style={{
                          background: active ? "white" : settled(i) ? "var(--entrada)" : "currentColor",
                          opacity: 0.8,
                        }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          <ul className="mt-4 flex flex-col gap-1">
            {shownDays.flatMap((d) =>
              d.items.map((item) => {
                const done = settled(item);
                const days = daysUntil(d.dateStr);
                return (
                  <li key={item.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
                    <button
                      type="button"
                      onClick={() => onTogglePaid(item.txIds, !item.paid)}
                      aria-pressed={item.paid}
                      aria-label={item.paid ? `Desmarcar ${item.label} como paga` : `Marcar ${item.label} como paga`}
                      className="grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors"
                      style={
                        item.paid
                          ? { background: "var(--entrada)", borderColor: "var(--entrada)", color: "white" }
                          : { borderColor: "var(--border-strong)" }
                      }
                    >
                      {item.paid && <Check size={12} strokeWidth={3} />}
                    </button>
                    <button type="button" onClick={() => onSelectDay(d.dateStr)} className="min-w-0 flex-1 text-left">
                      <span
                        className={`block truncate text-sm font-medium lowercase ${done ? "text-fg-subtle line-through" : ""}`}
                      >
                        <KeepRs text={item.label} />
                      </span>
                      <span className="block text-xs lowercase text-fg-subtle">
                        {item.type === "cartao" ? `fatura · ${item.count} compras` : "conta"}
                        {!done && (
                          <span style={{ color: days < 0 ? "var(--saida)" : days <= 5 ? "#ea580c" : undefined }}>
                            {" · "}
                            {days < 0 ? "venceu" : days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`}
                          </span>
                        )}
                        {showAll && ` · dia ${d.day}`}
                      </span>
                    </button>
                    <span className="shrink-0 text-sm font-semibold tabular">
                      <Brl value={item.amount} />
                    </span>
                  </li>
                );
              }),
            )}
          </ul>

          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-3 w-fit rounded-lg border border-border-base px-3 py-1.5 text-xs font-medium lowercase hover:bg-surface-2"
          >
            {showAll ? "só o dia escolhido" : "ver todas"}
          </button>
        </>
      )}
    </Tile>
  );
}

function dayDistance(day: BillDay, days: number, status: MonthStatus): string {
  if (status === "passado") return `dia ${day.day}`;
  if (days < 0) return day.allPaid ? `dia ${day.day}` : "venceu";
  if (days === 0) return "hoje";
  if (days === 1) return "amanhã";
  return `em ${days} dias`;
}

/* ------------------------------------------------------------------ */
/* Meu apê / comprometido                                              */
/* ------------------------------------------------------------------ */

const APE_COLORS: Record<string, string> = {
  aluguel: "var(--fg-subtle)",
  construtora: "var(--ov-navy)",
  despachante: "var(--ov-sky)",
  jurosObra: "var(--saida)",
  banco: "var(--ov-blue)",
  amortizacao: "#0891b2",
  condominio: "var(--economia)",
};

function ApeCard({ plan, summary, onOpen }: { plan: ApartmentPremises; summary: MonthBreakdown; onOpen: () => void }) {
  const [base, setBase] = useState<"salario" | "total">("salario");
  const [m] = buildSchedule(plan, summary.key, summary.key);
  if (!m) return null;

  const renda = base === "salario" ? plan.rendaBanco : summary.entradas;
  const pct = renda > 0 ? m.total / renda : 0;
  const tone = pct > 0.5 ? "var(--saida)" : pct > BANK_LIMIT ? "#ea580c" : "var(--entrada)";

  return (
    <Tile
      title="meu apê"
      subtitle="moradia do mês: aluguel e tudo do apartamento"
      info="aluguel, construtora, despachante, juros de obra, parcela do banco e condomínio deste mês, pelas premissas do imóvel. “só o salário” é a renda que a caixa considera; “renda total” são todas as entradas do mês. a marca é a referência de 30% que o banco usa para aprovar."
      illustration="house"
      onTitleClick={onOpen}
    >
      <div className="mt-6">
        <BigMoney value={m.total} size="lg" />
        <p className="mt-1 text-xs lowercase text-fg-muted">
          <span className="font-semibold" style={{ color: tone }}>
            {renda > 0 ? `${formatPercent(pct * 100, 0)} da renda` : "sem renda para comparar"}
          </span>{" "}
          · referência: até 30% · {m.fase}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-surface-3 p-1 text-xs lowercase">
        {(
          [
            ["salario", "só o salário"],
            ["total", "renda total"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setBase(key)}
            className={`rounded-lg py-1.5 font-medium transition-colors ${base === key ? "bg-surface shadow-sm" : "text-fg-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative mt-7 h-2.5 w-full rounded-full bg-surface-3">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${Math.min(pct, 1) * 100}%`, background: tone }}
        />
        <span className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-fg" style={{ left: "30%" }} />
        <span className="absolute -top-5 -translate-x-1/2 text-[10px] text-fg-muted tabular" style={{ left: "30%" }}>
          30%
        </span>
      </div>

      <dl className="mt-4 flex flex-col gap-1.5 text-sm">
        {COMPONENTS.filter((c) => m[c.key] > 0).map((c) => (
          <div key={c.key} className="flex items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: APE_COLORS[c.key] }} />
            <dt className="lowercase text-fg-muted">{c.label}</dt>
            <dd className="ml-auto font-medium tabular">
              <Brl value={m[c.key]} />
            </dd>
          </div>
        ))}
      </dl>
    </Tile>
  );
}

function ComprometidoCard({ summary }: { summary: MonthBreakdown }) {
  const { entradas, contas, cartao } = summary;
  const comprometido = contas + cartao;
  const pct = entradas > 0 ? comprometido / entradas : 0;
  const tone = pct > 0.7 ? "var(--saida)" : pct > 0.5 ? "#ea580c" : "var(--entrada)";

  return (
    <Tile
      title="comprometido"
      subtitle="contas e faturas do mês"
      info="contas e faturas do mês em % das entradas: o que já tem destino antes de você decidir qualquer coisa. acima de 50% começa a apertar; acima de 70% qualquer imprevisto vira dívida."
      illustration="house"
    >
      <div className="mt-6">
        <BigMoney value={comprometido} size="lg" />
        <p className="mt-1 text-xs lowercase text-fg-muted">
          <span className="font-semibold" style={{ color: tone }}>
            {entradas > 0 ? `${formatPercent(pct * 100, 0)} das entradas` : "sem entradas no mês"}
          </span>{" "}
          · referência: até 50%
        </p>
      </div>
      <div className="relative mt-6 h-2.5 w-full rounded-full bg-surface-3">
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 1) * 100}%`, background: tone }} />
        <span className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-fg" style={{ left: "50%" }} />
      </div>
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/* Cartões                                                             */
/* ------------------------------------------------------------------ */

function CartoesCard({
  forecasts,
  usage,
  today,
  onSelectDay,
}: {
  forecasts: Forecasts;
  usage: CardLimitUsage[];
  today: Date;
  onSelectDay: (dateStr: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const forecast = forecasts[Math.min(index, forecasts.length - 1)];
  const todayStr = toDateStr(today);

  if (!forecast) {
    return (
      <Tile
        title="cartões"
        subtitle="nenhum cartão cadastrado"
        illustration="credit_card"
        info="cadastre seus cartões em menu → cartões de crédito para ver as faturas aqui."
      >
        <p className="mt-8 text-sm lowercase text-fg-subtle">cadastre um cartão em menu → cartões de crédito.</p>
      </Tile>
    );
  }

  const { card, months } = forecast;
  const bill = months[0];
  const u = usage.find((x) => x.card.id === card.id);
  const usadoPct = u?.limite ? Math.min(Math.max(u.emAberto / u.limite, 0), 1) : null;

  return (
    <Tile
      title="cartões"
      subtitle={
        bill
          ? `fatura de ${monthLongLabel(bill.year, bill.month).split(" ")[0]} · ${billStatus(bill, todayStr).label}`
          : undefined
      }
      info="a fatura de cada cartão pelo mês em que vence e as duas seguintes. conta o que já está lançado: parcelas futuras aparecem, compras que você ainda vai fazer não. o limite livre desconta tudo o que não foi marcado como pago neste cartão, parcelas futuras incluídas."
      illustration="credit_card"
    >
      <div className="mt-6 flex items-end justify-between gap-3">
        <BigMoney value={bill?.amount ?? 0} size="lg" />
        {forecasts.length > 1 && (
          <div className="flex gap-1 pb-2">
            {forecasts.map((f, i) => (
              <button
                key={f.card.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ver ${f.card.name}`}
                className="h-2 rounded-full transition-all"
                style={{ width: i === index ? 18 : 8, background: i === index ? "var(--ov-blue)" : "var(--border-strong)" }}
              />
            ))}
          </div>
        )}
      </div>
      {bill && (
        <button
          type="button"
          onClick={() => onSelectDay(bill.dueDate)}
          className="mt-2 w-fit rounded-lg border border-border-base px-3 py-1.5 text-xs font-medium lowercase hover:bg-surface-2"
        >
          ver fatura
        </button>
      )}

      {/* O cartão desenhado. */}
      <div
        className="mt-4 flex aspect-[1.6/1] w-full max-w-72 flex-col justify-between rounded-2xl p-4 text-white shadow-lg"
        style={{ background: "linear-gradient(135deg, var(--ov-card-from), var(--ov-card-to))" }}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="truncate text-sm font-semibold lowercase">{card.name}</span>
          {usadoPct !== null && (
            <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold tabular">
              {formatPercent(usadoPct * 100, 0)} usado
            </span>
          )}
        </div>
        <span className="h-6 w-8 rounded-md bg-gradient-to-br from-zinc-200 to-zinc-400 opacity-80" aria-hidden />
        <div>
          <div className="flex items-end justify-between gap-2 text-[10px] uppercase tracking-wider text-white/60">
            <span>
              vence
              <span className="block text-sm font-semibold tracking-normal text-white tabular">
                {bill ? formatDayMonth(bill.dueDate) : `dia ${card.dueDay}`}
              </span>
            </span>
            {u?.livre !== null && u?.livre !== undefined && (
              <span className="text-right">
                limite livre
                <span className="block text-sm font-semibold normal-case tracking-normal text-white tabular">
                  {formatCurrency(u.livre)}
                </span>
              </span>
            )}
          </div>
          {usadoPct !== null && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white" style={{ width: `${usadoPct * 100}%` }} />
            </div>
          )}
        </div>
      </div>

      <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">próximas faturas</p>
      <BillTiles bills={months} todayStr={todayStr} onSelect={onSelectDay} />
    </Tile>
  );
}

function billStatus(bill: CardBill, todayStr: string): { label: string; color: string; bg: string } {
  if (bill.paid) return { label: "paga", color: "var(--entrada)", bg: "var(--entrada-soft)" };
  if (bill.amount === 0) return { label: "sem compras", color: "var(--fg-subtle)", bg: "var(--surface-3)" };
  if (bill.dueDate < todayStr) return { label: "vencida", color: "var(--saida)", bg: "var(--saida-soft)" };
  return { label: "aberta", color: "var(--ov-blue)", bg: "var(--ov-blue-soft)" };
}

function BillTiles({
  bills,
  todayStr,
  onSelect,
}: {
  bills: CardBill[];
  todayStr: string;
  onSelect: (date: string) => void;
}) {
  const max = Math.max(...bills.map((b) => b.amount), 1);
  // Uma linha tracejada passando pelos meses, como um gráfico pequeno.
  const points = bills.map((b, i) => `${((i + 0.5) / bills.length) * 100},${85 - (b.amount / max) * 70}`);

  return (
    <div className="relative mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${bills.length}, minmax(0, 1fr))` }}>
      <svg
        className="pointer-events-none absolute inset-x-0 top-12 h-10 w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="var(--ov-blue)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {bills.map((b, i) => {
        // A primeira é a do mês em tela; as seguintes, se ainda não fecharam, são previsões.
        const status =
          i === 0 || b.paid || b.amount === 0
            ? billStatus(b, todayStr)
            : { label: "prevista", color: "var(--fg-muted)", bg: "var(--surface-3)" };
        return (
          <button
            key={b.key}
            type="button"
            onClick={() => onSelect(b.dueDate)}
            className={`flex h-28 flex-col items-center justify-between rounded-xl border px-1 py-2 text-center transition-colors hover:bg-surface-2 ${
              i === 0 ? "border-[var(--ov-blue)] bg-[var(--ov-blue-soft)]/40" : "border-transparent bg-surface-2"
            }`}
          >
            <span className="text-xs font-semibold lowercase">{b.label.split("/")[0]}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold lowercase"
              style={{ color: status.color, background: status.bg }}
            >
              {status.label}
            </span>
            <span className="h-6" />
            <span className="text-xs font-semibold tabular" style={{ color: i === 0 ? "var(--ov-blue)" : undefined }}>
              <Brl value={Math.round(b.amount)} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Próximos 30 dias                                                    */
/* ------------------------------------------------------------------ */

function Next30Card({ days, onSelectDay }: { days: DayEntry[]; onSelectDay: (dateStr: string) => void }) {
  if (days.length === 0) return null;
  const hoje = days[0];
  const lowest = days.reduce((a, b) => (b.saldo < a.saldo ? b : a));

  return (
    <Tile
      title="próximos 30 dias"
      subtitle="saldo previsto da conta"
      info="o saldo projetado dia a dia de hoje até daqui a 30 dias, com tudo o que está lançado e a cota dos orçamentos. o ponto mais baixo é o dia mais apertado; abaixo da linha vermelha a conta fica negativa. toque no gráfico para abrir o dia."
      illustration="chart_increasing"
    >
      <div className="mt-6 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onSelectDay(hoje.dateStr)} className="rounded-xl bg-surface-2 px-3 py-2.5 text-left">
          <span className="block text-[11px] lowercase text-fg-muted">hoje</span>
          <span className="block text-lg font-bold tabular" style={{ color: hoje.saldo < 0 ? "var(--saida)" : undefined }}>
            <Brl value={hoje.saldo} />
          </span>
        </button>
        <button
          type="button"
          onClick={() => onSelectDay(lowest.dateStr)}
          className="rounded-xl bg-surface-2 px-3 py-2.5 text-left"
        >
          <span className="block text-[11px] lowercase text-fg-muted">ponto mais baixo</span>
          <span className="block text-lg font-bold tabular" style={{ color: lowest.saldo < 0 ? "var(--saida)" : undefined }}>
            <Brl value={lowest.saldo} />
          </span>
          <span className="block text-[10px] lowercase text-fg-subtle">em {formatDayMonth(lowest.dateStr)}</span>
        </button>
      </div>
      <LineChart values={days.map((d) => d.saldo)} labels={days.map((d) => d.dateStr)} onSelect={onSelectDay} />
    </Tile>
  );
}

function LineChart({
  values,
  labels,
  onSelect,
}: {
  values: number[];
  labels: string[];
  onSelect: (label: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const x = (i: number) => (i / Math.max(values.length - 1, 1)) * 100;
  const y = (v: number) => 92 - ((v - min) / range) * 84;
  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");

  return (
    <div className="mt-4">
      <svg
        className="h-28 w-full cursor-pointer"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHover(Math.round(((e.clientX - rect.left) / rect.width) * (values.length - 1)));
        }}
        onClick={() => hover !== null && labels[hover] && onSelect(labels[hover])}
        role="img"
        aria-label="Saldo previsto nos próximos 30 dias"
      >
        <polygon points={`0,100 ${line} 100,100`} fill="var(--ov-blue-soft)" opacity="0.8" />
        {min < 0 && (
          <line
            x1="0"
            x2="100"
            y1={y(0)}
            y2={y(0)}
            stroke="var(--saida)"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <polyline
          points={line}
          fill="none"
          stroke="var(--ov-blue)"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {hover !== null && values[hover] !== undefined && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1="0"
            y2="100"
            stroke="var(--fg-subtle)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <p className="mt-1 h-4 text-[11px] lowercase text-fg-muted tabular">
        {hover !== null && values[hover] !== undefined ? (
          <>
            {formatDayMonth(labels[hover])} · <Brl value={values[hover]} />
          </>
        ) : (
          "passe o dedo ou o mouse pelo gráfico"
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reserva                                                             */
/* ------------------------------------------------------------------ */

function ReservaCard({
  reserve,
  fixedCost,
  savings,
  summary,
  onOpen,
}: {
  reserve: VaultBalance | null;
  fixedCost: FixedCost;
  savings: SavingsTotal;
  summary: MonthBreakdown;
  onOpen: () => void;
}) {
  if (!reserve) {
    return (
      <Tile
        title="economias"
        subtitle="guardado até hoje"
        info="tudo o que foi lançado como economia até hoje. crie a reserva de emergência em cofres para acompanhar a meta aqui."
        illustration="money_bag"
        onTitleClick={onOpen}
      >
        <div className="mt-6">
          <BigMoney value={savings.guardado} size="lg" />
          <p className="mt-1 text-xs lowercase text-fg-muted">
            neste mês <Brl value={summary.economias} />
          </p>
        </div>
      </Tile>
    );
  }

  const meses = fixedCost.total > 0 ? reserve.saldo / fixedCost.total : null;
  const prazo = monthsToGoal(reserve, reserve.noMes);
  const previsao = prazo ? new Date(new Date().getFullYear(), new Date().getMonth() + prazo, 1) : null;

  return (
    <Tile
      title={reserve.vault.name}
      subtitle={
        meses !== null
          ? `segura ${meses.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} meses de custo fixo`
          : "reserva de emergência"
      }
      info="saldo do cofre marcado como reserva: o que estava guardado ao criar o cofre, mais o que foi guardado, menos o que foi resgatado. a previsão usa o quanto entrou nele neste mês."
      illustration="money_bag"
      onTitleClick={onOpen}
    >
      <div className="mt-6">
        <BigMoney value={reserve.saldo} size="lg" />
        <p className="mt-1 text-xs lowercase text-fg-muted">
          {reserve.meta ? (
            <>
              de <Brl value={reserve.meta} /> · {formatPercent((reserve.progresso ?? 0) * 100, 0)} da meta
            </>
          ) : (
            "sem meta definida"
          )}
        </p>
      </div>
      {reserve.progresso !== null && (
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{ width: `${Math.min(reserve.progresso, 1) * 100}%`, background: "var(--ov-blue)" }}
          />
        </div>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface-2 px-3 py-2.5">
          <p className="text-[11px] lowercase text-fg-muted">previsão</p>
          <p className="text-base font-bold lowercase tabular">
            {reserve.falta === 0 ? "atingida" : previsao ? monthShortLabel(previsao.getFullYear(), previsao.getMonth()) : "—"}
          </p>
          <p className="text-[10px] lowercase text-fg-subtle">
            {reserve.falta === 0
              ? "meta completa"
              : prazo
                ? `${prazo} meses no ritmo deste mês`
                : "guarde algo este mês para prever"}
          </p>
        </div>
        <div className="rounded-xl bg-surface-2 px-3 py-2.5">
          <p className="text-[11px] lowercase text-fg-muted">este mês</p>
          <p className="text-base font-bold tabular">
            <Brl value={reserve.noMes} />
          </p>
          {reserve.falta !== null && reserve.falta > 0 && (
            <p className="text-[10px] lowercase text-fg-subtle">
              faltam <Brl value={reserve.falta} />
            </p>
          )}
        </div>
      </div>
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/* Próximos meses                                                      */
/* ------------------------------------------------------------------ */

function ProjecaoCard({
  breakdowns,
  onOpenMonth,
}: {
  breakdowns: MonthBreakdown[];
  onOpenMonth: (year: number, month: number) => void;
}) {
  const max = Math.max(...breakdowns.map((b) => Math.abs(b.sobra)), 1);
  const vermelhos = breakdowns.filter((b) => b.sobra < 0).length;

  return (
    <Tile
      title={`próximos ${breakdowns.length} meses`}
      subtitle={
        vermelhos > 0
          ? `${vermelhos} ${vermelhos === 1 ? "mês fecha" : "meses fecham"} no vermelho`
          : "sobra de cada mês"
      }
      info="a sobra de cada mês com o que já está lançado: recorrências, parcelas, faturas e a cota dos orçamentos. barra para baixo é mês em que sai mais do que entra. toque num mês para abrir os totais dele."
      illustration="bar_chart"
    >
      <div className="mt-6 grid grid-cols-6 gap-1.5">
        {breakdowns.map((b) => {
          const negativa = b.sobra < 0;
          const color = negativa ? "var(--saida)" : "var(--ov-blue)";
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => onOpenMonth(b.year, b.month)}
              className="flex flex-col items-center gap-1.5 rounded-lg py-1 transition-colors hover:bg-surface-2"
              title={`${b.label}: ${formatCurrency(b.sobra)}`}
            >
              <div className="flex h-24 w-full flex-col">
                <div className="flex flex-1 items-end justify-center">
                  {!negativa && (
                    <div className="w-3/5 rounded-t-md" style={{ height: `${(b.sobra / max) * 100}%`, background: color }} />
                  )}
                </div>
                <div className="h-px w-full bg-border-strong" />
                <div className="flex flex-1 items-start justify-center">
                  {negativa && (
                    <div className="w-3/5 rounded-b-md" style={{ height: `${(-b.sobra / max) * 100}%`, background: color }} />
                  )}
                </div>
              </div>
              <span className="text-[10px] lowercase text-fg-muted">{b.label.split("/")[0]}</span>
            </button>
          );
        })}
      </div>
      <dl className="mt-3 flex flex-col gap-1 text-xs">
        {breakdowns.slice(0, 3).map((b) => (
          <div key={b.key} className="flex justify-between gap-2">
            <dt className="lowercase text-fg-muted">{b.label}</dt>
            <dd className="font-medium tabular" style={{ color: b.sobra < 0 ? "var(--saida)" : undefined }}>
              <Brl value={b.sobra} />
            </dd>
          </div>
        ))}
      </dl>
    </Tile>
  );
}

/* ------------------------------------------------------------------ */
/* Peças                                                               */
/* ------------------------------------------------------------------ */

function Tile({
  title,
  subtitle,
  info,
  illustration,
  onTitleClick,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  info: string;
  /** Nome do arquivo em /public/illustrations (Fluent Emoji 3D, licença MIT). */
  illustration?: string;
  onTitleClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <section
      className={`relative flex min-w-0 flex-col rounded-3xl border border-border-base bg-surface p-5 shadow-sm md:p-6 ${className}`}
    >
      {illustration && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/illustrations/${illustration}.png`}
          alt=""
          aria-hidden
          className="pointer-events-none absolute top-4 right-4 size-14 select-none md:size-16"
        />
      )}
      <div className="pr-16">
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold lowercase">
          {onTitleClick ? (
            <button type="button" onClick={onTitleClick} className="hover:underline">
              <KeepRs text={title} />
            </button>
          ) : (
            <KeepRs text={title} />
          )}
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            aria-expanded={infoOpen}
            aria-label={`Como é calculado: ${title}`}
            className={`grid size-5 place-items-center rounded-full border transition-colors hover:text-fg ${
              infoOpen ? "border-fg text-fg" : "border-border-strong text-fg-subtle"
            }`}
          >
            <Info size={11} />
          </button>
        </h2>
        {subtitle && <p className="mt-0.5 text-xs lowercase text-fg-muted">{subtitle}</p>}
      </div>
      {infoOpen && (
        <p className="animate-fade-in mt-3 rounded-xl bg-surface-2 px-3 py-2.5 text-xs lowercase leading-relaxed text-fg-muted">
          {info}
        </p>
      )}
      {children}
    </section>
  );
}

/** "R$ 776,11" grande: o R$ e os centavos menores e em cinza. */
function BigMoney({ value, size, color }: { value: number; size: "lg" | "xl"; color?: string }) {
  const number = formatCurrency(Math.abs(value)).replace(/^R\$\s?/, "");
  const comma = number.lastIndexOf(",");
  const inteiro = comma >= 0 ? number.slice(0, comma) : number;
  const cents = comma >= 0 ? number.slice(comma) : "";

  return (
    <p
      className={`flex items-baseline font-bold tracking-tight tabular ${size === "xl" ? "text-6xl md:text-7xl" : "text-4xl"}`}
      style={color ? { color } : undefined}
    >
      <span className={`font-semibold text-fg-subtle ${size === "xl" ? "mr-2 text-4xl md:text-5xl" : "mr-1.5 text-2xl"}`}>
        {value < 0 && "−"}R$
      </span>
      {inteiro}
      <span className={`font-semibold text-fg-subtle ${size === "xl" ? "text-3xl" : "text-xl"}`}>{cents}</span>
    </p>
  );
}
