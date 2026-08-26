"use client";

import { useState } from "react";
import { Banknote, CalendarDays, CreditCard, Pencil, Repeat } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { TypeBadge } from "@/components/ui/TypeBadge";
import { dayShortLabel, formatCurrency } from "@/lib/format";
import { nextDueDate } from "@/lib/ledger";
import {
  TX_TYPE_META,
  TX_TYPE_ORDER,
  type Card,
  type Transaction,
  type TxType,
} from "@/lib/types";
import type { TransactionPayload } from "@/hooks/useFinanceData";

type Frequency = "diario" | "semanal" | "mensal";

const FREQUENCY_LABEL: Record<Frequency, string> = {
  diario: "todo dia",
  semanal: "toda semana",
  mensal: "todo mês",
};

const REPEAT_OPTIONS: { value: Frequency | null; label: string }[] = [
  { value: null, label: "não repete" },
  { value: "diario", label: FREQUENCY_LABEL.diario },
  { value: "semanal", label: FREQUENCY_LABEL.semanal },
  { value: "mensal", label: FREQUENCY_LABEL.mensal },
];

const TYPE_OPTIONS = TX_TYPE_ORDER.map((type) => ({
  value: type,
  label: TX_TYPE_META[type].singular,
  icon: <TypeBadge type={type} size={18} />,
}));

interface TransactionModalProps {
  onClose: () => void;
  /** Dia pré-selecionado ao criar. */
  date: string;
  /** Preenchido quando o modal está em modo edição. */
  editing: Transaction | null;
  defaultType?: TxType;
  cards: Card[];
  submitting: boolean;
  onSubmit: (payload: TransactionPayload) => void;
}

