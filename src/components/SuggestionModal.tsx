"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

const MAX_LENGTH = 2000;

interface SuggestionModalProps {
  onClose: () => void;
}

export function SuggestionModal({ onClose }: SuggestionModalProps) {
  const showToast = useToast();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (message.trim().length < 5) return setError("escreva um pouco mais que isso.");

    setSending(true);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      if (!res.ok) throw new Error("Falha ao enviar sugestão");
      showToast("sugestão enviada. obrigado!");
      onClose();
    } catch (err) {
      console.error(err);
      setError("não foi possível enviar agora. tente de novo mais tarde.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal onClose={onClose} title="mandar sugestões">
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
        <div className="px-6">
          <p className="pb-3 text-sm text-fg-muted">
            o que está faltando, o que incomoda, o que você faria diferente. vai direto pro meu
            e-mail.
          </p>

          <textarea
            autoFocus
            value={message}
            maxLength={MAX_LENGTH}
            onChange={(e) => {
              setMessage(e.target.value);
              setError(null);
            }}
            rows={6}
            placeholder="sua sugestão"
            className="w-full resize-none rounded-2xl border border-border-base bg-surface-2 px-4 py-3 text-sm outline-none placeholder:text-fg-subtle focus:border-border-strong"
          />

          <p className="pt-1.5 text-right text-xs text-fg-subtle tabular">
            {message.length}/{MAX_LENGTH}
          </p>

          {error && <p className="pb-1 text-sm lowercase text-saida">{error}</p>}
        </div>

        <div className="p-6 pt-3">
          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-full bg-brand py-3.5 text-base font-semibold lowercase text-brand-fg transition-opacity active:scale-[0.99] disabled:opacity-60"
          >
            {sending ? "enviando..." : "enviar sugestão"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
