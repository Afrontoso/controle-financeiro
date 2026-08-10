"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastKind = "success" | "error";

interface ToastState {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, kind: ToastKind = "success") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ id: Date.now(), message, kind });
    timerRef.current = setTimeout(() => setToast(null), 3200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[200] flex justify-center px-4 md:bottom-8">
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className="animate-toast-in pointer-events-auto flex max-w-[90vw] items-center gap-3 rounded-full border border-border-base bg-surface px-5 py-3 shadow-e3"
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{
                background: toast.kind === "error" ? "var(--saida)" : "var(--entrada)",
              }}
            />
            <span className="truncate text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
