"use client";

import { useState } from "react";
import { Check, CreditCard, Pencil, Plus, Trash2, X } from "lucide-react";
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
import type { TransactionPayload } from "@/hooks/useFinanceData";
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
    },
  ) => Promise<void>;
  onEndSeries: (groupId: string, from: string) => Promise<void>;
  onCreateCard: () => void;
  onEditCard: (card: Card) => void;
  onDeleteCard: (card: Card) => void;
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
  const sobra = renda - contas - noCartao;

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className="grid grid-cols-1 items-start gap-3 md:gap-4 lg:grid-cols-2">
        <Tile
          title="o mês no automático"
          subtitle="só o que é fixo, neste mês"
          info="soma do que está cadastrado aqui e cai neste mês: rendas, contas fixas e compras no cartão que se repetem (pelo dia da compra). o que sobra é o espaço para o dia a dia, os gastos avulsos e o que você quer guardar."
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
              hint="dia a dia, avulsos e guardar"
            />
          </div>
        </Tile>

        <SeriesTile
          kind="entrada"
          title="rendas"
          subtitle="salário, bolsa, o que entra todo mês"
          addLabel="nova renda"
          info="entradas que se repetem. com número de meses (uma bolsa, por exemplo) elas acabam sozinhas; sem fim, repetem até você encerrar."
          series={rendas}
          {...props}
        />

        <SeriesTile
          kind="saida"
          title="contas fixas"
          subtitle="aluguel, internet, mercado do mês"
          addLabel="nova conta"
          info="saídas que se repetem: saem do saldo no dia marcado. o que o plano do apartamento gera aparece na tela do apartamento."
          series={saidas}
          {...props}
        />

        <CardsTile {...props} series={cartao} />
      </div>
    </div>
  );
}

/** Entradas ligadas a cofre são resgates, não renda. */
function isVaultSeries(transactions: Transaction[], s: Series): boolean {
  return transactions.some((t) => t.groupId === s.groupId && t.vaultId);
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

function CardsTile(props: FixedViewProps & { series: Series[] }) {
  const { cards, series, onCreateCard, onEditCard, onDeleteCard } = props;
  const [adding, setAdding] = useState(false);

  return (
    <Tile
      title="cartão"
      subtitle="seus cartões e o que se repete neles"
      info="compras parceladas e assinaturas no cartão: cada parcela cai na fatura do vencimento seguinte à compra. compras avulsas no cartão você lança pelo botão de adicionar."
      illustration="credit_card"
    >
      <ul className="mt-3 flex flex-col gap-2">
        {cards.map((card) => (
          <li
            key={card.id}
            className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5"
          >
            <CreditCard size={18} className="shrink-0 text-fg-muted" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold lowercase">
                {card.name}
              </p>
              <p className="text-[11px] lowercase text-fg-subtle">
                vence dia {card.dueDay}
                {card.limit ? (
                  <>
                    {" · limite "}
                    <Brl value={card.limit} />
                  </>
                ) : null}
              </p>
            </div>
            <IconButton
              label={`Editar ${card.name}`}
              onClick={() => onEditCard(card)}
            >
              <Pencil size={15} />
            </IconButton>
            <IconButton
              label={`Excluir ${card.name}`}
              onClick={() => onDeleteCard(card)}
              danger
            >
              <Trash2 size={15} />
            </IconButton>
          </li>
        ))}
      </ul>
      <AddButton label="novo cartão" onClick={onCreateCard} />

      {cards.length > 0 && (
        <>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            parcelas e assinaturas
          </p>
          <ul className="mt-1 flex flex-col divide-y divide-border-base">
            {series.map((s) => (
              <SeriesRow
                key={s.groupId}
                series={s}
                cards={cards}
                today={props.today}
                onUpdate={props.onUpdateSeries}
                onEnd={props.onEndSeries}
              />
            ))}
          </ul>
          {series.length === 0 && !adding && (
            <p className="mt-2 text-sm lowercase text-fg-subtle">
              nenhuma parcela ou assinatura.
            </p>
          )}
          {adding ? (
            <AddForm
              kind="cartao"
              cards={cards}
              today={props.today}
              onCancel={() => setAdding(false)}
              onCreate={props.onCreate}
            />
          ) : (
            <AddButton
              label="nova compra parcelada ou assinatura"
              onClick={() => setAdding(true)}
            />
          )}
        </>
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
          {s.type === "entrada" && (
            <OwnerPicker conjuge={conjuge} onChange={setConjuge} />
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
          <FormActions
            busy={busy}
            error={error}
            onCancel={() => setMode("ver")}
            submitLabel="encerrar"
            danger
            onSubmit={() => void run(() => onEnd(s.groupId, from))}
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
        conjuge: kind === "entrada" ? conjuge : undefined,
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
      {kind === "entrada" && (
        <OwnerPicker conjuge={conjuge} onChange={setConjuge} />
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

/** De quem é a renda: sua ou da esposa. */
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
        minha
      </Segment>
      <Segment active={conjuge} onClick={() => onChange(true)}>
        da esposa
      </Segment>
    </div>
  );
}
