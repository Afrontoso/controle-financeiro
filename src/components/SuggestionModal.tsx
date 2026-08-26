"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

const MAX_LENGTH = 2000;

/** (61) 99999-9999 — formata enquanto digita, guardando só os dígitos. */
function formatPhone(digits: string): string {
  const d = digits.slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

interface SuggestionModalProps {
  onClose: () => void;
}

export function SuggestionModal({ onClose }: SuggestionModalProps) {
  const showToast = useToast();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;

    if (message.trim().length < 5) return setError("escreva um pouco mais que isso.");
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError("esse e-mail não parece válido.");
    }
    if (phoneDigits && phoneDigits.length < 10) {
      return setError("o telefone precisa de ddd e número completo.");
    }

    setSending(true);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          contactEmail: email.trim() || null,
          contactPhone: phoneDigits ? formatPhone(phoneDigits) : null,
        }),
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
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6">
          <p className="pb-3 text-sm text-fg-muted">
            o que está faltando, o que incomoda, o que você faria diferente.
          </p>

          <textarea
            autoFocus
            value={message}
            maxLength={MAX_LENGTH}
            onChange={(e) => {
              setMessage(e.target.value);
              setError(null);
            }}
            rows={5}
            placeholder="sua sugestão"
            className="w-full resize-none rounded-2xl border border-border-base bg-surface-2 px-4 py-3 text-sm outline-none placeholder:text-fg-subtle focus:border-border-strong"
          />

          <p className="pt-1.5 text-right text-xs text-fg-subtle tabular">
            {message.length}/{MAX_LENGTH}
          </p>

          <p className="pt-2 pb-2.5 text-sm lowercase text-fg-muted">
            contato <span className="text-fg-subtle">(opcional)</span> — só para eu te procurar
            se ficar alguma dúvida sobre a sua sugestão.
          </p>

          <div className="flex flex-col gap-2.5">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="seu e-mail"
              autoComplete="email"
              className="w-full rounded-2xl border border-border-base bg-surface-2 px-4 py-3 text-sm outline-none placeholder:text-fg-subtle focus:border-border-strong"
            />
            <input
              type="tel"
              inputMode="numeric"
              value={formatPhone(phoneDigits)}
              onChange={(e) => {
                setPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 11));
                setError(null);
              }}
              placeholder="seu telefone"
              autoComplete="tel"
              className="w-full rounded-2xl border border-border-base bg-surface-2 px-4 py-3 text-sm tabular outline-none placeholder:text-fg-subtle focus:border-border-strong"
            />
          </div>

          {error && <p className="pt-3 text-sm lowercase text-saida">{error}</p>}
        </div>

        <div className="shrink-0 p-6 pt-4">
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
