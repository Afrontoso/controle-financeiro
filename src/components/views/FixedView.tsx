"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  formatCurrency,
  formatDayMonth,
  fromDateStr,
  monthShortLabel,
  toDateStr,
} from "@/lib/format";
import { activeSeries, seriesTotalThisMonth, type Series } from "@/lib/series";
import { Brl } from "@/components/ui/Brl";
import { Stat, Tile } from "@/components/ui/Dashboard";
import type { MonthEntry } from "@/lib/ledger";
import type { TransactionPayload } from "@/hooks/useFinanceData";
import type { Mesada } from "@/hooks/useAppSettings";
import type { Card, Transaction, TxType } from "@/lib/types";

type Kind = "entrada" | "saida" | "cartao";

interface FixedViewProps {
  transactions: Transaction[];
  cards: Card[];
  today: Date;
  onCreate: (payload: TransactionPayload) => Promise<void>;
  onUpdateSeries: (
    groupId: string,
    from: string,
    changes: {
      amount?: number;
      description?: string;
      day?: number;
      conjuge?: boolean;
      essencial?: boolean;
    },
  ) => Promise<void>;
  onEndSeries: (groupId: string, from: string) => Promise<void>;
  /** Lançamentos dos dois, sem o filtro de pessoa: a mesada sai da renda total. */
  allTransactions: Transaction[];
  /** Este mês e os seguintes, projetados: o card da mesada mostra como cada um fecharia. */
  months: MonthEntry[];
  /** Fatia da renda que vira mesada, em %, por pessoa. */
  mesada: Mesada;
  onChangeMesada: (mesada: Mesada) => void;
}

/**
 * Tudo o que se repete, lançado à mão: rendas, contas fixas e compras no
 * cartão (parceladas ou assinaturas). Cada linha é uma série; mudar ou
 * encerrar vale daqui pra frente, o passado fica como aconteceu.
 */
