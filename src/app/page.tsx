"use client";

import { useSession } from "next-auth/react";
import { FinanceApp } from "@/components/FinanceApp";
import { LandingPage } from "@/components/landing/LandingPage";

export default function Home() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-bg text-sm lowercase text-fg-muted">
        um instante...
      </main>
    );
  }

  // Visitante vê a apresentação do produto; quem tem sessão cai direto no app —
  // assim o FinanceApp só monta (e só busca dados) para quem está autenticado.
  return status === "authenticated" ? <FinanceApp /> : <LandingPage />;
}
