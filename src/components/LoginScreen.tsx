"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { ArrowLeft, Wallet } from "lucide-react";

export function LoginScreen() {
  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-bg px-6 text-fg">
      <Link
        href="/"
        className="absolute top-5 left-5 flex items-center gap-2 rounded-full px-3 py-2 text-sm lowercase text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
      >
        <ArrowLeft size={16} /> voltar
      </Link>

      <span
        className="mb-6 grid size-14 place-items-center rounded-2xl text-white shadow-e2"
        style={{ background: "linear-gradient(135deg, #f97316, #ea580c)" }}
      >
        <Wallet size={26} />
      </span>

      <h1 className="text-3xl font-semibold lowercase tracking-tight">controle financeiro</h1>
      <p className="mt-2 mb-8 max-w-xs text-center text-sm text-fg-muted">
        seu fluxo de caixa diário, com o saldo dos próximos meses já projetado.
      </p>

      <button
        type="button"
        onClick={() => signIn("google")}
        className="flex items-center gap-3 rounded-full border border-border-base bg-surface px-6 py-3.5 font-medium shadow-e1 transition-colors hover:bg-surface-2 active:scale-[0.98]"
      >
        <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        entrar com o google
      </button>
    </main>
  );
}
