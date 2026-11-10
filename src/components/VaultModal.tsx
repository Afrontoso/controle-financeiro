"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/TransactionModal";
import { Brl } from "@/components/ui/Brl";
import { formatCurrency } from "@/lib/format";
import { RESERVE_MONTHS, type LivingCost } from "@/lib/vaults";
import type { Vault } from "@/lib/types";
import type { VaultPayload } from "@/hooks/useFinanceData";

interface VaultModalProps {
  editing: Vault | null;
  /** Abrir já como reserva de emergência. */
  asReserve?: boolean;
  livingCost: LivingCost;
  busy?: boolean;
  onClose: () => void;
  onSave: (vault: VaultPayload) => void;
}

const inputClass =
  "w-full rounded-xl border border-border-base bg-surface-2 px-3 py-2.5 text-sm tabular outline-none placeholder:text-fg-subtle focus:border-border-strong";

export function VaultModal({ editing, asReserve, livingCost, busy, onClose, onSave }: VaultModalProps) {
  const [name, setName] = useState(editing?.name ?? (asReserve ? "reserva de emergência" : ""));
  const [goal, setGoal] = useState(editing?.goal ?? 0);
  const [initial, setInitial] = useState(editing?.initial ?? 0);
  const [reserva, setReserva] = useState(editing ? editing.kind === "reserva" : Boolean(asReserve));
  const [error, setError] = useState<string | null>(null);

  const sugestao = Math.round(livingCost.media * RESERVE_MONTHS);

  return (
    <Modal onClose={busy ? () => {} : onClose} title={editing ? "editar cofre" : "novo cofre"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return setError("dê um nome ao cofre.");
          onSave({
            id: editing?.id ?? null,
            name: name.trim(),
            goal: goal > 0 ? goal : null,
            initial,
            kind: reserva ? "reserva" : "cofre",
          });
        }}
        className="flex flex-col gap-4 px-6 pb-6"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs lowercase text-fg-muted">nome</span>
          <input
            autoFocus
            className={`${inputClass} lowercase`}
            value={name}
            placeholder="notebook, viagem, gás..."
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs lowercase text-fg-muted">
            meta <span className="text-fg-subtle">· vazio = sem meta</span>
          </span>
          <MoneyInput value={goal} onChange={setGoal} />
          {reserva && sugestao > 0 && (
            <button
              type="button"
              onClick={() => setGoal(sugestao)}
              className="mt-1 w-fit text-left text-xs lowercase text-fg-muted underline-offset-2 hover:text-fg hover:underline"
            >
              usar {RESERVE_MONTHS}× o custo de vida: <Brl value={sugestao} />
              <span className="text-fg-subtle">
                {" "}
                (média de <Brl value={livingCost.media} /> nos últimos {livingCost.meses}{" "}
                {livingCost.meses === 1 ? "mês" : "meses"})
              </span>
            </button>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs lowercase text-fg-muted">
            já guardado hoje <span className="text-fg-subtle">· o que está no cofre antes de usar o app</span>
          </span>
          <MoneyInput value={initial} onChange={setInitial} />
        </label>

        <Toggle checked={reserva} onChange={setReserva} label="é a minha reserva de emergência" />
        {reserva && (
          <p className="-mt-2 text-xs lowercase text-fg-subtle">
            a reserva aparece em destaque na visão geral. só um cofre pode ser a reserva.
          </p>
        )}

        {error && <p className="text-sm lowercase text-saida">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-2 w-full rounded-full py-3.5 text-base font-semibold lowercase text-white transition-opacity disabled:opacity-60"
          style={{ background: "var(--economia)" }}
        >
          {busy ? "salvando..." : editing ? "salvar cofre" : "criar cofre"}
        </button>
      </form>
    </Modal>
  );
}

function MoneyInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      inputMode="numeric"
      className={inputClass}
      placeholder="0,00"
      value={value > 0 ? formatCurrency(value).replace("R$", "").trim() : ""}
      onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "").slice(0, 12) || "0") / 100)}
    />
  );
}
