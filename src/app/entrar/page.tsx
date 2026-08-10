"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LoginScreen } from "@/components/LoginScreen";

export default function EntrarPage() {
  const { status } = useSession();
  const router = useRouter();

  // Quem já tem sessão não precisa ver a tela de login.
  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-bg text-sm lowercase text-fg-muted">
        um instante...
      </main>
    );
  }

  return <LoginScreen />;
}