export function FixedView(props: FixedViewProps) {
  const { transactions, today } = props;
  const rendas = activeSeries(transactions, ["entrada"], today).filter(
    (s) => !isVaultSeries(transactions, s),
  );
  const saidas = activeSeries(transactions, ["saida"], today);
  const cartao = activeSeries(transactions, ["cartao"], today);

  const renda = seriesTotalThisMonth(transactions, rendas, today);
  const rendaConjuge = seriesTotalThisMonth(
    transactions,
    rendas.filter((s) => s.conjuge),
    today,
  );
  const contas = seriesTotalThisMonth(transactions, saidas, today);
  const noCartao = seriesTotalThisMonth(transactions, cartao, today);

  // Mesada: as duas saem da renda da casa, a dos dois somada. A base é a renda
  // por mês (a que o card de rendas mostra), não só o que já caiu neste mês, e
  // não muda com o filtro de pessoa lá em cima.
  const rendaDaCasa = somaPorMes(
    activeSeries(props.allTransactions, ["entrada"], today).filter(
      (s) => !isVaultSeries(props.allTransactions, s),
    ),
  );
  const mesadaMinha = emCentavos((rendaDaCasa * (props.mesada.eu ?? 0)) / 100);
  const mesadaEsposa = emCentavos((rendaDaCasa * (props.mesada.esposa ?? 0)) / 100);
  const mesada = mesadaMinha + mesadaEsposa;

  // Aplicada vira conta fixa, e aí já entra em "contas fixas": só a que ainda
  // não foi lançada precisa sair da sobra, senão o valor contaria duas vezes.
  const saidasTodos = activeSeries(props.allTransactions, ["saida"], today);
  const serieMinha = mesadaSeries(saidasTodos, false);
  const serieEsposa = mesadaSeries(saidasTodos, true);
  const mesadaAberta =
    (serieMinha ? 0 : mesadaMinha) + (serieEsposa ? 0 : mesadaEsposa);
  const sobra = renda - contas - noCartao - mesadaAberta;

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className="grid grid-cols-1 items-start gap-3 md:gap-4 lg:grid-cols-2">
        <Tile
          title="o mês no automático"
          subtitle="só o que é fixo, neste mês"
          info="soma do que se repete e cai neste mês: rendas e contas fixas daqui, e as parcelas e assinaturas que ficam na aba de cada cartão (pelo dia da compra). a mesada que você reservou também sai daqui. o que sobra é o espaço para o dia a dia, os gastos avulsos e o que você quer guardar."
          illustration="purse"
          className="lg:col-span-2"
        >
          <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat
              label="rendas"
              value={<Brl value={renda} />}
              color="var(--entrada)"
              hint={
                rendaConjuge > 0 ? (
                  <>
                    minha <Brl value={renda - rendaConjuge} /> · esposa{" "}
                    <Brl value={rendaConjuge} />
                  </>
                ) : undefined
              }
            />
            <Stat label="contas fixas" value={<Brl value={contas} />} />
            <Stat
              label="no cartão"
              value={<Brl value={noCartao} />}
              hint="parcelas e assinaturas"
            />
            <Stat
              label="sobra para o resto"
              value={<Brl value={sobra} />}
              color={sobra < 0 ? "var(--saida)" : "var(--entrada)"}
              hint={
                mesada > 0
                  ? "sem a mesada; dia a dia, avulsos e guardar"
                  : "dia a dia, avulsos e guardar"
              }
            />
          </div>
        </Tile>

        <MesadaTile
          minha={{
            pct: props.mesada.eu ?? 0,
            valor: mesadaMinha,
            serie: serieMinha,
          }}
          esposa={{
            pct: props.mesada.esposa ?? 0,
            valor: mesadaEsposa,
            serie: serieEsposa,
          }}
          renda={rendaDaCasa}
          total={mesada}
          today={today}
          months={props.months}
          onChange={(quem, pct) =>
            props.onChangeMesada({ ...props.mesada, [quem]: pct })
          }
          onCreate={props.onCreate}
          onUpdateSeries={props.onUpdateSeries}
        />

        <SeriesTile
          kind="entrada"
          title="rendas"
          subtitle="salário, bolsa, o que entra todo mês"
          addLabel="nova renda"
          info="entradas que se repetem. com número de meses (uma bolsa, por exemplo) elas acabam sozinhas; sem fim, repetem até você encerrar."
          series={rendas.filter((x) => x.nextDate !== null)}
          {...props}
        />

        <SeriesTile
          kind="saida"
          title="contas fixas"
          subtitle="aluguel, internet, mercado do mês"
          addLabel="nova conta"
          info="saídas que se repetem: saem do saldo no dia marcado. o que o plano do apartamento gera aparece na tela do apartamento."
          series={saidas.filter((x) => x.nextDate !== null)}
          {...props}
        />
      </div>
    </div>
  );
}