export function TransactionModal({
  onClose,
  date,
  editing,
  defaultType = "saida",
  cards,
  submitting,
  onSubmit,
}: TransactionModalProps) {
  // Os centavos são guardados como dígitos crus: digitar 2800 vira R$ 28,00.
  const [amountDigits, setAmountDigits] = useState(() =>
    editing ? String(Math.round(editing.amount * 100)) : "",
  );
  const [type, setType] = useState<TxType>(editing?.type ?? defaultType);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [dateValue, setDateValue] = useState(editing?.date ?? date);
  const [cardId, setCardId] = useState<string | null>(
    () => editing?.cardId ?? cards[0]?.id ?? null,
  );
  const [repeats, setRepeats] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("mensal");
  const [count, setCount] = useState("2");
  const [indeterminate, setIndeterminate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = Number(amountDigits || "0") / 100;
  const meta = TX_TYPE_META[type];

  const selectedCard = cards.find((card) => card.id === cardId) ?? null;
  const chargeDate = selectedCard ? nextDueDate(dateValue, selectedCard.dueDay) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (amount <= 0) return setError("informe um valor maior que zero.");
    if (!description.trim()) return setError("dê um nome ao lançamento.");
    if (repeats && !indeterminate && Number(count) < 2) {
      return setError("a repetição precisa de pelo menos 2 vezes.");
    }

    onSubmit({
      date: dateValue,
      type,
      amount,
      description: description.trim(),
      cardId: type === "cartao" ? cardId : null,
      repeatFrequency: repeats ? frequency : undefined,
      repeatCount: repeats && !indeterminate ? Number(count) : undefined,
      isIndeterminate: repeats && indeterminate,
    });
  };

  return (
    <Modal onClose={onClose} title={editing ? "editar" : "adicionar"}>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6">
          <Row icon={Banknote}>
            <div className="flex flex-1 items-center gap-2">
              <span className="text-xl font-semibold text-fg-muted">R$</span>
              <input
                autoFocus
                inputMode="numeric"
                value={amount > 0 ? formatCurrency(amount).replace("R$", "").trim() : ""}
                placeholder="0,00"
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                  setAmountDigits(digits);
                  setError(null);
                }}
                className="w-full bg-transparent text-xl font-semibold tabular outline-none placeholder:text-fg-subtle"
                aria-label="Valor"
              />
            </div>
          </Row>

          <Row icon={() => <TypeBadge type={type} size={20} />}>
            <div className="flex-1">
              <Select value={type} options={TYPE_OPTIONS} onChange={setType} ariaLabel="Tipo" />
            </div>
          </Row>

          {type === "cartao" && (
            <Row icon={CreditCard} align="start">
              <div className="flex-1">
                {cards.length === 0 ? (
                  <p className="text-sm lowercase text-fg-muted">
                    nenhum cartão cadastrado — o gasto sai no próprio dia. cadastre um em
                    orçamentos para juntar tudo na fatura.
                  </p>
                ) : (
                  <>
                    <Select
                      value={cardId}
                      options={[
                        ...cards.map((card) => ({ value: card.id as string | null, label: card.name })),
                        { value: null, label: "sem cartão" },
                      ]}
                      onChange={setCardId}
                      ariaLabel="Cartão"
                    />
                    <p className="mt-2 text-xs lowercase text-fg-subtle">
                      {chargeDate
                        ? `cobra em ${dayShortLabel(chargeDate)}, no vencimento do cartão`
                        : "sai do saldo no próprio dia da compra"}
                    </p>
                  </>
                )}
              </div>
            </Row>
          )}

          <Row icon={Pencil}>
            <input
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setError(null);
              }}
              placeholder="descrição"
              className="w-full bg-transparent lowercase outline-none placeholder:text-fg-subtle"
              aria-label="Descrição"
            />
          </Row>

          <Row icon={CalendarDays}>
            <label className="flex flex-1 cursor-pointer items-center justify-between gap-2">
              <span className="lowercase text-fg-muted">data</span>
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="cursor-pointer bg-transparent text-right tabular outline-none"
                required
              />
            </label>
          </Row>

          {!editing && (
            <Row icon={Repeat} align="start">
              <div className="flex-1">
                <Select
                  value={repeats ? frequency : null}
                  options={REPEAT_OPTIONS}
                  onChange={(next) => {
                    setRepeats(next !== null);
                    if (next) setFrequency(next);
                  }}
                  ariaLabel="Repetição"
                />

                {repeats && (
                  <div className="animate-fade-in mt-3 space-y-3 pb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm lowercase text-fg-muted">por</span>
                      <input
                        type="number"
                        min={2}
                        max={360}
                        value={count}
                        disabled={indeterminate}
                        onChange={(e) => setCount(e.target.value)}
                        className="w-20 rounded-lg border border-border-base bg-surface-2 px-2 py-1.5 text-sm tabular outline-none disabled:opacity-40"
                      />
                      <span className="text-sm lowercase text-fg-muted">vezes</span>
                    </div>

                    <Toggle
                      checked={indeterminate}
                      onChange={setIndeterminate}
                      label="sem prazo definido"
                    />
                  </div>
                )}
              </div>
            </Row>
          )}

          {error && <p className="pt-3 text-sm lowercase text-saida">{error}</p>}
        </div>

        <div className="shrink-0 p-6 pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full py-3.5 text-base font-semibold lowercase text-white transition-opacity active:scale-[0.99] disabled:opacity-60"
            style={{ background: meta.color }}
          >
            {submitting
              ? "salvando..."
              : editing
                ? "salvar alterações"
                : `adicionar ${meta.singular}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function Row({
  icon: Icon,
  children,
  align = "center",
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  children: React.ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div
      className={`flex gap-3.5 border-b border-border-base py-4 ${
        align === "start" ? "items-start" : "items-center"
      }`}
    >
      <span className={`grid size-5 shrink-0 place-items-center text-fg-subtle ${align === "start" ? "mt-0.5" : ""}`}>
        <Icon size={20} />
      </span>
      {children}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex w-fit cursor-pointer items-center gap-3 text-sm lowercase select-none">
      <span
        className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
        style={{ background: checked ? "var(--entrada)" : "var(--border-strong)" }}
      >
        <span
          className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[1.125rem]" : "translate-x-0.5"
          }`}
        />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span className="text-fg-muted">{label}</span>
    </label>
  );
}
