"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface DonateModalProps {
  pixKey: string;
  onClose: () => void;
}

export function DonateModal({ pixKey, onClose }: DonateModalProps) {
  const showToast = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pixKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("não foi possível copiar a chave.", "error");
    }
  };

  return (
    <Modal onClose={onClose} title="apoiar o app">
      <div className="flex flex-col px-6 pb-6">
        <p className="pb-4 text-sm text-fg-muted">
          o app é gratuito e sem anúncios. se ele te ajuda a fechar o mês no azul, uma doação
          via pix mantém o servidor de pé.
        </p>

        <button
          type="button"
          onClick={() => void copy()}
          className="flex items-center gap-3 rounded-2xl border border-border-base bg-surface-2 px-4 py-3.5 text-left transition-colors hover:bg-surface-3"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs lowercase text-fg-muted">chave pix</span>
            <span className="block truncate font-medium">{pixKey}</span>
          </span>
          {copied ? (
            <Check size={18} className="shrink-0" style={{ color: "var(--entrada)" }} />
          ) : (
            <Copy size={18} className="shrink-0 text-fg-subtle" />
          )}
        </button>

        <p className="pt-3 text-center text-xs lowercase text-fg-subtle">
          {copied ? "chave copiada." : "toque para copiar"}
        </p>
      </div>
    </Modal>
  );
}
