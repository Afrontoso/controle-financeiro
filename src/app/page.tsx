"use client";

import { useSession } from "next-auth/react";
import { FinanceApp } from "@/components/FinanceApp";
import { LandingPage } from "@/components/landing/LandingPage";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function Home() {
  const { status } = useSession();

  if (status === "loading") {
    return <LoadingScreen />;
  }

  // Visitante vê a apresentação do produto; quem tem sessão cai direto no app —
  // assim o FinanceApp só monta (e só busca dados) para quem está autenticado.
  return status === "authenticated" ? <FinanceApp /> : <LandingPage />;
}
