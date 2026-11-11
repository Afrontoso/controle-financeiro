"use client";

import { useMemo, useState } from "react";
import { Building2, CalendarClock, Info, Pencil, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { formatCurrency, formatPercent, monthShortLabel } from "@/lib/format";
import {
  buildSchedule,
  COMPONENTS,
  detailedRangeEnd,
  financingFigures,
  isPlanComplete,
  monthKeyLabel,
  scenarios,
  scheduleRange,
  simulateAmortization,
  simulateLoan,
  yearlyAverages,
  type AmortizationMode,
  type ApartmentPremises,
  type ComponentKey,
  type ScheduleMonth,
} from "@/lib/apartment";
import { Brl, KeepRs } from "@/components/ui/Brl";

/** Cor de cada parte do gasto com moradia, reaproveitando os tokens do app. */
export const COMPONENT_COLORS: Record<ComponentKey, string> = {
  aluguel: "var(--fg-subtle)",
  construtora: "var(--cartao)",
  despachante: "var(--diario)",
  jurosObra: "var(--saida)",
  banco: "#2563eb",
  amortizacao: "#0891b2",
  condominio: "var(--economia)",
};

/** Referência que os bancos usam para aprovar: parcela até 30% da renda. */
const BANK_LIMIT = 0.3;

/** Valores prontos do simulador de amortização. */
const AMORTIZATION_PRESETS = [0, 100, 200, 300, 500, 1000];

interface ApartmentViewProps {
  plan: ApartmentPremises | null;
  today: Date;
  busy: boolean;
  onEdit: () => void;
  onSync: () => void;
  onDelete: () => void;
  /** Grava a amortização extra escolhida no simulador nas premissas. */
  onApplyAmortization: (extra: number, modo: AmortizationMode) => void;
}

export function ApartmentView({
  plan,
  today,
  busy,
  onEdit,
  onSync,
  onDelete,
  onApplyAmortization,
}: ApartmentViewProps) {
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

  return (
    <PlanDetails
      plan={plan}
      today={today}
      busy={busy}
      onEdit={onEdit}
      onSync={onSync}
      onDelete={onDelete}
      onApplyAmortization={onApplyAmortization}
    />
  );
}

/* ------------------------------------------------------------------ */

function PlanDetails({
  plan,
  today,
  busy,
  onEdit,
  onSync,
  onDelete,
  onApplyAmortization,
}: Omit<ApartmentViewProps, "plan"> & { plan: ApartmentPremises }) {
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const todayStr = `${todayKey}-${String(today.getDate()).padStart(2, "0")}`;

  const { schedule, detailed, yearly, figures, years, cenarios } = useMemo(() => {
    const loan = simulateLoan(plan);
    const range = scheduleRange(plan, loan);
    const schedule = buildSchedule(plan, range.from, range.to, loan);
    const detailEnd = detailedRangeEnd(plan);
    const years = yearlyAverages(schedule);
    return {
      schedule,
      detailed: schedule.filter((m) => m.key <= detailEnd),
      yearly: yearlyBars(schedule),
      figures: financingFigures(plan),
      years,
      cenarios: scenarios(plan),
    };
  }, [plan]);

  const [chartScale, setChartScale] = useState<"mes" | "ano">("mes");
  const [showAllYears, setShowAllYears] = useState(false);

  const atual = schedule.find((m) => m.key === todayKey) ?? schedule[0];
  const antesChaves = schedule.filter((m) => m.fase !== "pós-chaves" && m.fase !== "quitado");
  const pico = (antesChaves.length > 0 ? antesChaves : schedule).reduce((a, b) => (b.total > a.total ? b : a));
  const jurosObraTotal = schedule.reduce((s, m) => s + m.jurosObra, 0);
  const chaves = schedule.find((m) => m.fase === "pós-chaves");
  const mesesAteChaves = chaves ? chaves.index - (atual?.index ?? chaves.index) : 0;
  const visibleYears = showAllYears ? years : years.slice(0, 10);

  if (!figures) return null;

  return (
    <Scroll wide>
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-xs lowercase text-fg-subtle">imóvel</p>
          <h2 className="truncate text-xl font-bold lowercase md:text-2xl">
            <KeepRs text={plan.nome} />
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton icon={Pencil} label="premissas" onClick={onEdit} disabled={busy} />
          <ActionButton
            icon={RefreshCw}
            label={busy ? "gerando..." : "lançar no saldo"}
            onClick={onSync}
            disabled={busy}
            accent
          />
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
          value={<Brl value={atual?.total ?? 0} />}
          hint={
            plan.rendaBanco > 0
              ? `${formatPercent((atual?.pctRenda ?? 0) * 100, 0)} da renda do banco`
              : "informe a renda do banco"
          }
          color={(atual?.pctRenda ?? 0) > BANK_LIMIT ? "var(--saida)" : undefined}
        />
        <Stat
          label="pico antes das chaves"
          value={<Brl value={pico?.total ?? 0} />}
          hint={pico ? `${monthShortLabel(pico.year, pico.month)} · ${formatPercent(pico.pctRenda * 100, 0)} da renda` : undefined}
          color="var(--saida)"
        />
        <Stat
          label="quitação"
          value={monthKeyLabel(figures.fim)}
          hint={`${(figures.meses / 12).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} anos de banco${
            plan.amortizacaoExtra > 0 ? " · com amortização" : ""
          }`}
        />
      </section>

      <Deadlines prazos={plan.prazos} todayStr={todayStr} />

      <LoanPanel plan={plan} figures={figures} jurosObraTotal={jurosObraTotal} />

      <AmortizationPanel plan={plan} busy={busy} onApply={onApplyAmortization} />

      <Panel
        title="gasto com moradia"
        info="aluguel até as chaves, construtora, despachante, juros de obra (só juros sobre o que o banco já liberou, não abate a dívida), parcela do banco com seguros, amortização extra e condomínio. a linha tracejada é 30% da renda do banco, o limite que a caixa usa para aprovar. na escala anual cada barra é a média mensal do ano."
        aside={
          <div className="flex gap-1 rounded-full bg-surface-3 p-0.5 text-xs lowercase">
            {(
              [
                ["mes", "mês a mês"],
                ["ano", "financiamento inteiro"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setChartScale(key)}
                className={`rounded-full px-3 py-1 transition-colors ${
                  chartScale === key ? "bg-surface text-fg shadow-sm" : "text-fg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {chartScale === "mes" ? (
          <ScheduleChart
            bars={detailed}
            renda={plan.rendaBanco}
            highlightKey={todayKey}
            labelOf={(m) => monthShortLabel(m.year, m.month)}
            tickOf={(m) => (m.month === 0 ? String(m.year) : null)}
          />
        ) : (
          <ScheduleChart
            bars={yearly}
            renda={plan.rendaBanco}
            highlightKey={String(today.getFullYear())}
            labelOf={(m) => `${m.year} · média por mês`}
            tickOf={(m) => (m.year % 5 === 0 ? String(m.year) : null)}
          />
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {COMPONENTS.filter((c) => c.key !== "amortizacao" || plan.amortizacaoExtra > 0).map((c) => (
            <span key={c.key} className="flex items-center gap-1.5 text-xs lowercase text-fg-muted">
              <span className="size-2 rounded-full" style={{ background: COMPONENT_COLORS[c.key] }} />
              {c.label}
            </span>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel
          title="média por ano"
          info="média mensal do gasto com moradia em cada ano, quanto isso pesa na renda que o banco considera e quanto ainda se deve ao banco no fim do ano."
        >
          <ul className="-mx-1 flex flex-col">
            {visibleYears.map((y) => {
              const over = y.pctRenda > BANK_LIMIT;
              return (
                <li key={y.year} className="flex items-center gap-3 rounded-lg px-1 py-2 text-sm">
                  <span className="w-10 shrink-0 font-semibold tabular">{y.year}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs lowercase text-fg-subtle">{y.fases.join(" → ")}</span>
                    {y.saldoDevedor > 0 && (
                      <span className="block text-[11px] lowercase text-fg-subtle tabular">
                        deve <Brl value={y.saldoDevedor} />
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular">
                    <Brl value={y.media} />
                  </span>
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
          {years.length > 10 && (
            <button
              type="button"
              onClick={() => setShowAllYears((v) => !v)}
              className="mt-1 w-full rounded-full py-2 text-sm lowercase text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {showAllYears ? "ver menos" : `ver os ${years.length} anos`}
            </button>
          )}
        </Panel>

        <Panel title="e se der ruim?" info="cenários recalculados com as premissas atuais. o valor é o impacto em reais de cada situação.">
          <ul className="flex flex-col gap-2.5">
            {cenarios.map((c) => (
              <li key={c.titulo} className="rounded-xl bg-surface-2 px-3 py-2.5">
                <p className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium lowercase">{c.titulo}</span>
                  <span className="shrink-0 font-semibold tabular">
                    <Brl value={c.impacto} />
                  </span>
                </p>
                <p className="mt-0.5 text-xs lowercase text-fg-muted">
                  <KeepRs text={c.explicacao} />
                </p>
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
                  <span className="block lowercase">
                    <KeepRs text={c.item} />
                  </span>
                  {c.nota && (
                    <span className="block text-xs lowercase text-fg-subtle">
                      <KeepRs text={c.nota} />
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-semibold tabular">
                  <Brl value={c.valor} />
                </span>
              </li>
            ))}
            <li className="flex items-baseline justify-between pt-3 text-sm">
              <span className="lowercase text-fg-muted">total</span>
              <span className="font-bold tabular">
                <Brl value={plan.contrato.reduce((s, c) => s + c.valor, 0)} />
              </span>
            </li>
          </ul>
        </Panel>
      )}

      <div className="flex flex-col items-center gap-2 pb-4">
        <p className="max-w-md text-center text-xs lowercase text-fg-subtle">
          “lançar no saldo” refaz as saídas do apê de hoje até a quitação ({monthKeyLabel(figures.fim)})
          a partir das premissas. lançamentos que você fez à mão e os do apê que já passaram não mudam.
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
/* Financiamento e amortização                                         */
/* ------------------------------------------------------------------ */

function LoanPanel({
  plan,
  figures,
  jurosObraTotal,
}: {
  plan: ApartmentPremises;
  figures: NonNullable<ReturnType<typeof financingFigures>>;
  jurosObraTotal: number;
}) {
  const trAno = (Math.pow(1 + plan.trMensal, 12) - 1) * 100;

  return (
    <Panel
      title="o financiamento inteiro"
      info="simulação mês a mês do saldo devedor depois das chaves. todo mês o saldo e a parcela são corrigidos pela tr, como no contrato price/tr da caixa. a tr muda com a selic: confira a real no extrato quando o contrato começar e ajuste nas premissas."
    >
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Figure label="valor financiado" value={<Brl value={figures.principal} />} hint="corrigido pelo incc até a assinatura" />
        <Figure
          label="parcela do banco"
          value={<Brl value={figures.primeiraParcela} />}
          hint={
            plan.trMensal > 0 && plan.amortizacaoExtra === 0
              ? `sobe com a tr até ~${formatCurrency(figures.ultimaParcela)}`
              : `${plan.sistema.toLowerCase()} · com seguros`
          }
        />
        <Figure label="juros ao banco" value={<Brl value={figures.juros} />} hint={`mais ${formatCurrency(jurosObraTotal)} de juros de obra`} />
        <Figure
          label="total pago ao banco"
          value={<Brl value={figures.totalPago} />}
          hint={`${figures.meses} parcelas, seguros incluídos`}
          color="var(--saida)"
        />
      </dl>
      <p className="mt-4 flex gap-1.5 rounded-xl bg-surface-2 px-3 py-2.5 text-xs lowercase text-fg-muted">
        <Info size={13} className="mt-0.5 shrink-0" />
        <span>
          tr de {formatPercent(plan.trMensal * 100, 2)} ao mês (~{formatPercent(trAno, 1)} ao ano) e seguros fixos
          em <Brl value={plan.seguros} /> por mês. na prática o seguro de vida (mip) sobe com a idade, então o
          total real tende a ser um pouco maior.
        </span>
      </p>
    </Panel>
  );
}

function AmortizationPanel({
  plan,
  busy,
  onApply,
}: {
  plan: ApartmentPremises;
  busy: boolean;
  onApply: (extra: number, modo: AmortizationMode) => void;
}) {
  const [extra, setExtra] = useState(plan.amortizacaoExtra || 200);
  const [modo, setModo] = useState<AmortizationMode>(plan.amortizacaoModo);

  const result = useMemo(() => simulateAmortization(plan, extra, modo), [plan, extra, modo]);
  const table = useMemo(
    () => AMORTIZATION_PRESETS.map((v) => simulateAmortization(plan, v, modo)),
    [plan, modo],
  );
  const base = table[0];
  const salvo = plan.amortizacaoExtra === extra && plan.amortizacaoModo === modo;

  return (
    <Panel
      title="simulador de amortização"
      info="quanto pagar a mais por mês direto no saldo devedor, a partir das chaves. “reduzir prazo” mantém a parcela e antecipa a quitação: é o que mais economiza juros. “reduzir parcela” mantém o prazo e faz a parcela cair. no começo da price quase toda a parcela é juros, por isso amortizar cedo rende muito mais."
    >
      <div className="flex flex-wrap items-center gap-2">
        {AMORTIZATION_PRESETS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setExtra(v)}
            className={`rounded-full border px-3 py-1.5 text-sm tabular transition-colors ${
              extra === v ? "border-transparent bg-brand text-brand-fg" : "border-border-base hover:bg-surface-2"
            }`}
          >
            {v === 0 ? "nada" : <Brl value={v} />}
          </button>
        ))}
        <input
          inputMode="numeric"
          aria-label="Outro valor"
          placeholder="outro"
          value={AMORTIZATION_PRESETS.includes(extra) ? "" : formatCurrency(extra).replace("R$", "").trim()}
          onChange={(e) => setExtra(Number(e.target.value.replace(/\D/g, "").slice(0, 9) || "0") / 100)}
          className="w-28 rounded-full border border-border-base bg-surface-2 px-3 py-1.5 text-sm tabular outline-none placeholder:lowercase placeholder:text-fg-subtle focus:border-border-strong"
        />
        <div className="ml-auto flex gap-1 rounded-full bg-surface-3 p-0.5 text-xs lowercase">
          {(
            [
              ["prazo", "reduzir prazo"],
              ["parcela", "reduzir parcela"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setModo(key)}
              className={`rounded-full px-3 py-1 transition-colors ${
                modo === key ? "bg-surface text-fg shadow-sm" : "text-fg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {result && (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Figure
            label="quita em"
            value={monthKeyLabel(result.summary.fim)}
            hint={
              result.mesesEconomizados > 0
                ? `${(result.mesesEconomizados / 12).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} anos antes`
                : "no prazo do contrato"
            }
            color={result.mesesEconomizados > 0 ? "var(--entrada)" : undefined}
          />
          <Figure
            label="juros economizados"
            value={<Brl value={result.jurosEconomizados} />}
            hint={`paga ${formatCurrency(result.summary.juros)} de juros`}
            color={result.jurosEconomizados > 0 ? "var(--entrada)" : undefined}
          />
          <Figure label="total pago" value={<Brl value={result.summary.totalPago} />} hint="parcelas + extras + seguros" />
          {modo === "prazo" ? (
            <Figure
              label="você paga por mês"
              value={<Brl value={result.summary.primeiraParcela + extra} />}
              hint={
                extra > 0
                  ? `parcela ${formatCurrency(result.summary.primeiraParcela)} + ${formatCurrency(extra)} extra`
                  : "só a parcela, que sobe com a tr"
              }
            />
          ) : (
            <Figure
              label="parcela em 5 anos"
              value={result.parcelaEm[60] === null ? "quitado" : <Brl value={result.parcelaEm[60]} />}
              hint={`começa em ${formatCurrency(result.summary.primeiraParcela)}${
                result.parcelaEm[120] === null ? " · quitado em 10 anos" : ` · em 10 anos ${formatCurrency(result.parcelaEm[120])}`
              }`}
              color={
                result.parcelaEm[60] !== null && result.parcelaEm[60] < result.summary.primeiraParcela
                  ? "var(--entrada)"
                  : undefined
              }
            />
          )}
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[26rem] text-sm">
          <thead>
            <tr className="text-left text-xs lowercase text-fg-subtle">
              <th className="py-1.5 font-normal">extra por mês</th>
              <th className="py-1.5 font-normal">quita em</th>
              {modo === "parcela" && <th className="py-1.5 text-right font-normal">parcela em 5 anos</th>}
              <th className="py-1.5 text-right font-normal">juros</th>
              <th className="py-1.5 text-right font-normal">economia</th>
            </tr>
          </thead>
          <tbody>
            {table.map((r) =>
              r ? (
                <tr
                  key={r.extra}
                  onClick={() => setExtra(r.extra)}
                  className={`cursor-pointer border-t border-border-base tabular transition-colors hover:bg-surface-2 ${
                    r.extra === extra ? "font-semibold" : ""
                  }`}
                >
                  <td className="py-2">{r.extra === 0 ? "nada" : <Brl value={r.extra} />}</td>
                  <td className="py-2">
                    {monthKeyLabel(r.summary.fim)}
                    <span className="ml-1 text-xs font-normal text-fg-subtle">
                      ({(r.summary.meses / 12).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} anos)
                    </span>
                  </td>
                  {modo === "parcela" && (
                    <td className="py-2 text-right">
                      {r.parcelaEm[60] === null ? "quitado" : <Brl value={r.parcelaEm[60]} />}
                    </td>
                  )}
                  <td className="py-2 text-right">
                    <Brl value={r.summary.juros} />
                  </td>
                  <td className="py-2 text-right" style={{ color: base && r.jurosEconomizados > 0 ? "var(--entrada)" : undefined }}>
                    {r.jurosEconomizados > 0 ? <Brl value={r.jurosEconomizados} /> : "—"}
                  </td>
                </tr>
              ) : null,
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs lowercase text-fg-subtle">
          {plan.amortizacaoExtra > 0 ? (
            <>
              no plano: <Brl value={plan.amortizacaoExtra} /> por mês, reduzindo {plan.amortizacaoModo}.
            </>
          ) : (
            "o plano ainda não tem amortização extra."
          )}
        </p>
        <button
          type="button"
          disabled={busy || salvo}
          onClick={() => onApply(extra, modo)}
          className="rounded-full border border-border-base px-4 py-2 text-sm font-medium lowercase transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          {salvo ? "já está no plano" : extra === 0 ? "tirar amortização do plano" : "usar no plano"}
        </button>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

/** Um "mês médio" por ano, no formato do cronograma, para a escala anual do gráfico. */
function yearlyBars(schedule: ScheduleMonth[]): ScheduleMonth[] {
  const byYear = new Map<number, ScheduleMonth[]>();
  for (const m of schedule) {
    const bucket = byYear.get(m.year);
    if (bucket) bucket.push(m);
    else byYear.set(m.year, [m]);
  }
  return [...byYear.entries()].map(([year, months]) => {
    const avg = (pick: (m: ScheduleMonth) => number) => months.reduce((s, m) => s + pick(m), 0) / months.length;
    const last = months[months.length - 1];
    return {
      ...last,
      key: String(year),
      year,
      month: 0,
      aluguel: avg((m) => m.aluguel),
      construtora: avg((m) => m.construtora),
      despachante: avg((m) => m.despachante),
      jurosObra: avg((m) => m.jurosObra),
      banco: avg((m) => m.banco),
      amortizacao: avg((m) => m.amortizacao),
      condominio: avg((m) => m.condominio),
      total: avg((m) => m.total),
      apenasApe: avg((m) => m.apenasApe),
      pctRenda: avg((m) => m.pctRenda),
    };
  });
}

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
                <span className="text-sm font-bold leading-none tabular">
                  {d}/{m}
                </span>
                <span className="text-[10px] leading-tight opacity-80">{y}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium lowercase">
                    <KeepRs text={p.titulo} />
                  </span>
                  <span className="shrink-0 text-xs lowercase tabular text-fg-subtle">
                    {passed ? "passou" : days === 0 ? "hoje" : `${days} dias`}
                  </span>
                </span>
                {p.consequencia && (
                  <span className="mt-0.5 flex gap-1 text-xs lowercase text-fg-muted">
                    {soon && <TriangleAlert size={12} className="mt-0.5 shrink-0" style={{ color: "var(--saida)" }} />}
                    <span>
                      <KeepRs text={p.consequencia} />
                    </span>
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
  bars,
  renda,
  highlightKey,
  labelOf,
  tickOf,
}: {
  bars: ScheduleMonth[];
  renda: number;
  highlightKey: string;
  labelOf: (m: ScheduleMonth) => string;
  tickOf: (m: ScheduleMonth) => string | null;
}) {
  const [hover, setHover] = useState<ScheduleMonth | null>(null);
  const limite = renda * BANK_LIMIT;
  const max = Math.max(...bars.map((m) => m.total), limite, 1) * 1.08;
  const height = 180;
  const minBar = bars.length > 60 ? 6 : 12;
  const shown = hover ?? bars.find((m) => m.key === highlightKey) ?? bars[0];

  return (
    <div>
      <div className="mb-2 min-h-[2.5rem] text-xs lowercase text-fg-muted">
        {shown && (
          <>
            <span className="font-semibold text-fg">
              {labelOf(shown)} · <Brl value={shown.total} />
            </span>
            {renda > 0 && <span> · {formatPercent(shown.pctRenda * 100, 0)} da renda</span>}
            <span> · {shown.fase}</span>
            <br />
            {COMPONENTS.filter((c) => shown[c.key] > 0).map((c, i) => (
              <span key={c.key}>
                {i > 0 && " · "}
                {c.label} <Brl value={shown[c.key]} />
              </span>
            ))}
          </>
        )}
      </div>

      <div className="scrollbar-thin overflow-x-auto pb-2">
        <div className="relative flex items-end gap-px" style={{ height, minWidth: bars.length * (minBar + 1) }}>
          {renda > 0 && (
            <div
              className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed"
              style={{ bottom: (limite / max) * height, borderColor: "var(--fg-muted)" }}
            >
              <span className="absolute -top-4 right-0 bg-surface px-1 text-[10px] text-fg-muted">30% da renda</span>
            </div>
          )}

          {bars.map((m) => (
            <div
              key={m.key}
              className="relative flex h-full flex-1 cursor-pointer flex-col justify-end"
              style={{ minWidth: minBar }}
              onMouseEnter={() => setHover(m)}
              onMouseLeave={() => setHover(null)}
              onClick={() => setHover(m)}
            >
              {tickOf(m) && <span className="absolute left-0 h-full border-l border-border-base" aria-hidden />}
              <div
                className="flex w-full flex-col-reverse overflow-hidden rounded-t-[2px]"
                style={{
                  height: (m.total / max) * height,
                  outline: hover?.key === m.key || m.key === highlightKey ? "1.5px solid var(--fg)" : undefined,
                }}
              >
                {COMPONENTS.map((c) =>
                  m[c.key] > 0 ? (
                    <div
                      key={c.key}
                      style={{ height: `${(m[c.key] / m.total) * 100}%`, background: COMPONENT_COLORS[c.key] }}
                    />
                  ) : null,
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-px" style={{ minWidth: bars.length * (minBar + 1) }}>
          {bars.map((m) => {
            const tick = tickOf(m);
            return (
              <div key={m.key} className="relative h-5 flex-1" style={{ minWidth: minBar }}>
                {tick && <span className="absolute left-0 top-1 text-[10px] tabular text-fg-subtle">{tick}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Scroll({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className={`flex flex-col gap-3 md:gap-4 ${wide ? "" : "mx-auto max-w-xl"}`}>{children}</div>
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
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

function Stat({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border-base bg-surface p-4">
      <p className="text-xs font-medium lowercase text-fg-muted">{label}</p>
      <p className="mt-1.5 truncate text-lg font-bold tabular md:text-xl" style={color ? { color } : undefined}>
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-fg-subtle">{hint}</p>}
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  color?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="text-[11px] lowercase text-fg-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-base font-bold tabular" style={color ? { color } : undefined}>
        {value}
      </dd>
      {hint && <p className="mt-0.5 text-[11px] text-fg-subtle">{hint}</p>}
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