/** Arredonda para centavos: o valor da tela é o mesmo que vai para a conta fixa. */
function emCentavos(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Nome da conta fixa que o botão "aplicar" cria; a esposa é marcada em `conjuge`. */
const MESADA_LABEL = "mesada";

/** A mesada aplicada cai sempre neste dia; só o mês de início é escolhido. */
const MESADA_DIA = 10;

/** A conta fixa da mesada de uma das pessoas, se já tiver sido aplicada. */
function mesadaSeries(saidas: Series[], conjuge: boolean): Series | undefined {
  return saidas.find(
    (s) =>
      s.label === MESADA_LABEL &&
      Boolean(s.conjuge) === conjuge &&
      s.nextDate !== null,
  );
}

/** Quanto as séries dão por mês, contando só as que ainda valem. */
function somaPorMes(series: Series[]): number {
  return series.reduce((sum, s) => sum + (s.nextDate ? s.amount : 0), 0);
}

/** Entradas ligadas a cofre são resgates, não renda. */
function isVaultSeries(transactions: Transaction[], s: Series): boolean {
  return transactions.some((t) => t.groupId === s.groupId && t.vaultId);
}

interface MesadaPessoa {
  /** Fatia da renda da casa, em % (0 a 100). */
  pct: number;
  valor: number;
  /** A conta fixa já criada pelo botão "aplicar", se houver. */
  serie?: Series;
}

/**
 * Mesada: a fatia da renda que cada um gasta como quiser, sem prestar contas.
 * As duas saem da renda da casa, a dos dois somada. Enquanto não é aplicada,
 * só sai da sobra do mês; aplicada, vira conta fixa e cai todo dia 10, a partir
 * do mês escolhido. A porcentagem fica salva na conta.
 */
function MesadaTile({
  minha,
  esposa,
  renda,
  total,
  today,
  months,
  onChange,
  onCreate,
  onUpdateSeries,
}: {
  minha: MesadaPessoa;
  esposa: MesadaPessoa;
  /** Renda da casa por mês: a base das duas mesadas. */
  renda: number;
  total: number;
  today: Date;
  months: MonthEntry[];
  onChange: (quem: "eu" | "esposa", pct: number) => void;
  onCreate: FixedViewProps["onCreate"];
  onUpdateSeries: FixedViewProps["onUpdateSeries"];
}) {
  const pessoas = [
    { quem: "eu" as const, label: "minha mesada", conjuge: false, ...minha },
    {
      quem: "esposa" as const,
      label: "mesada da esposa",
      conjuge: true,
      ...esposa,
    },
  ];
  const todayStr = toDateStr(today);
  // Começa em um mês em que o dia 10 ainda não passou; o primeiro é o padrão.
  const inicios = months.filter((m) => diaDezDe(m) >= todayStr);
  const [inicio, setInicio] = useState(() => inicios[0]?.key ?? "");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const jaLancada = pessoas.some((p) => p.serie);
  // Quem tem fatia e ainda não está lançada, ou está lançada por outro valor.
  const pendentes = pessoas.filter(
    (p) => p.valor > 0 && (!p.serie || Math.abs(p.serie.amount - p.valor) >= 0.005),
  );
  // Quanto o fecho do mês muda se você aplicar: o que ainda não está lançado.
  const aPagar = pendentes.reduce(
    (sum, p) => sum + (p.serie ? p.valor - p.serie.amount : p.valor),
    0,
  );
  // O fecho mostrado é de um mês que já tem a mesada dentro: o da próxima vez
  // em que ela cai, se já foi lançada, ou o mês escolhido para começar.
  const proxima = pessoas
    .map((p) => p.serie?.nextDate)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);
  const mesPrevia =
    (jaLancada
      ? months.find((m) => m.key === proxima?.slice(0, 7))
      : inicios.find((m) => m.key === inicio)) ?? null;
  const fecha = mesPrevia?.days.at(-1)?.saldo ?? null;

  const aplicar = async () => {
    setBusy(true);
    setErro(null);
    try {
      for (const p of pendentes) {
        if (p.serie) {
          await onUpdateSeries(p.serie.groupId, p.serie.nextDate ?? todayStr, {
            amount: p.valor,
          });
        } else {
          const mes = inicios.find((m) => m.key === inicio) ?? inicios[0];
          if (!mes) throw new Error("sem mês");
          await onCreate({
            date: diaDezDe(mes),
            type: "saida",
            amount: p.valor,
            description: MESADA_LABEL,
            cardId: null,
            repeatFrequency: "mensal",
            isIndeterminate: true,
            conjuge: p.conjuge,
            essencial: false,
          });
        }
      }
    } catch {
      setErro("não deu certo. tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Tile
      title="mesada"
      subtitle="dinheiro livre, para gastar sem pensar"
      info={`uma fatia da renda que fica reservada para gastar como quiser, sem prestar contas. as duas saem da renda da casa, a sua e a da esposa somadas, mesmo quando a tela está filtrada por uma pessoa. enquanto não é aplicada, ela só sai da sobra ali em cima; no aplicar ela vira uma conta fixa chamada mesada, que cai todo dia ${MESADA_DIA} do mês escolhido em diante e você edita como qualquer outra. o fecho do mês é o mesmo saldo que a visão geral mostra.`}
      illustration="money_bag"
      className="lg:col-span-2"
    >
      {renda === 0 ? (
        <p className="mt-3 text-sm lowercase text-fg-subtle">
          cadastre uma renda para tirar a mesada dela.
        </p>
      ) : (
        <>
          <p className="mt-0.5 text-xs lowercase text-fg-muted">
            <Brl value={total} /> por mês · fatia da renda da casa,{" "}
            <Brl value={renda} /> por mês
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {pessoas.map((p) => (
              <MesadaRow
                key={p.quem}
                label={p.label}
                pct={p.pct}
                valor={p.valor}
                serie={p.serie}
                comeca={mesDaPrimeira(p.serie, today)}
                onChange={(pct) => onChange(p.quem, pct)}
              />
            ))}
          </div>
          {mesPrevia && fecha !== null && (
            <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2.5 text-xs lowercase text-fg-muted">
              {mesPrevia.label} fecha{aPagar !== 0 && "ria"} em{" "}
              <Brl value={fecha} className={saldoClass(fecha)} />
              {aPagar !== 0 ? (
                <>
                  {" · "}com a mesada,{" "}
                  <Brl
                    value={fecha - aPagar}
                    className={saldoClass(fecha - aPagar)}
                  />
                </>
              ) : (
                jaLancada && " · já com a mesada"
              )}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs lowercase text-fg-muted">
            {jaLancada ? (
              <span>cai em contas fixas, todo dia {MESADA_DIA}</span>
            ) : (
              <>
                <span>lançar como conta fixa, todo dia {MESADA_DIA}, a partir de</span>
                <select
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  aria-label="Mês em que a mesada começa"
                  className="rounded-lg border border-border-base bg-surface px-2 py-1.5 text-sm lowercase outline-none focus:border-border-strong"
                >
                  {inicios.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            <button
              type="button"
              onClick={() => void aplicar()}
              disabled={busy || pendentes.length === 0}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold lowercase text-white disabled:opacity-50"
              style={{ background: "var(--ov-blue)" }}
            >
              <Check size={14} />
              {busy
                ? "aplicando..."
                : pendentes.length === 0 && jaLancada
                  ? "em dia"
                  : jaLancada
                    ? "atualizar"
                    : "aplicar"}
            </button>
            {erro && <span style={{ color: "var(--saida)" }}>{erro}</span>}
          </div>
        </>
      )}
    </Tile>
  );
}

/** Verde fecha no positivo, vermelho no negativo: a cor da visão geral. */
function saldoClass(saldo: number): string {
  return saldo < 0 ? "text-saida font-semibold" : "text-entrada font-semibold";
}

/** O dia 10 de um mês do ledger, que é quando a mesada cai. */
function diaDezDe(mes: MonthEntry): string {
  return toDateStr(new Date(mes.year, mes.month, MESADA_DIA));
}

/**
 * Mês em que a conta fixa começa a cair, quando não é este: naquele mês a
 * mesada ainda não sai, e a sobra aqui de cima não a desconta.
 */
function mesDaPrimeira(serie: Series | undefined, today: Date): string | null {
  if (!serie?.nextDate) return null;
  if (serie.nextDate.slice(0, 7) === toDateStr(today).slice(0, 7)) return null;
  const inicio = fromDateStr(serie.nextDate);
  return monthShortLabel(inicio.getFullYear(), inicio.getMonth());
}

/** Uma mesada: a porcentagem para digitar e quanto ela dá em reais. */
function MesadaRow({
  label,
  pct,
  valor,
  serie,
  comeca,
  onChange,
}: {
  label: string;
  pct: number;
  valor: number;
  serie?: Series;
  /** Mês em que a conta fixa começa, quando não é este. */
  comeca: string | null;
  onChange: (pct: number) => void;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
      <div className="min-w-0">
        <span className="block text-[11px] lowercase text-fg-muted">
          {label}
        </span>
        <span
          className="block text-lg font-bold tabular"
          style={{ color: pct > 0 ? "var(--diario)" : undefined }}
        >
          <Brl value={valor} />
        </span>
        <span className="block text-[11px] lowercase text-fg-subtle">
          {serie ? (
            <>
              em contas fixas: <Brl value={serie.amount} /> todo dia {serie.day}
              {comeca && `, a partir de ${comeca}`}
            </>
          ) : pct > 0 ? (
            "da renda da casa, por mês"
          ) : (
            "escolha a fatia ao lado"
          )}
        </span>
      </div>
      <label className="flex shrink-0 items-center gap-1 text-xs lowercase text-fg-muted">
        <input
          value={pct > 0 ? String(pct) : ""}
          onChange={(e) =>
            onChange(
              Math.min(
                100,
                Number(e.target.value.replace(/\D/g, "").slice(0, 3) || "0"),
              ),
            )
          }
          inputMode="numeric"
          placeholder="0"
          aria-label={`Porcentagem da ${label}`}
          className="w-14 rounded-lg border border-border-base bg-surface px-2 py-1.5 text-center text-sm tabular outline-none focus:border-border-strong"
        />
        %
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SeriesTile({
  kind,
  title,
  subtitle,
  addLabel,
  info,
  series,
  cards,
  today,
  onCreate,
  onUpdateSeries,
  onEndSeries,
}: FixedViewProps & {
  kind: Kind;
  title: string;
  subtitle: string;
  addLabel: string;
  info: string;
  series: Series[];
}) {
  const [adding, setAdding] = useState(false);
  const total = series.reduce((sum, s) => sum + (s.nextDate ? s.amount : 0), 0);

  return (
    <Tile title={title} subtitle={subtitle} info={info}>
      {series.length > 0 && (
        <p className="mt-0.5 text-xs lowercase text-fg-muted">
          <Brl value={total} /> por mês
          {kind !== "entrada" && series.some((x) => x.essencial) && (
            <>
              {" · essenciais "}
              <Brl
                value={series
                  .filter((x) => x.essencial)
                  .reduce((sum, x) => sum + x.amount, 0)}
              />
            </>
          )}
        </p>
      )}
      {(kind === "entrada"
        ? [
            { title: "minha renda", items: series.filter((s) => !s.conjuge) },
            {
              title: "renda da esposa",
              items: series.filter((s) => s.conjuge),
            },
          ].filter((g) => g.items.length > 0)
        : [{ title: null, items: series }]
      ).map((group) => (
        <div key={group.title ?? "todas"}>
          {group.title && (
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              {group.title} ·{" "}
              <Brl
                value={group.items.reduce(
                  (sum, s) => sum + (s.nextDate ? s.amount : 0),
                  0,
                )}
              />
            </p>
          )}
          <ul className="mt-1 flex flex-col divide-y divide-border-base">
            {group.items.map((s) => (
              <SeriesRow
                key={s.groupId}
                series={s}
                cards={cards}
                today={today}
                onUpdate={onUpdateSeries}
                onEnd={onEndSeries}
              />
            ))}
          </ul>
        </div>
      ))}
      {series.length === 0 && !adding && (
        <p className="mt-3 text-sm lowercase text-fg-subtle">
          nada cadastrado ainda.
        </p>
      )}
      {adding ? (
        <AddForm
          kind={kind}
          cards={cards}
          today={today}
          onCancel={() => setAdding(false)}
          onCreate={onCreate}
        />
      ) : (
        <AddButton label={addLabel} onClick={() => setAdding(true)} />
      )}
    </Tile>
  );
}

interface CardSeriesTileProps {
  /** O cartão da tela; vem primeiro na lista do formulário. */
  card: Card;
  cards: Card[];
  series: Series[];
  today: Date;
  onCreate: FixedViewProps["onCreate"];
  onUpdateSeries: FixedViewProps["onUpdateSeries"];
  onEndSeries: FixedViewProps["onEndSeries"];
}

/** Parcelas e assinaturas de um cartão, editáveis como as outras séries. */
export function CardSeriesTile({
  card,
  cards,
  series,
  today,
  onCreate,
  onUpdateSeries,
  onEndSeries,
}: CardSeriesTileProps) {
  const [adding, setAdding] = useState(false);
  const ordered = [card, ...cards.filter((c) => c.id !== card.id)];
  const total = series.reduce((sum, s) => sum + s.amount, 0);

  return (
    <Tile
      title="parcelas e assinaturas"
      subtitle={
        series.length > 0 ? undefined : "nada que se repete neste cartão"
      }
      info="compras parceladas e assinaturas: cada parcela cai na fatura do vencimento seguinte à compra. mudar ou encerrar vale daqui pra frente. compras avulsas você lança pelo botão de adicionar."
    >
      {series.length > 0 && (
        <p className="mt-0.5 text-xs lowercase text-fg-muted">
          <Brl value={total} /> na próxima cobrança de cada uma
        </p>
      )}
      <ul className="mt-3 flex flex-col divide-y divide-border-base">
        {series.map((s) => (
          <SeriesRow
            key={s.groupId}
            series={s}
            cards={cards}
            today={today}
            onUpdate={onUpdateSeries}
            onEnd={onEndSeries}
          />
        ))}
      </ul>
      {adding ? (
        <AddForm
          kind="cartao"
          cards={ordered}
          today={today}
          onCancel={() => setAdding(false)}
          onCreate={onCreate}
        />
      ) : (
        <AddButton
          label="nova compra parcelada ou assinatura"
          onClick={() => setAdding(true)}
        />
      )}
    </Tile>
  );
}

/* ------------------------------------------------------------------ */

function SeriesRow({
  series: s,
  cards,
  today,
  onUpdate,
  onEnd,
}: {
  series: Series;
  cards: Card[];
  today: Date;
  onUpdate: FixedViewProps["onUpdateSeries"];
  onEnd: FixedViewProps["onEndSeries"];
}) {
  const [mode, setMode] = useState<"ver" | "editar" | "encerrar">("ver");
  const [name, setName] = useState(s.label);
  const [amount, setAmount] = useState(s.amount);
  const [day, setDay] = useState(String(s.day));
  const [conjuge, setConjuge] = useState(s.conjuge);
  const [essencial, setEssencial] = useState(s.essencial);
  // Ao encerrar: apagar também a ocorrência deste mês que já passou.
  const [incluirMes, setIncluirMes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const from = s.nextDate ?? toDateStr(today);
  const card = s.cardId ? cards.find((c) => c.id === s.cardId) : null;
  const last = fromDateStr(s.lastDate);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      setMode("ver");
    } catch {
      setError("não deu certo. tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="py-2.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium lowercase">{s.label}</p>
          <p className="text-[11px] lowercase text-fg-subtle">
            {s.essencial && (
              <span className="mr-1 rounded-full bg-[var(--entrada-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--entrada)]">
                essencial
              </span>
            )}
            {s.conjuge && s.type !== "entrada" && (
              <span className="mr-1 rounded-full bg-[var(--ov-blue-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ov-blue)]">
                esposa
              </span>
            )}
            todo dia {s.day}
            {card && ` · ${card.name}`}
            {" · "}
            {s.nextDate === null
              ? "acabou"
              : s.semFim
                ? "sem fim"
                : `faltam ${s.restantes} · até ${monthShortLabel(last.getFullYear(), last.getMonth())}`}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular">
          <Brl value={s.amount} />
        </span>
        {s.nextDate !== null && mode === "ver" && (
          <>
            <IconButton
              label={`Mudar ${s.label}`}
              onClick={() => setMode("editar")}
            >
              <Pencil size={15} />
            </IconButton>
            <IconButton
              label={`Encerrar ${s.label}`}
              onClick={() => setMode("encerrar")}
              danger
            >
              <Trash2 size={15} />
            </IconButton>
          </>
        )}
      </div>

      {mode === "editar" && (
        <form
          className="animate-fade-in mt-2 flex flex-col gap-2 rounded-xl bg-surface-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const dayNum = Number(day);
            if (!name.trim() || amount <= 0 || !(dayNum >= 1 && dayNum <= 31))
              return setError("confira nome, valor e dia.");
            void run(() =>
              onUpdate(s.groupId, from, {
                description: name.trim() !== s.label ? name.trim() : undefined,
                amount: amount !== s.amount ? amount : undefined,
                day: dayNum !== s.day ? dayNum : undefined,
                conjuge: conjuge !== s.conjuge ? conjuge : undefined,
                essencial: essencial !== s.essencial ? essencial : undefined,
              }),
            );
          }}
        >
          <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_8rem_4.5rem]">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${inputClass} col-span-2 sm:col-span-1`}
              aria-label="Nome"
            />
            <MoneyField value={amount} onChange={setAmount} />
            <input
              value={day}
              onChange={(e) =>
                setDay(e.target.value.replace(/\D/g, "").slice(0, 2))
              }
              inputMode="numeric"
              className={inputClass}
              aria-label="Dia"
              placeholder="dia"
            />
          </div>
          <OwnerPicker conjuge={conjuge} onChange={setConjuge} />
          {s.type !== "entrada" && (
            <EssentialPicker essencial={essencial} onChange={setEssencial} />
          )}
          <p className="text-[11px] lowercase text-fg-subtle">
            vale a partir de {formatDayMonth(from)}. o que já passou não muda.
          </p>
          <FormActions
            busy={busy}
            error={error}
            onCancel={() => setMode("ver")}
            submitLabel="salvar"
          />
        </form>
      )}

      {mode === "encerrar" && (
        <div
          className="animate-fade-in mt-2 flex flex-col gap-2 rounded-xl p-3"
          style={{ background: "var(--saida-soft)" }}
        >
          <p className="text-xs lowercase">
            encerrar <strong>{s.label}</strong> a partir de{" "}
            {formatDayMonth(from)}?{" "}
            {s.semFim
              ? "ela para de se repetir"
              : `as ${s.restantes} parcelas que faltam somem`}
            ; o que já passou fica.
          </p>
          {s.passadaNoMes && (
            <label className="flex items-center gap-2 text-xs lowercase">
              <input
                type="checkbox"
                checked={incluirMes}
                onChange={(e) => setIncluirMes(e.target.checked)}
                className="size-4 accent-[var(--saida)]"
              />
              apagar também a deste mês ({formatDayMonth(s.passadaNoMes)})
            </label>
          )}
          <FormActions
            busy={busy}
            error={error}
            onCancel={() => setMode("ver")}
            submitLabel="encerrar"
            danger
            onSubmit={() =>
              void run(() =>
                onEnd(
                  s.groupId,
                  incluirMes && s.passadaNoMes ? s.passadaNoMes : from,
                ),
              )
            }
          />
        </div>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */

function AddForm({
  kind,
  cards,
  today,
  onCancel,
  onCreate,
}: {
  kind: Kind;
  cards: Card[];
  today: Date;
  onCancel: () => void;
  onCreate: (payload: TransactionPayload) => Promise<void>;
}) {
  const thisMonth = toDateStr(today).slice(0, 7);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  const [day, setDay] = useState(String(today.getDate()));
  const [month, setMonth] = useState(thisMonth);
  const [semFim, setSemFim] = useState(kind !== "cartao");
  const [conjuge, setConjuge] = useState(false);
  const [essencial, setEssencial] = useState(false);
  const [count, setCount] = useState(kind === "cartao" ? "3" : "12");
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCard = kind === "cartao";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dayNum = Number(day);
    const n = Number(count);
    if (!name.trim()) return setError("dê um nome.");
    if (amount <= 0) return setError("informe o valor.");
    if (!(dayNum >= 1 && dayNum <= 31)) return setError("o dia vai de 1 a 31.");
    if (!semFim && !(n >= 2 && n <= 360)) return setError("de 2 a 360 vezes.");
    if (isCard && !cardId) return setError("escolha o cartão.");
    const [y, m] = month.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    const date = toDateStr(new Date(y, m - 1, Math.min(dayNum, last)));

    setBusy(true);
    setError(null);
    try {
      await onCreate({
        date,
        type: kind as TxType,
        amount,
        description: name.trim(),
        cardId: isCard ? cardId : null,
        repeatFrequency: "mensal",
        repeatCount: semFim ? undefined : n,
        isIndeterminate: semFim,
        conjuge,
        essencial: kind !== "entrada" ? essencial : undefined,
      });
      onCancel();
    } catch {
      setError("não deu certo. tente de novo.");
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="animate-fade-in mt-3 flex flex-col gap-2 rounded-xl bg-surface-2 p-3"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={inputClass}
        placeholder={
          kind === "entrada"
            ? "nome (ex.: salário)"
            : isCard
              ? "nome (ex.: celular, spotify)"
              : "nome (ex.: aluguel)"
        }
        aria-label="Nome"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] lowercase text-fg-muted">
            {isCard ? "valor de cada parcela" : "valor por mês"}
          </span>
          <MoneyField value={amount} onChange={setAmount} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] lowercase text-fg-muted">
            {isCard ? "dia da compra" : "dia em que cai"}
          </span>
          <input
            value={day}
            onChange={(e) =>
              setDay(e.target.value.replace(/\D/g, "").slice(0, 2))
            }
            inputMode="numeric"
            className={inputClass}
          />
        </label>
        <label className="col-span-2 flex flex-col gap-1 sm:col-span-1">
          <span className="text-[11px] lowercase text-fg-muted">
            {isCard ? "mês da 1ª parcela" : "começa em"}
          </span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || thisMonth)}
            className={inputClass}
          />
        </label>
      </div>
      {isCard && (
        <select
          value={cardId}
          onChange={(e) => setCardId(e.target.value)}
          className={inputClass}
          aria-label="Cartão"
        >
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <OwnerPicker conjuge={conjuge} onChange={setConjuge} />
      {kind !== "entrada" && (
        <EssentialPicker essencial={essencial} onChange={setEssencial} />
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs lowercase">
        <Segment active={semFim} onClick={() => setSemFim(true)}>
          {isCard ? "assinatura, todo mês" : "todo mês, sem fim"}
        </Segment>
        <Segment active={!semFim} onClick={() => setSemFim(false)}>
          {isCard ? "parcelado em" : "por um tempo"}
        </Segment>
        {!semFim && (
          <span className="flex items-center gap-1.5">
            <input
              value={count}
              onChange={(e) =>
                setCount(e.target.value.replace(/\D/g, "").slice(0, 3))
              }
              inputMode="numeric"
              className={`${inputClass} w-16 text-center`}
              aria-label="Quantas vezes"
            />
            {isCard ? "vezes" : "meses"}
          </span>
        )}
      </div>
      {amount > 0 && !semFim && Number(count) > 1 && (
        <p className="text-[11px] lowercase text-fg-subtle">
          total:{" "}
          <span className="normal-case">
            {formatCurrency(amount * Number(count))}
          </span>
        </p>
      )}
      <FormActions
        busy={busy}
        error={error}
        onCancel={onCancel}
        submitLabel="adicionar"
      />
    </form>
  );
}

/* ------------------------------------------------------------------ */

const inputClass =
  "w-full min-w-0 rounded-lg border border-border-base bg-surface px-3 py-2 text-sm lowercase outline-none focus:border-border-strong";

function MoneyField({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      inputMode="numeric"
      className={`${inputClass} normal-case tabular`}
      placeholder="R$ 0,00"
      aria-label="Valor"
      value={value > 0 ? formatCurrency(value) : ""}
      onChange={(e) =>
        onChange(
          Number(e.target.value.replace(/\D/g, "").slice(0, 12) || "0") / 100,
        )
      }
    />
  );
}

function Segment({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 transition-colors ${
        active
          ? "border-[var(--ov-blue)] bg-[var(--ov-blue-soft)] text-[var(--ov-blue)]"
          : "border-border-base text-fg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function FormActions({
  busy,
  error,
  onCancel,
  submitLabel,
  danger,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  submitLabel: string;
  danger?: boolean;
  /** Sem form em volta (confirmação de encerrar). */
  onSubmit?: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      {error && (
        <span
          className="mr-auto text-xs lowercase"
          style={{ color: "var(--saida)" }}
        >
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs lowercase text-fg-muted hover:bg-surface-3"
      >
        <X size={14} /> cancelar
      </button>
      <button
        type={onSubmit ? "button" : "submit"}
        onClick={onSubmit}
        disabled={busy}
        className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold lowercase text-white disabled:opacity-50"
        style={{ background: danger ? "var(--saida)" : "var(--ov-blue)" }}
      >
        <Check size={14} /> {busy ? "salvando..." : submitLabel}
      </button>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong py-2.5 text-sm lowercase text-fg-muted hover:bg-surface-2"
    >
      <Plus size={15} /> {label}
    </button>
  );
}

function IconButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid size-9 shrink-0 place-items-center rounded-full text-fg-subtle transition-colors md:size-8 ${
        danger
          ? "hover:bg-saida-soft hover:text-saida"
          : "hover:bg-surface-3 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

/** Quem é o responsável: você ou a esposa. */
function OwnerPicker({
  conjuge,
  onChange,
}: {
  conjuge: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs lowercase">
      <span className="text-fg-muted">de quem:</span>
      <Segment active={!conjuge} onClick={() => onChange(false)}>
        eu
      </Segment>
      <Segment active={conjuge} onClick={() => onChange(true)}>
        esposa
      </Segment>
    </div>
  );
}

/** Essencial: a conta entra no custo de vida que a reserva precisa cobrir. */
function EssentialPicker({
  essencial,
  onChange,
}: {
  essencial: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs lowercase">
      <input
        type="checkbox"
        checked={essencial}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--entrada)]"
      />
      essencial
      <span className="text-fg-subtle">
        · não dá para cortar; entra no cálculo da reserva
      </span>
    </label>
  );
}
