"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LoginScreen } from "@/components/LoginScreen";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function EntrarPage() {
  const { status } = useSession();
  const router = useRouter();

  // Quem já tem sessão não precisa ver a tela de login.
  useEffect(() => {
    if (status === "authenticated") router.replace("/");
  }, [status, router]);

  if (status === "loading" || status === "authenticated") {
    return <LoadingScreen label="um instante..." />;
  }

  return <LoginScreen />;
}
