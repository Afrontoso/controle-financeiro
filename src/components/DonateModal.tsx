"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { QrCode } from "@/components/ui/QrCode";
import { useToast } from "@/components/ui/Toast";
import { pixPayeeName } from "@/lib/pix";

interface DonateModalProps {
  /** Chave pix legível, mostrada quando não há código copia e cola. */
  pixKey: string;
  /** BR Code copia e cola: gera o QR e é o que o app do banco entende colado. */
  pixPayload: string;
  onClose: () => void;
}

export function DonateModal({ pixKey, pixPayload, onClose }: DonateModalProps) {
  const showToast = useToast();
  const [copied, setCopied] = useState(false);

  // O copia e cola já embute a chave, então ele é sempre a melhor coisa a copiar.
  const copyValue = pixPayload || pixKey;
  const payee = pixPayload ? pixPayeeName(pixPayload) : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("não foi possível copiar.", "error");
    }
  };

  return (
    <Modal onClose={onClose} title="apoiar o app">
      <div className="flex flex-col px-6 pb-6">
        <p className="pb-4 text-sm text-fg-muted">
          o app é gratuito e sem anúncios. se ele te ajuda a fechar o mês no azul, uma doação
          via pix mantém o servidor de pé.
        </p>

        {pixPayload && (
          <div className="flex flex-col items-center gap-2 pb-4">
            <div className="rounded-2xl border border-border-base bg-white p-3">
              <QrCode value={pixPayload} size={190} />
            </div>
            <p className="text-center text-xs lowercase text-fg-subtle">
              escaneie pelo app do seu banco
              {payee && (
                <>
                  <br />
                  <span className="normal-case">{payee.toLowerCase()}</span>
                </>
              )}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => void copy()}
          className="flex items-center gap-3 rounded-2xl border border-border-base bg-surface-2 px-4 py-3.5 text-left transition-colors hover:bg-surface-3"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs lowercase text-fg-muted">
              {pixPayload ? "código copia e cola" : "chave pix"}
            </span>
            <span className="block truncate font-medium">{copyValue}</span>
          </span>
          {copied ? (
            <Check size={18} className="shrink-0" style={{ color: "var(--entrada)" }} />
          ) : (
            <Copy size={18} className="shrink-0 text-fg-subtle" />
          )}
        </button>

        <p className="pt-3 text-center text-xs lowercase text-fg-subtle">
          {copied ? "copiado." : "toque para copiar"}
        </p>
      </div>
    </Modal>
  );
}
