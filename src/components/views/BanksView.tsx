"use client";

import { useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  CreditCard,
  Eye,
  Landmark,
  Pencil,
  PiggyBank,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { Brl } from "@/components/ui/Brl";
import { formatPercent } from "@/lib/format";
import {
  investmentGroups,
  netWorth,
  reserveSummary,
  type BankSnapshotData,
  type InvestmentGroup,
  type InvestmentPosition,
  type ReserveSummary,
  type SnapshotAccount,
} from "@/lib/openFinance";

/** Consentimento do Open Finance vence: avisa com esta antecedência. */
const CONSENT_WARNING_DAYS = 30;

/** Aplicação menor que isso entra na linha de sobras, para não poluir a lista. */
const DUST = 1;

/** Cores dos grupos de investimento, na ordem em que aparecem. */
const GROUP_COLORS = [
  "var(--ov-blue)",
  "var(--ov-navy)",
  "var(--cartao)",
  "var(--diario)",
  "var(--ov-sky)",
  "var(--economia)",
];

interface BanksViewProps {
  syncedAt: string | null;
  snapshot: BankSnapshotData | null;
  syncing: boolean;
  today: Date;
  onSync: () => void;
  /**
   * Nomes que você deu ao que o banco não nomeia, por id do cofrinho ou da
   * aplicação. Ficam guardados na sua conta.
   */
  apelidos: Record<string, string>;
  /** Nome vazio tira o apelido e volta o que o banco manda. */
  onRename: (id: string, nome: string) => void;
}

/**
 * Open Finance como aba à parte: mostra o que os bancos dizem — patrimônio,
 * investimentos, contas, cofrinhos e cartões — sem tocar em nada do app. Nada
 * daqui vira lançamento; as outras telas seguem só com o que você lança.
 */
export function BanksView({ syncedAt, snapshot, syncing, today, onSync, apelidos, onRename }: BanksViewProps) {
  const contas = (snapshot?.accounts ?? []).filter((a) => a.type === "BANK");
  const cartoes = (snapshot?.accounts ?? []).filter((a) => a.type === "CREDIT");

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className="flex flex-col gap-3 md:gap-4">
        <StatusCard syncedAt={syncedAt} snapshot={snapshot} syncing={syncing} today={today} onSync={onSync} />
        {snapshot && (
          <>
            <PatrimonioCard snapshot={snapshot} />
            <ReservaCard reserve={reserveSummary(snapshot)} />
            <InvestimentosCard snapshot={snapshot} apelidos={apelidos} onRename={onRename} />
            <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
              <ContasCard contas={contas} />
              <CofrinhosCard contas={contas} apelidos={apelidos} onRename={onRename} />
            </div>
            <CartoesCard cartoes={cartoes} />
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

function StatusCard({
  syncedAt,
  snapshot,
  syncing,
  today,
  onSync,
}: {
  syncedAt: string | null;
  snapshot: BankSnapshotData | null;
  syncing: boolean;
  today: Date;
  onSync: () => void;
}) {
  const consentAlerts = (snapshot?.items ?? []).filter((item) => {
    if (!item.consentExpiresAt) return false;
    const days = (Date.parse(item.consentExpiresAt) - today.getTime()) / 86_400_000;
    return days <= CONSENT_WARNING_DAYS;
  });

  return (
    <section className="rounded-2xl border border-border-base bg-surface p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="grid size-10 place-items-center rounded-xl"
            style={{ background: "var(--entrada-soft)", color: "var(--entrada)" }}
          >
            <Landmark size={20} />
          </span>
          <div>
            <p className="font-semibold lowercase">open finance</p>
            <p className="text-xs lowercase text-fg-subtle">
              {syncedAt ? `lido em ${formatDateTime(syncedAt)}` : "ainda não sincronizado"} · todo dia às 8h
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-medium lowercase text-brand-fg disabled:opacity-60"
        >
          <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
          {syncing ? "lendo os bancos..." : "sincronizar agora"}
        </button>
      </div>

      <p className="mt-3 flex gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-xs lowercase text-fg-muted">
        <Eye size={13} className="mt-0.5 shrink-0" />
        só leitura: esta aba é um espelho dos bancos. nada daqui entra nos seus lançamentos, cofres, cartões ou
        orçamentos.
      </p>

      {snapshot && snapshot.items.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {snapshot.items.map((item) => {
            const ok = item.status === "UPDATED" && !item.error;
            return (
              <li
                key={item.id}
                className="rounded-full px-3 py-1 text-xs lowercase"
                style={
                  ok
                    ? { background: "var(--surface-2)", color: "var(--fg-muted)" }
                    : { background: "var(--saida-soft)", color: "var(--saida)" }
                }
                title={item.error ?? undefined}
              >
                {bankNameOfItem(item.id, snapshot)} · {ok ? "ok" : item.status.toLowerCase()}
                {item.consentExpiresAt && ` · autorização até ${formatDate(item.consentExpiresAt.slice(0, 10))}`}
              </li>
            );
          })}
        </ul>
      )}

      {consentAlerts.length > 0 && (
        <p
          className="mt-3 flex gap-1.5 rounded-xl px-3 py-2 text-xs lowercase"
          style={{ background: "var(--saida-soft)", color: "var(--saida)" }}
        >
          <TriangleAlert size={13} className="mt-0.5 shrink-0" />
          a autorização do open finance vence em menos de {CONSENT_WARNING_DAYS} dias. renove em meu.pluggy.ai
          para os dados continuarem chegando.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Patrimônio                                                          */
/* ------------------------------------------------------------------ */

function PatrimonioCard({ snapshot }: { snapshot: BankSnapshotData }) {
  const w = netWorth(snapshot);
  const slices = [
    { key: "conta", label: "na conta", value: w.disponivel, color: "var(--entrada)", hint: "saldo solto, dá pra usar agora" },
    { key: "cofrinhos", label: "cofrinhos", value: w.reservado, color: "var(--economia)", hint: "reservado dentro da conta" },
    { key: "fixa", label: "renda fixa", value: w.rendaFixa, color: "var(--ov-blue)", hint: "cdb, caixinhas e tesouro" },
    { key: "variavel", label: "renda variável", value: w.rendaVariavel, color: "var(--cartao)", hint: "ações e fundos" },
  ].filter((s) => s.value > 0);

  return (
    <Panel icon={Wallet} title="patrimônio nos bancos">
      <div className="mt-1 flex flex-col items-center gap-5 md:flex-row md:gap-8">
        <Donut slices={slices} total={w.total} />
        <dl className="w-full flex-1 divide-y divide-border-base">
          {slices.map((s) => (
            <div key={s.key} className="flex items-baseline gap-3 py-2">
              <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
              <div className="min-w-0 flex-1">
                <dt className="text-sm lowercase">{s.label}</dt>
                <dd className="text-[11px] lowercase text-fg-subtle">{s.hint}</dd>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold tabular">
                  <Brl value={s.value} />
                </p>
                <p className="text-[11px] text-fg-subtle tabular">
                  {w.total > 0 ? formatPercent((s.value / w.total) * 100, 0) : "—"}
                </p>
              </div>
            </div>
          ))}
        </dl>
      </div>
      {w.cartoes > 0 && (
        <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs lowercase text-fg-muted">
          o patrimônio não desconta a fatura em aberto nos cartões:{" "}
          <span className="font-semibold">
            <Brl value={w.cartoes} />
          </span>
          .
        </p>
      )}
    </Panel>
  );
}

function Donut({
  slices,
  total,
}: {
  slices: { key: string; label: string; value: number; color: string }[];
  total: number;
}) {
  const soma = slices.reduce((s, x) => s + x.value, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let acc = 0;

  return (
    <div className="relative size-44 shrink-0 md:size-52">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label="composição do patrimônio">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--surface-3)" strokeWidth="12" />
        {soma > 0 &&
          slices.map((s) => {
            const len = (s.value / soma) * circumference;
            const dash = (
              <circle
                key={s.key}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth="12"
                strokeDasharray={`${len} ${circumference - len}`}
                strokeDashoffset={-acc}
              >
                <title>{`${s.label}: ${formatPercent((s.value / soma) * 100, 0)}`}</title>
              </circle>
            );
            acc += len;
            return dash;
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[11px] lowercase text-fg-muted">total</p>
        <p className="text-xl font-bold tabular md:text-2xl">
          <Brl value={total} />
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reserva no cdb                                                      */
/* ------------------------------------------------------------------ */

/**
 * O cdb (e parentes) em destaque: é onde o dinheiro fica rendendo e pronto
 * para usar, mas o banco quebra em dezenas de aplicações — somado e com os
 * aportes e retiradas do ano, dá para achar de relance.
 */
function ReservaCard({ reserve }: { reserve: ReserveSummary | null }) {
  const [openMoves, setOpenMoves] = useState(false);
  if (!reserve || reserve.total <= 0) return null;

  const rendeu = reserve.aplicado > 0 ? reserve.rendimento / reserve.aplicado : null;
  const temMovimentos = reserve.moves.length > 0;

  return (
    <section
      className="rounded-2xl border-2 bg-surface p-4 md:p-5"
      style={{ borderColor: "var(--entrada)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="grid size-10 place-items-center rounded-xl"
            style={{ background: "var(--entrada-soft)", color: "var(--entrada)" }}
          >
            <ShieldCheck size={20} />
          </span>
          <div>
            <h2 className="text-base font-semibold lowercase">reserva em cdb</h2>
            <p className="text-xs lowercase text-fg-subtle">
              {reserve.posicoes} {reserve.posicoes === 1 ? "aplicação rendendo" : "aplicações rendendo"} todo dia
            </p>
          </div>
        </div>
        <p className="text-2xl font-bold tabular md:text-3xl">
          <Brl value={reserve.total} />
        </p>
      </div>

      {reserve.aplicado > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-2">
          <Figure label="aplicado" value={<Brl value={reserve.aplicado} />} hint="o que você colocou" />
          <Figure
            label="rendimento"
            value={<Brl value={reserve.rendimento} />}
            hint={rendeu === null ? undefined : `${reserve.rendimento >= 0 ? "+" : "−"}${formatPercent(Math.abs(rendeu) * 100, 2)} sobre o aplicado`}
            color={reserve.rendimento >= 0 ? "var(--entrada)" : "var(--saida)"}
          />
        </dl>
      )}

      {reserve.porTaxa.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {reserve.porTaxa.map((taxa) => (
            <li key={taxa.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate lowercase">{taxa.label}</span>
                <span className="shrink-0 tabular">
                  <span className="font-semibold">
                    <Brl value={taxa.total} />
                  </span>
                  <span className="ml-1.5 text-[11px] text-fg-subtle">
                    {formatPercent((taxa.total / Math.max(reserve.total, 1)) * 100, 0)}
                  </span>
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(taxa.total / Math.max(reserve.total, 1)) * 100}%`, background: "var(--entrada)" }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {temMovimentos && (
        <div className="mt-4 border-t border-border-base pt-3">
          <p className="text-xs lowercase text-fg-muted">aportes e retiradas no último ano</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <MoveTotal kind="aporte" value={reserve.aportes} />
            <MoveTotal kind="resgate" value={reserve.resgates} />
          </div>
          <button
            type="button"
            onClick={() => setOpenMoves((v) => !v)}
            className="mt-2 flex w-full items-center gap-1 rounded-lg px-1 py-1.5 text-xs lowercase text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            <ChevronDown size={13} className={openMoves ? "" : "-rotate-90"} />
            {openMoves ? "esconder" : `ver ${reserve.moves.length === 1 ? "o movimento" : `os ${reserve.moves.length} movimentos`}`}
          </button>
          {openMoves && (
            <ul className="flex flex-col divide-y divide-border-base">
              {reserve.moves.map((m) => {
                const saida = m.kind === "resgate";
                return (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2 lowercase">
                      {saida ? (
                        <ArrowUpFromLine size={13} style={{ color: "var(--saida)" }} />
                      ) : (
                        <ArrowDownToLine size={13} style={{ color: "var(--entrada)" }} />
                      )}
                      {m.kind}
                      <span className="text-[11px] text-fg-subtle">{formatDate(m.date)}</span>
                    </span>
                    <span
                      className="shrink-0 font-semibold tabular"
                      style={{ color: saida ? "var(--saida)" : "var(--entrada)" }}
                    >
                      {saida ? "−" : "+"}
                      <Brl value={m.amount} />
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function MoveTotal({ kind, value }: { kind: "aporte" | "resgate"; value: number }) {
  const saida = kind === "resgate";
  const color = saida ? "var(--saida)" : "var(--entrada)";
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg" style={{ background: saida ? "var(--saida-soft)" : "var(--entrada-soft)", color }}>
        {saida ? <ArrowUpFromLine size={14} /> : <ArrowDownToLine size={14} />}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] lowercase text-fg-muted">{saida ? "retirado" : "aportado"}</p>
        <p className="truncate font-bold tabular" style={{ color }}>
          <Brl value={value} />
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Investimentos                                                       */
/* ------------------------------------------------------------------ */

function InvestimentosCard({
  snapshot,
  apelidos,
  onRename,
}: {
  snapshot: BankSnapshotData;
  apelidos: Record<string, string>;
  onRename: (id: string, nome: string) => void;
}) {
  const [abertos, setAbertos] = useState<string[]>([]);
  const groups = investmentGroups(snapshot);
  const total = groups.reduce((s, g) => s + g.total, 0);
  const posicoes = groups.flatMap((g) => g.positions);
  // Ação e fundo não dizem por quanto foram comprados: a conta de rendimento
  // vale só para quem informa o valor aplicado (cdb, tesouro).
  const comRendimento = posicoes.filter((p) => p.profit !== null);
  const rendimento = comRendimento.reduce((s, p) => s + (p.profit ?? 0), 0);
  const aplicado = comRendimento.reduce((s, p) => s + p.value - (p.profit ?? 0), 0);

  if (groups.length === 0) {
    return (
      <Panel icon={TrendingUp} title="investimentos">
        <p className="py-6 text-center text-sm lowercase text-fg-subtle">nada aplicado nos bancos.</p>
      </Panel>
    );
  }

  const toggle = (key: string) =>
    setAbertos((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));

  return (
    <Panel
      icon={TrendingUp}
      title="investimentos"
      total={total}
      subtitle={`${groups.length} ${groups.length === 1 ? "tipo" : "tipos"} de aplicação · toque para abrir`}
    >
      <dl className="mt-1 grid grid-cols-2 gap-2 md:grid-cols-3">
        {aplicado > 0 && (
          <>
            <Figure
              label="aplicado"
              value={<Brl value={aplicado} />}
              hint={`em ${comRendimento.length} ${comRendimento.length === 1 ? "aplicação que informa" : "aplicações que informam"} quanto entrou`}
            />
            <Figure
              label="rendimento"
              value={<Brl value={rendimento} />}
              hint={`${rendimento >= 0 ? "+" : "−"}${formatPercent(Math.abs(rendimento / aplicado) * 100, 2)} sobre o aplicado`}
              color={rendimento >= 0 ? "var(--entrada)" : "var(--saida)"}
            />
          </>
        )}
        <Figure
          label="aplicações"
          value={String(posicoes.length)}
          hint={`em ${groups.length} ${groups.length === 1 ? "tipo" : "tipos"}`}
        />
      </dl>

      {/* O total de cada tipo abre as aplicações que estão dentro dele. */}
      <ul className="mt-4 flex flex-col">
        {groups.map((g, i) => {
          const aberto = abertos.includes(g.key);
          const color = GROUP_COLORS[i % GROUP_COLORS.length];
          return (
            <li key={g.key} className="border-b border-border-base last:border-b-0">
              <button
                type="button"
                onClick={() => toggle(g.key)}
                aria-expanded={aberto}
                className="w-full rounded-xl px-2 py-2.5 text-left hover:bg-surface-2"
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <ChevronDown
                      size={14}
                      className={`shrink-0 text-fg-subtle transition-transform ${aberto ? "" : "-rotate-90"}`}
                    />
                    <span className="truncate lowercase">{g.label}</span>
                    <span className="shrink-0 text-[11px] lowercase text-fg-subtle">
                      {g.positions.length} {g.positions.length === 1 ? "aplicação" : "aplicações"}
                    </span>
                  </span>
                  <span className="shrink-0 tabular">
                    <span className="font-semibold">
                      <Brl value={g.total} />
                    </span>
                    <span className="ml-1.5 text-[11px] text-fg-subtle">
                      {formatPercent((g.total / Math.max(total, 1)) * 100, 0)}
                    </span>
                  </span>
                </div>
                <div className="mt-1.5 ml-[22px] h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(g.total / Math.max(total, 1)) * 100}%`, background: color }}
                  />
                </div>
              </button>
              {aberto && (
                <div className="animate-fade-in mb-2 ml-[22px]">
                  <GroupPositions group={g} apelidos={apelidos} onRename={onRename} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function GroupPositions({
  group,
  apelidos,
  onRename,
}: {
  group: InvestmentGroup;
  apelidos: Record<string, string>;
  onRename: (id: string, nome: string) => void;
}) {
  const [showDust, setShowDust] = useState(false);
  const grandes = group.positions.filter((p) => p.value >= DUST);
  const sobras = group.positions.filter((p) => p.value < DUST);
  const totalSobras = sobras.reduce((s, p) => s + p.value, 0);

  return (
    <>
      <ul className="flex flex-col divide-y divide-border-base">
        {grandes.map((p) => (
          <PositionRow key={p.key} position={p} apelidos={apelidos} onRename={onRename} />
        ))}
        {(showDust ? sobras : []).map((p) => (
          <PositionRow key={p.key} position={p} apelidos={apelidos} onRename={onRename} />
        ))}
      </ul>
      {sobras.length > 0 && (
        <button
          type="button"
          onClick={() => setShowDust((v) => !v)}
          className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-xs lowercase text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          <span className="flex items-center gap-1">
            <ChevronDown size={13} className={showDust ? "" : "-rotate-90"} />
            {sobras.length} {sobras.length === 1 ? "aplicação" : "aplicações"} de centavos
          </span>
          <span className="tabular">
            <Brl value={totalSobras} />
          </span>
        </button>
      )}
    </>
  );
}

function PositionRow({
  position: p,
  apelidos,
  onRename,
}: {
  position: InvestmentPosition;
  apelidos: Record<string, string>;
  onRename: (id: string, nome: string) => void;
}) {
  const detalhes: React.ReactNode[] = [];
  // Ação e fundo já vêm com o ticker; quem ganha apelido é o que o banco não
  // nomeia (as caixinhas do Nubank chegam todas como "CDB - NU FINANCEIRA").
  const id = p.code ? null : p.id;
  if (id && apelidos[id]) detalhes.push(<>{p.label}</>);
  // Quantidade × preço só faz sentido no que tem cota (ação, fundo, etf): na
  // renda fixa a Pluggy manda milhares de "unidades" de um centavo.
  if (p.code && p.quantity && p.unitValue) {
    detalhes.push(
      <>
        {formatQuantity(p.quantity)} × <Brl value={p.unitValue} />
      </>,
    );
  }
  if (p.rate && p.rateType) detalhes.push(<>{formatRate(p.rate)}% do {p.rateType.toLowerCase()}</>);
  if (p.dueDate) detalhes.push(<>vence em {formatDate(p.dueDate)}</>);

  return (
    <li className="flex items-baseline justify-between gap-3 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="text-sm">
          <NameWithAlias id={id} bankName={p.label} apelidos={apelidos} onRename={onRename} />
        </div>
        {detalhes.length > 0 && (
          <p className="text-[11px] lowercase text-fg-subtle">
            {detalhes.map((d, i) => (
              <span key={i}>
                {i > 0 && " · "}
                {d}
              </span>
            ))}
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold tabular">
          <Brl value={p.value} />
        </p>
        {p.profit !== null && Math.abs(p.profit) >= 0.005 && (
          <p
            className="text-[11px] tabular"
            style={{ color: p.profit >= 0 ? "var(--entrada)" : "var(--saida)" }}
          >
            {p.profit >= 0 ? "+" : "−"}
            <Brl value={Math.abs(p.profit)} />
          </p>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Contas, cofrinhos e cartões                                         */
/* ------------------------------------------------------------------ */

function ContasCard({ contas }: { contas: SnapshotAccount[] }) {
  const total = contas.reduce((s, a) => s + a.balance, 0);

  return (
    <Panel icon={Landmark} title="contas" total={total} subtitle="saldo que dá pra usar agora">
      <ul className="mt-1 flex flex-col divide-y divide-border-base">
        {contas.map((a) => {
          const reservado = (a.reserved ?? []).reduce((s, r) => s + r.amount, 0);
          return (
            <li key={a.id} className="flex items-baseline justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm lowercase">{a.name.toLowerCase()}</p>
                {reservado > 0 && (
                  <p className="text-[11px] lowercase text-fg-subtle">
                    + <Brl value={reservado} /> em cofrinhos
                  </p>
                )}
              </div>
              <span className="shrink-0 font-semibold tabular">
                <Brl value={a.balance} />
              </span>
            </li>
          );
        })}
        {contas.length === 0 && <Empty>nenhuma conta nos bancos.</Empty>}
      </ul>
    </Panel>
  );
}

function CofrinhosCard({
  contas,
  apelidos,
  onRename,
}: {
  contas: SnapshotAccount[];
  apelidos: Record<string, string>;
  onRename: (id: string, nome: string) => void;
}) {
  const todos = contas.flatMap((a) => (a.reserved ?? []).map((r) => ({ ...r, conta: a.name })));
  const comValor = todos.filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount);
  const zerados = todos.length - comValor.length;
  const total = comValor.reduce((s, r) => s + r.amount, 0);
  const maior = comValor[0]?.amount ?? 1;
  const variasContas = new Set(todos.map((r) => r.conta)).size > 1;
  // O banco manda cofrinho sem nome: numera para não virarem linhas iguais.
  const repetidos = new Map<string, number>();
  const nomeDoBanco = (nome: string) => {
    const iguais = comValor.filter((r) => r.name === nome).length;
    if (iguais < 2) return nome.toLowerCase();
    const n = (repetidos.get(nome) ?? 0) + 1;
    repetidos.set(nome, n);
    return `${nome.toLowerCase()} ${n}`;
  };
  const semNome = comValor.filter((r) => r.id && !apelidos[r.id] && r.name.startsWith("cofrinho sem nome")).length;

  return (
    <Panel icon={PiggyBank} title="cofrinhos" total={total} subtitle="reservado dentro da conta">
      <ul className="mt-1 flex flex-col">
        {comValor.map((r, i) => (
          <li key={r.id ?? `${r.conta}:${i}`} className="py-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-baseline gap-1.5">
                <NameWithAlias id={r.id} bankName={nomeDoBanco(r.name)} apelidos={apelidos} onRename={onRename} />
                {variasContas && <span className="shrink-0 text-[11px] lowercase text-fg-subtle">{r.conta.toLowerCase()}</span>}
              </span>
              <span className="shrink-0 font-semibold tabular">
                <Brl value={r.amount} />
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full"
                style={{ width: `${(r.amount / maior) * 100}%`, background: "var(--economia)" }}
              />
            </div>
          </li>
        ))}
        {comValor.length === 0 && <Empty>o banco não mostra cofrinhos com dinheiro.</Empty>}
      </ul>
      {semNome > 0 && (
        <p className="mt-2 text-xs lowercase text-fg-subtle">
          o banco não manda o nome de {semNome} {semNome === 1 ? "cofrinho" : "cofrinhos"}: toque no lápis para dar
          o seu.
        </p>
      )}
      {zerados > 0 && (
        <p className="mt-2 text-xs lowercase text-fg-subtle">
          {zerados} {zerados === 1 ? "cofrinho zerado" : "cofrinhos zerados"} ficam de fora.
        </p>
      )}
    </Panel>
  );
}

function CartoesCard({ cartoes }: { cartoes: SnapshotAccount[] }) {
  const emUso = cartoes.reduce((s, a) => s + a.balance, 0);

  return (
    <Panel icon={CreditCard} title="cartões" total={emUso} subtitle="fatura em aberto no banco">
      <ul className="mt-1 flex flex-col gap-3">
        {cartoes.map((a) => {
          const usado = a.creditLimit ? Math.min(1 - (a.availableCreditLimit ?? a.creditLimit) / a.creditLimit, 1) : 0;
          return (
            <li key={a.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate lowercase">{a.name.toLowerCase()}</span>
                <span className="shrink-0 font-semibold tabular">
                  <Brl value={a.balance} />
                </span>
              </div>
              {a.creditLimit ? (
                <>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${usado * 100}%`, background: usado > 0.8 ? "var(--saida)" : "var(--cartao)" }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] lowercase text-fg-subtle">
                    livre <Brl value={a.availableCreditLimit ?? 0} /> de <Brl value={a.creditLimit} />
                    {a.balanceDueDate && ` · último vencimento ${formatDate(a.balanceDueDate)}`}
                  </p>
                </>
              ) : (
                a.balanceDueDate && (
                  <p className="mt-1 text-[11px] lowercase text-fg-subtle">
                    último vencimento {formatDate(a.balanceDueDate)}
                  </p>
                )
              )}
            </li>
          );
        })}
        {cartoes.length === 0 && <Empty>nenhum cartão nos bancos.</Empty>}
      </ul>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Peças                                                               */
/* ------------------------------------------------------------------ */

function Panel({
  icon: Icon,
  title,
  subtitle,
  total,
  children,
}: {
  icon: typeof Landmark;
  title: string;
  subtitle?: string;
  total?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border-base bg-surface p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="flex items-center gap-2 text-base font-semibold lowercase">
          <Icon size={17} className="text-fg-muted" /> {title}
        </h2>
        {total !== undefined && (
          <p className="text-lg font-bold tabular">
            <Brl value={total} />
          </p>
        )}
        {subtitle && <p className="w-full text-xs lowercase text-fg-subtle">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Nome de um cofrinho ou de uma aplicação. O banco nem sempre manda um ("CDB -
 * NU FINANCEIRA" em toda caixinha do Nubank, cofrinho sem nome no Mercado
 * Pago), então dá para escrever o seu: fica guardado na conta, preso ao id que
 * o banco usa, e vale em qualquer aparelho. Apagar volta para o nome do banco.
 */
function NameWithAlias({
  id,
  bankName,
  apelidos,
  onRename,
}: {
  id?: string | null;
  bankName: string;
  apelidos: Record<string, string>;
  onRename: (id: string, nome: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const cancelado = useRef(false);
  const apelido = id ? apelidos[id] : undefined;

  if (editing && id) {
    return (
      <input
        autoFocus
        defaultValue={apelido ?? ""}
        placeholder={bankName}
        maxLength={40}
        aria-label="Nome do cofrinho"
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => {
          setEditing(false);
          if (cancelado.current) {
            cancelado.current = false;
            return;
          }
          const nome = e.currentTarget.value.trim();
          if (nome !== (apelido ?? "")) onRename(id, nome);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            cancelado.current = true;
            e.currentTarget.blur();
          }
        }}
        className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface px-2 py-0.5 text-sm lowercase outline-none"
      />
    );
  }

  return (
    <span className="flex min-w-0 items-baseline gap-1">
      <span className="truncate lowercase">{apelido ?? bankName}</span>
      {id && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          aria-label={`Dar um nome a ${apelido ?? bankName}`}
          title="dar um nome"
          className="shrink-0 rounded p-0.5 text-fg-subtle hover:bg-surface-3 hover:text-fg"
        >
          <Pencil size={11} />
        </button>
      )}
    </span>
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
      {hint && <p className="mt-0.5 text-[11px] lowercase text-fg-subtle">{hint}</p>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-1.5 text-xs lowercase text-fg-subtle">{children}</p>;
}

/* ------------------------------------------------------------------ */

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

/** "2028-07-08" -> "08/07/2028". */
function formatDate(dateStr: string): string {
  return dateStr.split("-").reverse().join("/");
}

/** 115 -> "115"; 102.5 -> "102,5". */
function formatRate(rate: number): string {
  return rate.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/** 7 -> "7"; 0.0099968 -> "0,01". */
function formatQuantity(quantity: number): string {
  return quantity.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function bankNameOfItem(itemId: string, snapshot: BankSnapshotData): string {
  const account = snapshot.accounts.find((a) => a.itemId === itemId && a.type === "BANK");
  return account?.name.toLowerCase() ?? "banco";
}
