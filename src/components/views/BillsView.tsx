"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Repeat, X } from "lucide-react";
import { formatDayMonth, toDateStr } from "@/lib/format";
import { billsOfMonth, type BillItem, type MonthEntry } from "@/lib/ledger";
import {
  fixedBills,
  payeeLabel,
  recurringCandidates,
  type FixedBill,
  type RecurringCandidate,
} from "@/lib/insights";
import { Brl } from "@/components/ui/Brl";
import { BigMoney, Tile } from "@/components/ui/Dashboard";
import type { Card, Transaction } from "@/lib/types";

/** Sugestões que você dispensou ficam guardadas só neste navegador. */
const DISMISSED_KEY = "contas:dispensadas";

function loadDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? "[]");
    return Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

const KIND_LABEL: Record<FixedBill["kind"], string> = {
  fixa: "conta fixa",
  parcelada: "parcelada",
  apartamento: "apartamento",
};

interface BillsViewProps {
  month: MonthEntry | null;
  cards: Card[];
  transactions: Transaction[];
  today: Date;
  onTogglePaid: (ids: string[], paid: boolean) => void;
  onSelectDay: (dateStr: string) => void;
  /** Abre o formulário já preenchido como conta que se repete todo mês. */
  onAddRecurring: (candidate: RecurringCandidate) => void;
}

