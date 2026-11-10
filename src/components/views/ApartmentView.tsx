"use client";

import { useMemo, useState } from "react";
import { Building2, CalendarClock, Info, Pencil, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { formatCurrency, formatPercent, monthShortLabel } from "@/lib/format";
import {
  buildSchedule,
  COMPONENTS,
  financingFigures,
  isPlanComplete,
  scenarios,
  scheduleRange,
  yearlyAverages,
  type ApartmentPremises,
  type ComponentKey,
  type ScheduleMonth,
} from "@/lib/apartment";

/** Cor de cada parte do gasto com moradia, reaproveitando os tokens do app. */
const COMPONENT_COLORS: Record<ComponentKey, string> = {
  aluguel: "var(--fg-subtle)",
  construtora: "var(--cartao)",
  despachante: "var(--diario)",
  jurosObra: "var(--saida)",
  banco: "#2563eb",
  condominio: "var(--economia)",
};

/** Referência que os bancos usam para aprovar: parcela até 30% da renda. */
const BANK_LIMIT = 0.3;

interface ApartmentViewProps {
  plan: ApartmentPremises | null;
  today: Date;
  busy: boolean;
  onEdit: () => void;
  onSync: () => void;
  onDelete: () => void;
}

export function ApartmentView({ plan, today, busy, onEdit, onSync, onDelete }: ApartmentViewProps) {
  if (!plan) {
    return (
      <Scroll>
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border-strong px-6 py-14 text-center">
          <span
            className="grid size-12 place-items-center rounded-2xl"
            style={{ background: "var(--cartao-soft)", color: "var(--cartao)" }}
          >
            <Building2 size={24} />
          </span>
          <div>
            <p className="font-semibold lowercase">nenhum imóvel cadastrado</p>
            <p className="mt-1 max-w-sm text-sm lowercase text-fg-muted">
              cadastre o contrato e a simulação do financiamento para ver o gasto com moradia mês a
              mês, os prazos que não podem passar e lançar as parcelas no seu saldo.
            </p>
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full bg-brand px-5 py-3 text-sm font-semibold lowercase text-brand-fg"
          >
            cadastrar imóvel
          </button>
        </div>
      </Scroll>
    );
  }

  if (!isPlanComplete(plan)) {
    return (
      <Scroll>
        <div className="rounded-2xl border border-border-base bg-surface p-5">
          <p className="font-semibold lowercase">{plan.nome}</p>
          <p className="mt-1 text-sm lowercase text-fg-muted">
            faltam a data do contrato, o mês da assinatura no banco, a previsão de entrega ou o valor
            financiado para montar o cronograma.
          </p>
          <button
            type="button"
            onClick={onEdit}
            className="mt-4 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold lowercase text-brand-fg"
          >
            completar premissas
          </button>
        </div>
      </Scroll>
    );
  }

  return <PlanDetails plan={plan} today={today} busy={busy} onEdit={onEdit} onSync={onSync} onDelete={onDelete} />;
}

/* ------------------------------------------------------------------ */

function PlanDetails({
  plan,
  today,
  busy,
  onEdit,
  onSync,
  onDelete,
}: {
  plan: ApartmentPremises;
  today: Date;
  busy: boolean;
  onEdit: () => void;
  onSync: () => void;
  onDelete: () => void;
}) {
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const todayStr = `${todayKey}-${String(today.getDate()).padStart(2, "0")}`;

  const { schedule, figures, years, cenarios } = useMemo(() => {
    const range = scheduleRange(plan);
    const schedule = buildSchedule(plan, range.from, range.to);
    return {
      schedule,
      figures: financingFigures(plan),
      years: yearlyAverages(schedule),
      cenarios: scenarios(plan),
    };
  }, [plan]);

  const atual = schedule.find((m) => m.key === todayKey) ?? schedule[0];
  const pico = schedule.reduce((a, b) => (b.total > a.total ? b : a), schedule[0]);
  const jurosObraTotal = schedule.reduce((s, m) => s + m.jurosObra, 0);
  const chaves = schedule.find((m) => m.fase === "pós-chaves");
  const mesesAteChaves = chaves ? chaves.index - (atual?.index ?? chaves.index) : 0;

  return (
    <Scroll wide>
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-xs lowercase text-fg-subtle">imóvel</p>
          <h2 className="truncate text-xl font-bold lowercase md:text-2xl">{plan.nome}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton icon={Pencil} label="premissas" onClick={onEdit} disabled={busy} />
          <ActionButton icon={RefreshCw} label={busy ? "gerando..." : "lançar no saldo"} onClick={onSync} disabled={busy} accent />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="fase"
          value={atual?.fase ?? "—"}
          hint={
            chaves
              ? mesesAteChaves > 0
                ? `chaves em ${mesesAteChaves} meses · ${monthShortLabel(chaves.year, chaves.month)}`
                : `chaves em ${monthShortLabel(chaves.year, chaves.month)}`
              : undefined
          }
        />
        <Stat
          label="moradia este mês"
          value={formatCurrency(atual?.total ?? 0)}
          hint={plan.rendaBanco > 0 ? `${formatPercent((atual?.pctRenda ?? 0) * 100, 0)} da renda do banco` : "informe a renda do banco"}
          color={(atual?.pctRenda ?? 0) > BANK_LIMIT ? "var(--saida)" : undefined}
        />
        <Stat
          label="parcela do banco"
          value={formatCurrency(figures.primeiraParcela)}
          hint={`${plan.sistema.toLowerCase()} · ${plan.prazoMeses} meses · com seguros`}
        />
        <Stat
          label="pico antes das chaves"
          value={formatCurrency(pico?.total ?? 0)}
          hint={pico ? `${monthShortLabel(pico.year, pico.month)} · ${formatPercent(pico.pctRenda * 100, 0)} da renda` : undefined}
          color="var(--saida)"
        />
      </section>

      <Deadlines prazos={plan.prazos} todayStr={todayStr} />

      <Panel
        title="gasto com moradia mês a mês"
        info="aluguel até as chaves, construtora, despachante, juros de obra (só juros sobre o que o banco já liberou, não abate a dívida), parcela do banco depois das chaves e condomínio. a linha tracejada é 30% da renda do banco, o limite que a caixa usa para aprovar."
      >
        <ScheduleChart schedule={schedule} renda={plan.rendaBanco} todayKey={todayKey} />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {COMPONENTS.map((c) => (
            <span key={c.key} className="flex items-center gap-1.5 text-xs lowercase text-fg-muted">
              <span className="size-2 rounded-full" style={{ background: COMPONENT_COLORS[c.key] }} />
              {c.label}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs lowercase text-fg-subtle">
          juros de obra no total: {formatCurrency(jurosObraTotal)} · total pago ao banco em {Math.round(plan.prazoMeses / 12)} anos (sem seguros): {formatCurrency(figures.totalBanco)}
        </p>
      </Panel>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="média por ano" info="média mensal do gasto com moradia em cada ano e quanto isso pesa na renda que o banco considera.">
          <ul className="-mx-1 flex flex-col">
            {years.map((y) => {
              const over = y.pctRenda > BANK_LIMIT;
              return (
                <li key={y.year} className="flex items-center gap-3 rounded-lg px-1 py-2 text-sm">
                  <span className="w-10 shrink-0 font-semibold tabular">{y.year}</span>
                  <span className="min-w-0 flex-1 truncate text-xs lowercase text-fg-subtle">{y.fases.join(" → ")}</span>
                  <span className="shrink-0 tabular">{formatCurrency(y.media)}</span>
                  {plan.rendaBanco > 0 && (
                    <span
                      className="w-11 shrink-0 text-right text-xs font-semibold tabular"
                      style={{ color: over ? "var(--saida)" : "var(--entrada)" }}
                    >
                      {formatPercent(y.pctRenda * 100, 0)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="e se der ruim?" info="cenários recalculados com as premissas atuais. o valor é o impacto em reais de cada situação.">
          <ul className="flex flex-col gap-2.5">
            {cenarios.map((c) => (
              <li key={c.titulo} className="rounded-xl bg-surface-2 px-3 py-2.5">
                <p className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium lowercase">{c.titulo}</span>
                  <span className="shrink-0 font-semibold tabular">{formatCurrency(c.impacto)}</span>
                </p>
                <p className="mt-0.5 text-xs lowercase text-fg-muted">{c.explicacao}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {plan.contrato.length > 0 && (
        <Panel title="composição do preço" info="como o valor do contrato se divide e quem paga cada parte.">
          <ul className="flex flex-col">
            {plan.contrato.map((c) => (
              <li key={c.item} className="flex items-start gap-3 border-b border-border-base py-2.5 text-sm last:border-0">
                <span className="min-w-0 flex-1">
                  <span className="block lowercase">{c.item}</span>
                  {c.nota && <span className="block text-xs lowercase text-fg-subtle">{c.nota}</span>}
                </span>
                <span className="shrink-0 font-semibold tabular">{formatCurrency(c.valor)}</span>
              </li>
            ))}
            <li className="flex items-baseline justify-between pt-3 text-sm">
              <span className="lowercase text-fg-muted">total</span>
              <span className="font-bold tabular">
                {formatCurrency(plan.contrato.reduce((s, c) => s + c.valor, 0))}
              </span>
            </li>
          </ul>
        </Panel>
      )}

      <div className="flex flex-col items-center gap-2 pb-4">
        <p className="max-w-md text-center text-xs lowercase text-fg-subtle">
          “lançar no saldo” refaz as saídas do apê de hoje em diante (10 anos à frente) a partir das
          premissas. lançamentos que você fez à mão e os do apê que já passaram não mudam.
        </p>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs lowercase text-fg-subtle transition-colors hover:bg-saida-soft hover:text-saida disabled:opacity-50"
        >
          <Trash2 size={13} /> excluir plano
        </button>
      </div>
    </Scroll>
  );
}

/* ------------------------------------------------------------------ */

function Deadlines({ prazos, todayStr }: { prazos: ApartmentPremises["prazos"]; todayStr: string }) {
  const [showPast, setShowPast] = useState(false);
  if (prazos.length === 0) return null;

  const todayMs = Date.parse(`${todayStr}T00:00:00`);
  const upcoming = prazos.filter((p) => p.data >= todayStr);
  const past = prazos.filter((p) => p.data < todayStr);

  return (
    <Panel
      title="prazos"
      info="datas do contrato que, se passarem, custam dinheiro ou o próprio apartamento. as dos próximos 90 dias também aparecem na visão geral."
      aside={
        past.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            className="text-xs lowercase text-fg-subtle hover:text-fg"
          >
            {showPast ? "esconder" : "ver"} {past.length} que já passaram
          </button>
        ) : undefined
      }
    >
      <ul className="flex flex-col gap-1">
        {[...(showPast ? past : []), ...upcoming].map((p) => {
          const days = Math.round((Date.parse(`${p.data}T00:00:00`) - todayMs) / 86_400_000);
          const passed = days < 0;
          const urgent = !passed && days <= 30;
          const soon = !passed && days <= 90;
          const [y, m, d] = p.data.split("-");
          return (
            <li key={`${p.data}-${p.titulo}`} className={`flex items-start gap-3 rounded-xl px-1 py-2 ${passed ? "opacity-50" : ""}`}>
              <span
                className="grid w-14 shrink-0 place-items-center rounded-xl py-1.5 text-center"
                style={
                  urgent
                    ? { background: "var(--saida)", color: "white" }
                    : soon
                      ? { background: "var(--saida-soft)", color: "var(--saida)" }
                      : { background: "var(--surface-3)" }
                }
              >
                <span className="text-sm font-bold leading-none tabular">{d}/{m}</span>
                <span className="text-[10px] leading-tight opacity-80">{y}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium lowercase">{p.titulo}</span>
                  <span className="shrink-0 text-xs lowercase tabular text-fg-subtle">
                    {passed ? "passou" : days === 0 ? "hoje" : `${days} dias`}
                  </span>
                </span>
                {p.consequencia && (
                  <span className="mt-0.5 flex gap-1 text-xs lowercase text-fg-muted">
                    {soon && <TriangleAlert size={12} className="mt-0.5 shrink-0" style={{ color: "var(--saida)" }} />}
                    {p.consequencia}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function ScheduleChart({
  schedule,
  renda,
  todayKey,
}: {
  schedule: ScheduleMonth[];
  renda: number;
  todayKey: string;
}) {
  const [hover, setHover] = useState<ScheduleMonth | null>(null);
  const limite = renda * BANK_LIMIT;
  const max = Math.max(...schedule.map((m) => m.total), limite, 1) * 1.08;
  const height = 180;
  const shown = hover ?? schedule.find((m) => m.key === todayKey) ?? schedule[0];

  return (
    <div>
      <div className="mb-2 min-h-[2.5rem] text-xs lowercase text-fg-muted">
        {shown && (
          <>
            <span className="font-semibold text-fg">
              {monthShortLabel(shown.year, shown.month)} · {formatCurrency(shown.total)}
            </span>
            {renda > 0 && <span> · {formatPercent(shown.pctRenda * 100, 0)} da renda</span>}
            <span> · {shown.fase}</span>
            <br />
            {COMPONENTS.filter((c) => shown[c.key] > 0)
              .map((c) => `${c.label} ${formatCurrency(shown[c.key])}`)
              .join(" · ")}
          </>
        )}
      </div>

      <div className="scrollbar-thin overflow-x-auto pb-2">
        <div className="relative flex items-end gap-px" style={{ height, minWidth: schedule.length * 7 }}>
          {renda > 0 && (
            <div
              className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed"
              style={{ bottom: (limite / max) * height, borderColor: "var(--fg-muted)" }}
            >
              <span className="absolute -top-4 right-0 bg-surface px-1 text-[10px] text-fg-muted">30% da renda</span>
            </div>
          )}

          {schedule.map((m) => {
            const isToday = m.key === todayKey;
            const isYearStart = m.month === 0;
            return (
              <div
                key={m.key}
                className="relative flex h-full min-w-[6px] flex-1 cursor-pointer flex-col justify-end"
                onMouseEnter={() => setHover(m)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(m)}
              >
                {isYearStart && (
                  <span className="absolute -bottom-0 left-0 h-full border-l border-border-base" aria-hidden />
                )}
                <div
                  className="flex w-full flex-col-reverse overflow-hidden rounded-t-[2px]"
                  style={{
                    height: (m.total / max) * height,
                    outline: hover?.key === m.key || isToday ? "1.5px solid var(--fg)" : undefined,
                  }}
                >
                  {COMPONENTS.map((c) =>
                    m[c.key] > 0 ? (
                      <div key={c.key} style={{ height: `${(m[c.key] / m.total) * 100}%`, background: COMPONENT_COLORS[c.key] }} />
                    ) : null,
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-px" style={{ minWidth: schedule.length * 7 }}>
          {schedule.map((m) => (
            <div key={m.key} className="relative min-w-[6px] flex-1">
              {m.month === 0 && (
                <span className="absolute left-0 top-1 text-[10px] tabular text-fg-subtle">{m.year}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Scroll({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className={`mx-auto flex flex-col gap-3 md:gap-4 ${wide ? "max-w-5xl" : "max-w-xl"}`}>{children}</div>
    </div>
  );
}

function Panel({
  title,
  info,
  aside,
  children,
}: {
  title: string;
  info: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  return (
    <section className="min-w-0 rounded-2xl border border-border-base bg-surface p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="flex items-center gap-1.5 text-base font-semibold lowercase">
          {title}
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            aria-expanded={infoOpen}
            aria-label={`Sobre: ${title}`}
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

function Stat({ label, value, hint, color }: { label: string; value: string; hint?: string; color?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border-base bg-surface p-4">
      <p className="text-xs font-medium lowercase text-fg-muted">{label}</p>
      <p className="mt-1.5 truncate text-lg font-bold lowercase tabular md:text-xl" style={color ? { color } : undefined}>
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] lowercase text-fg-subtle">{hint}</p>}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  accent,
}: {
  icon: typeof CalendarClock;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium lowercase transition-colors disabled:opacity-60 ${
        accent ? "bg-brand text-brand-fg" : "border border-border-base bg-surface hover:bg-surface-2"
      }`}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}
