"use client";

import { useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { formatDayMonth, formatPercent, monthLongLabel, fromDateStr } from "@/lib/format";
import type { CardLimitUsage } from "@/lib/ledger";
import { billTimeline, openBill, subscriptions, type TimelineBill } from "@/lib/insights";
import { Brl } from "@/components/ui/Brl";
import { BigMoney, CardArt, Stat, Tile } from "@/components/ui/Dashboard";
import type { Card, Transaction } from "@/lib/types";

interface CardsViewProps {
  cards: Card[];
  usage: CardLimitUsage[];
  transactions: Transaction[];
  today: Date;
  onCreate: () => void;
  onEdit: (card: Card) => void;
  onDelete: (card: Card) => void;
  onSelectDay: (dateStr: string) => void;
}

export function CardsView({ cards, usage, transactions, today, onCreate, onEdit, onDelete, onSelectDay }: CardsViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const card = cards.find((c) => c.id === selectedId) ?? cards[0] ?? null;

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2 md:mb-4">
        {cards.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedId(c.id)}
            aria-pressed={c.id === card?.id}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium lowercase transition-colors ${
              c.id === card?.id
                ? "border-[var(--ov-blue)] bg-[var(--ov-blue-soft)] text-[var(--ov-blue)]"
                : "border-border-base text-fg-muted hover:bg-surface-2"
            }`}
          >
            {c.name}
          </button>
        ))}
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-1.5 rounded-full border border-dashed border-border-strong px-4 py-1.5 text-sm lowercase text-fg-muted hover:bg-surface-2"
        >
          <Plus size={15} /> novo cartão
        </button>
      </div>

      {card ? (
        <CardPanel
          key={card.id}
          card={card}
          usage={usage.find((u) => u.card.id === card.id) ?? null}
          transactions={transactions}
          today={today}
          onEdit={() => onEdit(card)}
          onDelete={() => onDelete(card)}
          onSelectDay={onSelectDay}
        />
      ) : (
        <div className="rounded-3xl border border-dashed border-border-strong px-6 py-12 text-center">
          <p className="text-sm lowercase text-fg-muted">
            nenhum cartão cadastrado.
            <br />
            sem cartão, os gastos de cartão saem do saldo no próprio dia da compra.
          </p>
        </div>
      )}
    </div>
  );
}

function CardPanel({
  card,
  usage,
  transactions,
  today,
  onEdit,
  onDelete,
  onSelectDay,
}: {
  card: Card;
  usage: CardLimitUsage | null;
  transactions: Transaction[];
  today: Date;
  onEdit: () => void;
  onDelete: () => void;
  onSelectDay: (dateStr: string) => void;
}) {
  const bill = useMemo(() => openBill(transactions, card, today), [transactions, card, today]);
  const timeline = useMemo(() => billTimeline(transactions, card, today), [transactions, card, today]);
  const subs = useMemo(() => subscriptions(transactions, card, today), [transactions, card, today]);
  const usadoPct = usage?.limite ? Math.min(Math.max(usage.emAberto / usage.limite, 0), 1) : null;
  const due = fromDateStr(bill.dueDate);
  const mesFatura = monthLongLabel(due.getFullYear(), due.getMonth()).split(" ")[0];
  const conhecido = bill.lancado + bill.futuro;

  return (
    <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-2">
      <Tile
        title="cartão"
        subtitle={usage?.limite ? undefined : "limite não informado"}
        info="o limite livre desconta o que já foi cobrado no cartão e ainda não venceu. parcelas e assinaturas dos próximos meses só contam quando forem cobradas. neste app a compra cai no primeiro vencimento igual ou posterior ao dia em que foi feita."
      >
        <div className="absolute top-4 right-4 flex gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Editar ${card.name}`}
            className="grid size-8 place-items-center rounded-full text-fg-subtle hover:bg-surface-3 hover:text-fg"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Excluir ${card.name}`}
            className="grid size-8 place-items-center rounded-full text-fg-subtle hover:bg-saida-soft hover:text-saida"
          >
            <Trash2 size={15} />
          </button>
        </div>
        {usage?.limite && (
          <p className="text-xs lowercase text-fg-muted">
            limite de <Brl value={usage.limite} />
          </p>
        )}
        <CardArt
          name={card.name}
          usadoPct={usadoPct}
          vence={formatDayMonth(bill.dueDate)}
          livre={usage?.livre ?? null}
          className="mt-4"
        />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat
            label="limite livre"
            value={usage?.livre !== null && usage?.livre !== undefined ? <Brl value={usage.livre} /> : "—"}
            hint={usadoPct !== null ? `${formatPercent(usadoPct * 100, 0)} do limite em uso` : "informe o limite no cartão"}
            color={usage?.livre !== null && (usage?.livre ?? 0) < 0 ? "var(--saida)" : undefined}
          />
          <Stat
            label="em uso"
            value={<Brl value={usage?.emAberto ?? 0} />}
            hint="o que já foi cobrado e ainda não venceu"
          />
          <Stat
            label="vence em"
            value={formatDayMonth(bill.dueDate)}
            hint={bill.diasParaVencer === 0 ? "hoje" : `em ${bill.diasParaVencer} dias`}
            onClick={() => onSelectDay(bill.dueDate)}
          />
          <Stat label="vence todo dia" value={card.dueDay} hint="compras até o vencimento entram nele" />
        </div>
      </Tile>

      <Tile
        title={`fatura de ${mesFatura}`}
        subtitle={`aberta · vence em ${formatDayMonth(bill.dueDate)}`}
        info="o que já está lançado nesta fatura, o que já está marcado para cair nela (parcelas e repetições) e uma estimativa do dia a dia até o vencimento, pela média de compras avulsas das últimas três faturas."
        illustration="credit_card"
      >
        <div className="mt-6">
          <BigMoney value={bill.total} size="lg" />
          {bill.estimativa > 0 && <p className="mt-1 text-xs lowercase text-fg-muted">prevista, com a estimativa do dia a dia</p>}
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full"
            style={{ width: `${bill.total > 0 ? (conhecido / bill.total) * 100 : 0}%`, background: "var(--ov-blue)" }}
          />
        </div>
        <p className="mt-2 text-xs lowercase text-fg-muted">
          {bill.diasParaVencer === 0 ? "vence hoje." : `faltam ${bill.diasParaVencer} dias para vencer.`}
        </p>

        <ul className="mt-4 flex flex-col divide-y divide-border-base">
          <BillRow
            color="var(--ov-navy)"
            label="já lançado"
            hint={`${bill.lancadoCount} ${bill.lancadoCount === 1 ? "compra" : "compras"} neste ciclo`}
            value={<Brl value={bill.lancado} />}
          />
          <BillRow
            color="var(--ov-blue)"
            label="parcelas e repetições que vão cair"
            hint={bill.futuroLabels.length > 0 ? bill.futuroLabels.join(" · ") : "nada marcado ainda"}
            value={<Brl value={bill.futuro} />}
          />
          <BillRow
            color="var(--ov-sky)"
            label="dia a dia até vencer"
            hint={
              bill.mediaMensal > 0 ? (
                <>
                  estimativa pela média de <Brl value={bill.mediaMensal} /> por mês
                </>
              ) : (
                "sem faturas anteriores para estimar"
              )
            }
            value={
              <>
                ~<Brl value={bill.estimativa} />
              </>
            }
          />
        </ul>
        <button
          type="button"
          onClick={() => onSelectDay(bill.dueDate)}
          className="mt-4 w-fit rounded-lg border border-border-base px-3 py-1.5 text-xs font-medium lowercase hover:bg-surface-2"
        >
          ver lançamentos da fatura
        </button>
      </Tile>

      <Tile
        title="linha do tempo"
        subtitle="a última que venceu, a aberta e as próximas"
        info="cada fatura pelo dia em que vence. as próximas só têm o que já está lançado: parcelas e repetições. o dia a dia delas ainda não aconteceu."
      >
        <ul className="mt-4 flex flex-col divide-y divide-border-base">
          {timeline.map((t) => (
            <TimelineRow key={t.dueDate} bill={t} today={today} onSelect={() => onSelectDay(t.dueDate)} />
          ))}
        </ul>
      </Tile>

      <Tile
        title="assinaturas"
        subtitle={
          subs.length > 0
            ? undefined
            : "nenhuma cobrança que se repete"
        }
        info="o que cai todo mês neste cartão: repetições lançadas no app (sem as parceladas) e compras do banco que aparecem em meses diferentes com valor parecido."
      >
        {subs.length > 0 && (
          <p className="mt-0.5 text-xs lowercase text-fg-muted">
            ~<Brl value={subs.reduce((sum, s) => sum + s.amount, 0)} /> por mês, já dentro da fatura
          </p>
        )}
        <ul className="mt-4 flex flex-col divide-y divide-border-base">
          {subs.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium lowercase">{s.label}</p>
                <p className="text-[11px] lowercase text-fg-subtle">
                  todo dia {s.day}
                  {s.origem === "banco" && " · achada no banco"}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular">
                <Brl value={s.amount} />
              </span>
            </li>
          ))}
        </ul>
        {subs.length === 0 && (
          <p className="mt-4 text-sm lowercase text-fg-subtle">
            quando uma compra aparecer em meses seguidos com o mesmo valor, ela entra aqui.
          </p>
        )}
      </Tile>
    </div>
  );
}

function BillRow({
  color,
  label,
  hint,
  value,
}: {
  color: string;
  label: string;
  hint: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex min-w-0 items-start gap-2">
        <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: color }} />
        <div className="min-w-0">
          <p className="text-sm font-medium lowercase">{label}</p>
          <p className="truncate text-[11px] lowercase text-fg-subtle">{hint}</p>
        </div>
      </div>
      <span className="shrink-0 text-sm font-semibold tabular">{value}</span>
    </li>
  );
}

const STATE_STYLE: Record<TimelineBill["state"], { label: string; color: string; bg: string }> = {
  paga: { label: "paga", color: "var(--entrada)", bg: "var(--entrada-soft)" },
  aberta: { label: "aberta", color: "var(--ov-blue)", bg: "var(--ov-blue-soft)" },
  prevista: { label: "prevista", color: "var(--fg-muted)", bg: "var(--surface-3)" },
};

function TimelineRow({ bill, today, onSelect }: { bill: TimelineBill; today: Date; onSelect: () => void }) {
  const style = STATE_STYLE[bill.state];
  const paga = bill.state === "paga";
  const d = fromDateStr(bill.dueDate);
  const nome = monthLongLabel(d.getFullYear(), d.getMonth());
  const thisYear = d.getFullYear() === today.getFullYear();

  return (
    <li>
      <button type="button" onClick={onSelect} className="flex w-full items-center gap-3 py-3 text-left hover:bg-surface-2">
        <span
          className={`grid size-5 shrink-0 place-items-center rounded-full border ${
            paga ? "border-transparent bg-[var(--entrada)] text-white" : "border-border-strong"
          }`}
        >
          {paga && <Check size={12} strokeWidth={3} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium lowercase">
            <span className={paga ? "text-fg-subtle line-through" : ""}>
              {thisYear ? nome.split(" ")[0] : nome.replace(" de ", " ")}
            </span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: style.color, background: style.bg }}>
              {style.label}
            </span>
          </p>
          <p className="text-[11px] lowercase text-fg-subtle">
            vence {formatDayMonth(bill.dueDate)}
            {bill.parcelas > 0 && (
              <>
                {" · "}
                {bill.parcelas} {bill.parcelas === 1 ? "parcela" : "parcelas"}: <Brl value={bill.parcelasValor} />
              </>
            )}
            {bill.count === 0 && " · nada lançado"}
          </p>
        </div>
        <span className={`shrink-0 text-sm font-semibold tabular ${paga ? "text-fg-subtle line-through" : ""}`}>
          <Brl value={bill.amount} />
        </span>
      </button>
    </li>
  );
}
