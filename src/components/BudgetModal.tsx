"use client";

import { useState } from "react";
import { Banknote, CalendarDays, Tag } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/format";
import type { Budget } from "@/lib/types";

interface BudgetModalProps {
  onClose: () => void;
  editing: Budget | null;
  submitting: boolean;
  onSubmit: (budget: { id?: string | null; name: string; amount: number; divideBy: number }) => void;
}

export function BudgetModal({ onClose, editing, submitting, onSubmit }: BudgetModalProps) {
  const [name, setName] = useState(editing?.name ?? "");
  const [amountDigits, setAmountDigits] = useState(() =>
    editing ? String(Math.round(editing.amount * 100)) : "",
  );
  const [divideBy, setDivideBy] = useState(String(editing?.divideBy ?? 30));
  const [error, setError] = useState<string | null>(null);

  const amount = Number(amountDigits || "0") / 100;
  const days = Number(divideBy) || 30;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) return setError("dê um nome ao orçamento.");
    if (amount <= 0) return setError("informe um valor maior que zero.");
    if (days < 1 || days > 31) return setError("divida por um número de 1 a 31 dias.");

    onSubmit({ id: editing?.id ?? null, name: name.trim(), amount, divideBy: days });
  };

  return (
    <Modal onClose={onClose} title={editing ? "editar orçamento" : "novo orçamento"}>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="px-6">
          <div className="flex items-center gap-3.5 border-b border-border-base py-4">
            <Tag size={20} className="shrink-0 text-fg-subtle" />
            <input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="nome do orçamento"
              className="w-full bg-transparent lowercase outline-none placeholder:text-fg-subtle"
            />
          </div>

          <div className="flex items-center gap-3.5 border-b border-border-base py-4">
            <Banknote size={20} className="shrink-0 text-fg-subtle" />
            <span className="text-xl font-semibold text-fg-muted">R$</span>
            <input
              inputMode="numeric"
              value={amount > 0 ? formatCurrency(amount).replace("R$", "").trim() : ""}
              placeholder="0,00"
              onChange={(e) => {
                setAmountDigits(e.target.value.replace(/\D/g, "").slice(0, 11));
                setError(null);
              }}
              className="w-full bg-transparent text-xl font-semibold tabular outline-none placeholder:text-fg-subtle"
              aria-label="Valor mensal"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3.5 border-b border-border-base py-4">
            <CalendarDays size={20} className="shrink-0 text-fg-subtle" />
            <span className="flex-1 lowercase text-fg-muted">dividir por</span>
            <input
              type="number"
              min={1}
              max={31}
              value={divideBy}
              onChange={(e) => {
                setDivideBy(e.target.value);
                setError(null);
              }}
              className="w-16 bg-transparent text-right tabular outline-none"
            />
            <span className="lowercase text-fg-muted">dias</span>
          </label>

          <p className="py-4 text-sm text-fg-muted">
            reserva{" "}
            <strong className="font-semibold text-fg tabular">
              {formatCurrency(amount / days)}
            </strong>{" "}
            por dia no saldo projetado.
          </p>

          {error && <p className="pb-2 text-sm lowercase text-saida">{error}</p>}
        </div>

        <div className="p-6 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-brand py-3.5 text-base font-semibold lowercase text-brand-fg transition-opacity active:scale-[0.99] disabled:opacity-60"
          >
            {submitting ? "salvando..." : editing ? "salvar alterações" : "criar orçamento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
