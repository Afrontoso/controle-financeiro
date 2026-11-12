"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Toggle } from "@/components/TransactionModal";
import { Brl } from "@/components/ui/Brl";
import { formatCurrency } from "@/lib/format";
import { RESERVE_MONTHS, type FixedCost } from "@/lib/vaults";
import type { Vault } from "@/lib/types";
import type { VaultPayload } from "@/hooks/useFinanceData";

interface VaultModalProps {
  editing: Vault | null;
  /** Abrir já como reserva de emergência. */
  asReserve?: boolean;
  fixedCost: FixedCost;
  busy?: boolean;
  onClose: () => void;
  onSave: (vault: VaultPayload) => void;
}

type GoalMode = "nenhuma" | "valor" | "custo";

const inputClass =
  "w-full rounded-xl border border-border-base bg-surface-2 px-3 py-2.5 text-sm tabular outline-none placeholder:text-fg-subtle focus:border-border-strong";

export function VaultModal({ editing, asReserve, fixedCost, busy, onClose, onSave }: VaultModalProps) {
  const [name, setName] = useState(editing?.name ?? (asReserve ? "reserva de emergência" : ""));
  const [reserva, setReserva] = useState(editing ? editing.kind === "reserva" : Boolean(asReserve));
  const [mode, setMode] = useState<GoalMode>(() =>
    editing?.goalMonths ? "custo" : editing?.goal ? "valor" : asReserve ? "custo" : "nenhuma",
  );
  const [goal, setGoal] = useState(editing?.goal ?? 0);
  const [months, setMonths] = useState(editing?.goalMonths ?? RESERVE_MONTHS);
  const [initial, setInitial] = useState(editing?.initial ?? 0);
  const [error, setError] = useState<string | null>(null);

  const metaCusto = fixedCost.total * months;

  return (
    <Modal onClose={busy ? () => {} : onClose} title={editing ? "editar cofre" : "novo cofre"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return setError("dê um nome ao cofre.");
          if (mode === "custo" && months < 1) return setError("informe quantos meses.");
          onSave({
            id: editing?.id ?? null,
            name: name.trim(),
            goal: mode === "valor" && goal > 0 ? goal : null,
            goalMonths: mode === "custo" ? months : null,
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

        <div className="flex flex-col gap-2">
          <span className="text-xs lowercase text-fg-muted">meta</span>
          <div className="flex gap-1 rounded-xl bg-surface-3 p-1 text-sm lowercase">
            {(
              [
                ["nenhuma", "sem meta"],
                ["valor", "um valor"],
                ["custo", "meses de custo fixo"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`flex-1 rounded-lg px-2 py-1.5 font-medium transition-colors ${
                  mode === key ? "bg-surface shadow-sm" : "text-fg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "valor" && <MoneyInput value={goal} onChange={setGoal} />}

          {mode === "custo" && (
            <div className="rounded-xl bg-surface-2 p-3">
              <div className="flex items-center gap-2 text-sm lowercase">
                <input
                  inputMode="numeric"
                  value={months ? String(months) : ""}
                  onChange={(e) => setMonths(Math.min(Number(e.target.value.replace(/\D/g, "").slice(0, 2) || "0"), 36))}
                  className="w-14 rounded-lg border border-border-base bg-surface px-2 py-1.5 text-center tabular outline-none focus:border-border-strong"
                  aria-label="Meses"
                />
                <span className="text-fg-muted">meses ×</span>
                <Brl value={fixedCost.total} className="font-medium" />
                <span className="text-fg-muted">=</span>
                <Brl value={metaCusto} className="font-bold" />
              </div>
              <p className="mt-2 text-xs lowercase text-fg-subtle">
                custo de vida: <Brl value={fixedCost.essenciais} /> de contas essenciais +{" "}
                <Brl value={fixedCost.orcamentos} /> de orçamentos. marque uma conta como essencial em
                fixos para ela entrar; a meta se atualiza sozinha.
              </p>
              {fixedCost.total === 0 && (
                <p className="mt-1 text-xs lowercase text-saida">
                  nenhuma conta essencial nem orçamento: a meta fica zerada até você marcar contas
                  como essenciais em fixos ou cadastrar orçamentos.
                </p>
              )}
            </div>
          )}
        </div>

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
