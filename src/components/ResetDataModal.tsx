"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

const CONFIRMATION_WORD = "zerar";

interface ResetDataModalProps {
  onClose: () => void;
  onConfirm: () => Promise<void>;
  counts: { transactions: number; budgets: number; cards: number };
}

function plural(n: number, singular: string, pluralForm: string) {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

export function ResetDataModal({ onClose, onConfirm, counts }: ResetDataModalProps) {
  const showToast = useToast();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const armed = typed.trim().toLowerCase() === CONFIRMATION_WORD;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!armed || busy) return;

    setBusy(true);
    try {
      await onConfirm();
      showToast("dados zerados. começando do zero.");
      onClose();
    } catch (err) {
      console.error(err);
      setError("não foi possível zerar agora. nada foi apagado.");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={busy ? () => {} : onClose} title="zerar todos os dados">
      <form onSubmit={handleSubmit} className="flex flex-col px-6 pb-6">
        <div
          className="mb-4 flex gap-3 rounded-2xl border p-4 text-sm"
          style={{
            borderColor: "var(--saida)",
            background: "var(--saida-soft)",
            color: "var(--saida)",
          }}
        >
          <TriangleAlert size={20} className="shrink-0" />
          <p className="lowercase">
            isso apaga para sempre {plural(counts.transactions, "lançamento", "lançamentos")},{" "}
            {plural(counts.budgets, "orçamento", "orçamentos")} e{" "}
            {plural(counts.cards, "cartão", "cartões")}. não dá pra desfazer.
          </p>
        </div>

        <p className="pb-2.5 text-sm lowercase text-fg-muted">
          sua conta continua ativa. para confirmar, digite{" "}
          <strong className="text-fg">{CONFIRMATION_WORD}</strong> abaixo.
        </p>

        <input
          autoFocus
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            setError(null);
          }}
          placeholder={CONFIRMATION_WORD}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={busy}
          className="w-full rounded-2xl border border-border-base bg-surface-2 px-4 py-3 text-sm outline-none placeholder:text-fg-subtle focus:border-border-strong"
        />

        {error && <p className="pt-3 text-sm lowercase text-saida">{error}</p>}

        <button
          type="submit"
          disabled={!armed || busy}
          className="mt-5 w-full rounded-full border px-4 py-3 text-sm font-medium lowercase transition-opacity disabled:opacity-40"
          style={{
            borderColor: "var(--saida)",
            background: armed ? "var(--saida)" : "var(--saida-soft)",
            color: armed ? "white" : "var(--saida)",
          }}
        >
          {busy ? "apagando..." : "apagar tudo"}
        </button>

        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="mt-1 w-full py-2 text-sm lowercase text-fg-subtle transition-colors hover:text-fg disabled:opacity-50"
        >
          cancelar
        </button>
      </form>
    </Modal>
  );
}
