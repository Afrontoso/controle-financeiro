"use client";

import { useState } from "react";
import { CalendarDays, CreditCard } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { dayShortLabel, toDateStr } from "@/lib/format";
import { nextDueDate } from "@/lib/ledger";
import type { Card } from "@/lib/types";

interface CardModalProps {
  onClose: () => void;
  editing: Card | null;
  submitting: boolean;
  onSubmit: (card: { id?: string | null; name: string; dueDay: number }) => void;
}

export function CardModal({ onClose, editing, submitting, onSubmit }: CardModalProps) {
  const [name, setName] = useState(editing?.name ?? "");
  const [dueDay, setDueDay] = useState(String(editing?.dueDay ?? 10));
  const [error, setError] = useState<string | null>(null);

  const day = Number(dueDay);
  const valid = Number.isInteger(day) && day >= 1 && day <= 31;
  const preview = valid ? nextDueDate(toDateStr(new Date()), day) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!name.trim()) return setError("dê um nome ao cartão.");
    if (!valid) return setError("o vencimento é um dia de 1 a 31.");

    onSubmit({ id: editing?.id ?? null, name: name.trim(), dueDay: day });
  };

  return (
    <Modal onClose={onClose} title={editing ? "editar cartão" : "novo cartão"}>
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="px-6">
          <div className="flex items-center gap-3.5 border-b border-border-base py-4">
            <CreditCard size={20} className="shrink-0 text-fg-subtle" />
            <input
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="nome do cartão"
              className="w-full bg-transparent lowercase outline-none placeholder:text-fg-subtle"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3.5 border-b border-border-base py-4">
            <CalendarDays size={20} className="shrink-0 text-fg-subtle" />
            <span className="flex-1 lowercase text-fg-muted">vence todo dia</span>
            <input
              type="number"
              min={1}
              max={31}
              inputMode="numeric"
              value={dueDay}
              onChange={(e) => {
                setDueDay(e.target.value);
                setError(null);
              }}
              className="w-16 bg-transparent text-right tabular outline-none"
            />
          </label>

          <p className="py-4 text-sm text-fg-muted">
            os gastos marcados neste cartão só saem do saldo no vencimento
            {preview && (
              <>
                {" "}
                — uma compra de hoje cairia em{" "}
                <strong className="font-semibold text-fg tabular">
                  {dayShortLabel(preview)}
                </strong>
              </>
            )}
            .
          </p>

          {error && <p className="pb-2 text-sm lowercase text-saida">{error}</p>}
        </div>

        <div className="p-6 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full py-3.5 text-base font-semibold lowercase text-white transition-opacity active:scale-[0.99] disabled:opacity-60"
            style={{ background: "var(--cartao)" }}
          >
            {submitting ? "salvando..." : editing ? "salvar alterações" : "criar cartão"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