export function BillsView({
  month,
  cards,
  transactions,
  today,
  onTogglePaid,
  onSelectDay,
  onAddRecurring,
}: BillsViewProps) {
  const [dismissed, setDismissed] = useState<string[]>(loadDismissed);
  const [showPaid, setShowPaid] = useState(false);
  const todayStr = toDateStr(today);

  const items = useMemo(() => {
    if (!month) return [];
    return billsOfMonth(month, cards).flatMap((day) =>
      day.items.map((item) => ({ item, day })),
    );
  }, [month, cards]);
  const fixed = useMemo(
    () => fixedBills(transactions, today),
    [transactions, today],
  );
  const candidates = useMemo(
    () =>
      recurringCandidates(transactions, today).filter(
        (c) => !dismissed.includes(c.key),
      ),
    [transactions, today, dismissed],
  );
  const oneOff = useMemo(() => {
    const limit = toDateStr(
      new Date(today.getFullYear(), today.getMonth(), today.getDate() + 90),
    );
    return transactions
      .filter(
        (t) =>
          t.type === "saida" &&
          !t.groupId &&
          !t.source &&
          t.date > todayStr &&
          t.date <= limit,
      )
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [transactions, today, todayStr]);

  if (!month) return null;
  const isPastMonth = month.days[month.days.length - 1]?.dateStr < todayStr;
  // Meses que já passaram contam como pagos, como no resto do app.
  const isPaid = (item: BillItem) => item.paid || isPastMonth;
  const pagas = items.filter(({ item }) => isPaid(item));
  const abertas = items.filter(({ item }) => !isPaid(item));
  // As em aberto primeiro; as pagas ficam recolhidas (num mês passado, todas aparecem).
  const visibleItems =
    showPaid || abertas.length === 0 ? [...abertas, ...pagas] : abertas;
  const valorPago = pagas.reduce((sum, { item }) => sum + item.amount, 0);
  const total = items.reduce((sum, { item }) => sum + item.amount, 0);
  const emAberto = total - valorPago;
  const mes = month.longLabel.split(" ")[0];

  const dismiss = (key: string) => {
    const next = [...dismissed, key];
    setDismissed(next);
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  };

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className="grid grid-cols-1 items-start gap-3 md:gap-4 lg:grid-cols-2">
        <Tile
          key="mes"
          title={`contas de ${mes}`}
          subtitle={`${pagas.length} de ${items.length} pagas`}
          info="tudo o que sai da conta no mês: contas, parcelas e a fatura inteira de cada cartão no vencimento. marcar como paga é só registro: não muda o saldo previsto. meses que já passaram contam como pagos."
          illustration="spiral_calendar"
        >
          {valorPago > 0 && (
            <p className="-mt-0.5 text-xs lowercase text-fg-muted">
              <Brl value={valorPago} /> pagos
            </p>
          )}
          <div className="mt-6">
            <BigMoney value={emAberto} size="lg" />
            <p className="mt-1 text-xs lowercase text-fg-muted">em aberto</p>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full"
              style={{
                width: `${total > 0 ? (valorPago / total) * 100 : 0}%`,
                background: "var(--entrada)",
              }}
            />
          </div>

          <ul className="mt-4 flex flex-col divide-y divide-border-base">
            {visibleItems.map(({ item, day }) => {
              const paid = isPaid(item);
              const late = !paid && day.dateStr < todayStr;
              const dias = Math.round(
                (new Date(day.dateStr).getTime() -
                  new Date(todayStr).getTime()) /
                  86_400_000,
              );
              return (
                <li key={item.id} className="flex items-center gap-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => onTogglePaid(item.txIds, !item.paid)}
                    disabled={isPastMonth}
                    aria-label={
                      paid
                        ? `Desmarcar ${item.label}`
                        : `Marcar ${item.label} como paga`
                    }
                    className={`grid size-5 shrink-0 place-items-center rounded-full border transition-colors ${
                      paid
                        ? "border-transparent bg-[var(--entrada)] text-white"
                        : "border-border-strong hover:border-fg"
                    }`}
                  >
                    {paid && <Check size={12} strokeWidth={3} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectDay(day.dateStr)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span
                      className={`block truncate text-sm font-medium lowercase ${paid ? "text-fg-subtle line-through" : ""}`}
                    >
                      {item.type === "cartao"
                        ? item.label
                        : payeeLabel(item.label)}
                    </span>
                    <span className="block text-[11px] lowercase text-fg-subtle">
                      dia {day.day} ·{" "}
                      {item.type === "cartao"
                        ? `fatura · ${item.count} ${item.count === 1 ? "compra" : "compras"}`
                        : "conta"}
                      {late && (
                        <span style={{ color: "var(--saida)" }}> · venceu</span>
                      )}
                      {!paid && !late && dias >= 0 && dias <= 7 && (
                        <span style={{ color: "#ea580c" }}>
                          {" "}
                          ·{" "}
                          {dias === 0
                            ? "hoje"
                            : dias === 1
                              ? "amanhã"
                              : `em ${dias} dias`}
                        </span>
                      )}
                    </span>
                  </button>
                  <span
                    className={`shrink-0 text-sm font-semibold tabular ${paid ? "text-fg-subtle line-through" : ""}`}
                  >
                    <Brl value={item.amount} />
                  </span>
                </li>
              );
            })}
          </ul>
          {pagas.length > 0 && abertas.length > 0 && (
            <button
              type="button"
              onClick={() => setShowPaid((v) => !v)}
              className="mx-auto mt-3 text-xs font-medium lowercase text-fg-muted hover:text-fg"
            >
              {showPaid ? "esconder as pagas" : `ver as ${pagas.length} pagas`}
            </button>
          )}
          {items.length === 0 && (
            <p className="mt-4 text-sm lowercase text-fg-subtle">
              nenhuma conta neste mês.
            </p>
          )}
        </Tile>

        <div className="flex min-w-0 flex-col gap-3 md:gap-4">
          <Tile
            title="encontradas no banco"
            subtitle="pagamentos que se repetem e ainda não estão nas contas fixas"
            info="saídas que vieram do banco pelo open finance e aparecem em meses diferentes com valor parecido. adicionar cria uma conta que se repete todo mês; o x esconde a sugestão neste navegador."
          >
            <ul className="mt-4 flex flex-col divide-y divide-border-base">
              {candidates.map((c) => (
              <li key={c.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                <Repeat size={16} className="shrink-0 text-[var(--ov-blue)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium lowercase">{c.label}</p>
                  <p className="text-[11px] lowercase text-fg-subtle">
                    {c.months} meses seguidos · por volta do dia {c.day}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular">
                  ~<Brl value={c.amount} />
                </span>
                {/* No celular os botões ganham uma linha só deles. */}
                <div className="flex basis-full items-center justify-end gap-1 sm:basis-auto">
                  <button
                    type="button"
                    onClick={() => onAddRecurring(c)}
                    className="rounded-lg px-3 py-2 text-xs font-semibold lowercase text-white sm:py-1.5"
                    style={{ background: "var(--ov-blue)" }}
                  >
                    adicionar
                  </button>
                  <button
                    type="button"
                    onClick={() => dismiss(c.key)}
                    aria-label={`Dispensar ${c.label}`}
                    className="grid size-9 place-items-center rounded-full text-fg-subtle hover:bg-surface-3 hover:text-fg sm:size-7"
                  >
                    <X size={14} />
                  </button>
                </div>
              </li>
            ))}
            </ul>
            {candidates.length === 0 && (
              <p className="mt-4 text-sm lowercase text-fg-subtle">
                nada novo. com mais meses de banco conectado, as contas que se
                repetem aparecem aqui.
              </p>
            )}
          </Tile>

          <Tile
            title="contas fixas"
            info="saídas que se repetem: as lançadas com repetição, as parcelas e o que o plano do apartamento gera. mostra a próxima de cada uma. toque para abrir o dia e editar."
          >
            <p className="-mt-0.5 text-xs lowercase text-fg-muted">
              <Brl
                value={fixed
                  .filter((f) => f.restantes !== 0)
                  .reduce((sum, f) => sum + f.amount, 0)}
              />{" "}
              por mês
            </p>
            <ul className="mt-4 flex flex-col divide-y divide-border-base">
              {fixed.map((f) => (
                <li key={f.key}>
                  <button
                    type="button"
                    onClick={() => onSelectDay(f.nextDate)}
                    className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium lowercase">
                        {f.label}
                      </span>
                      <span className="block text-[11px] lowercase text-fg-subtle">
                        {KIND_LABEL[f.kind]} · todo dia {f.day}
                        {f.restantes !== null &&
                          (f.restantes > 0
                            ? ` · faltam ${f.restantes}`
                            : " · última já passou")}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular">
                      <Brl value={f.amount} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {fixed.length === 0 && (
              <p className="mt-4 text-sm lowercase text-fg-subtle">
                nenhuma conta com repetição lançada.
              </p>
            )}
          </Tile>

          <Tile
            title="contas com vencimento"
            subtitle="de uma vez só, nos próximos 90 dias"
            info="saídas avulsas lançadas por você com data futura: um boleto, uma matrícula, um imposto."
          >
            <ul className="mt-4 flex flex-col divide-y divide-border-base">
              {oneOff.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onSelectDay(t.date)}
                    className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium lowercase">
                        {t.description}
                      </span>
                      <span className="block text-[11px] lowercase text-fg-subtle">
                        vence {formatDayMonth(t.date)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular">
                      <Brl value={t.amount} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {oneOff.length === 0 && (
              <p className="mt-4 flex items-center gap-1.5 text-sm lowercase text-fg-subtle">
                <Plus size={14} /> nenhuma. lance uma saída com data futura para
                ela aparecer aqui.
              </p>
            )}
          </Tile>
        </div>
      </div>
    </div>
  );
}
