"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * O modal não controla visibilidade: quem chama renderiza só quando aberto, o
 * que faz o estado dos formulários nascer zerado a cada abertura.
 */
interface ModalProps {
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  /** Largura máxima do cartão. */
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

export function Modal({ onClose, title, children, size = "sm" }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[160] flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ background: "var(--overlay)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`animate-pop-in flex max-h-[92dvh] w-full ${SIZES[size]} flex-col overflow-hidden rounded-t-3xl border border-border-base bg-surface shadow-e3 sm:rounded-3xl`}
        // Como folha inferior no celular, o rodapé encostaria na barra de gestos;
        // no desktop o inset é zero e nada muda.
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {title !== undefined && (
          <header className="flex shrink-0 items-center justify-between px-6 pt-6 pb-4">
            <h2 className="text-2xl font-semibold lowercase">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="grid size-9 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
            >
              <X size={20} />
            </button>
          </header>
        )}
        {children}
      </div>
    </div>
  );
}
