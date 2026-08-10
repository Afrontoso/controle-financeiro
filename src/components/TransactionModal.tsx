"use client";

import { useEffect, useRef, useState } from "react";
import { Banknote, CalendarDays, ChevronDown, Pencil, Repeat } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { TypeBadge } from "@/components/ui/TypeBadge";
import { formatCurrency } from "@/lib/format";
import { TX_TYPE_META, TX_TYPE_ORDER, type Transaction, type TxType } from "@/lib/types";
import type { TransactionPayload } from "@/hooks/useFinanceData";

type Frequency = "diario" | "semanal" | "mensal";

const FREQUENCY_LABEL: Record<Frequency, string> = {
  diario: "todo dia",
  semanal: "toda semana",
  mensal: "todo mês",
};

interface TransactionModalProps {
  onClose: () => void;
  /** Dia pré-selecionado ao criar. */
  date: string;
  /** Preenchido quando o modal está em modo edição. */
  editing: Transaction | null;
  defaultType?: TxType;
  submitting: boolean;
  onSubmit: (payload: TransactionPayload) => void;
}

export function TransactionModal({
  onClose,
  date,
  editing,
  defaultType = "saida",
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
  const [repeats, setRepeats] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("mensal");
  const [count, setCount] = useState("2");
  const [indeterminate, setIndeterminate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = Number(amountDigits || "0") / 100;
  const meta = TX_TYPE_META[type];

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
            <TypeSelect value={type} onChange={setType} />
          </Row>

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
                <RepeatSelect
                  repeats={repeats}
                  frequency={frequency}
                  onChange={(next) => {
                    setRepeats(next !== null);
                    if (next) setFrequency(next);
                  }}
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

function TypeSelect({ value, onChange }: { value: TxType; onChange: (type: TxType) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const timer = setTimeout(() => document.addEventListener("pointerdown", onPointerDown), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left lowercase"
      >
        {TX_TYPE_META[value].singular}
        <ChevronDown size={18} className={`text-fg-subtle transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="animate-pop-in absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-border-base bg-surface p-1.5 shadow-e3">
          {TX_TYPE_ORDER.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                onChange(type);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm lowercase transition-colors ${
                value === type ? "bg-surface-3 font-medium" : "hover:bg-surface-2"
              }`}
            >
              <TypeBadge type={type} size={18} />
              {TX_TYPE_META[type].singular}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RepeatSelect({
  repeats,
  frequency,
  onChange,
}: {
  repeats: boolean;
  frequency: Frequency;
  onChange: (value: Frequency | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const timer = setTimeout(() => document.addEventListener("pointerdown", onPointerDown), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const options: { value: Frequency | null; label: string }[] = [
    { value: null, label: "não repete" },
    { value: "diario", label: FREQUENCY_LABEL.diario },
    { value: "semanal", label: FREQUENCY_LABEL.semanal },
    { value: "mensal", label: FREQUENCY_LABEL.mensal },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left lowercase"
      >
        {repeats ? FREQUENCY_LABEL[frequency] : "não repete"}
        <ChevronDown size={18} className={`text-fg-subtle transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="animate-pop-in absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-border-base bg-surface p-1.5 shadow-e3">
          {options.map((option) => {
            const active = option.value === null ? !repeats : repeats && frequency === option.value;
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center rounded-xl px-3 py-2.5 text-sm lowercase transition-colors ${
                  active ? "bg-surface-3 font-medium" : "hover:bg-surface-2"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
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
