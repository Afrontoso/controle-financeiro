"use client";

import { Modal } from "@/components/ui/Modal";

export interface ConfirmAction {
  label: string;
  onClick: () => void;
  tone?: "danger" | "neutral";
}

interface ConfirmDialogProps {
  onClose: () => void;
  title: string;
  description: string;
  actions: ConfirmAction[];
  busy?: boolean;
}

export function ConfirmDialog({ onClose, title, description, actions, busy }: ConfirmDialogProps) {
  return (
    <Modal onClose={onClose} title={title}>
      <div className="px-6 pb-6">
        <p className="mb-6 text-sm text-fg-muted">{description}</p>

        <div className="flex flex-col gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              disabled={busy}
              className="w-full rounded-full border px-4 py-3 text-sm font-medium lowercase transition-colors disabled:opacity-50"
              style={
                action.tone === "danger"
                  ? {
                      borderColor: "var(--saida)",
                      background: "var(--saida-soft)",
                      color: "var(--saida)",
                    }
                  : { borderColor: "var(--border)" }
              }
            >
              {busy ? "processando..." : action.label}
            </button>
          ))}

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="mt-1 w-full py-2 text-sm lowercase text-fg-subtle transition-colors hover:text-fg disabled:opacity-50"
          >
            cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}
