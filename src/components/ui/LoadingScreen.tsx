import { BrandMark } from "@/components/ui/BrandMark";

/**
 * Tela de carregamento: só o ícone do app, com as três barras subindo uma
 * depois da outra. O texto fica apenas para leitores de tela.
 */
export function LoadingScreen() {
  return (
    <main
      role="status"
      aria-live="polite"
      className="grid min-h-[100dvh] place-items-center bg-bg animate-fade-in"
    >
      <BrandMark size={64} animated className="drop-shadow-sm" />
      <span className="sr-only">carregando</span>
    </main>
  );
}
