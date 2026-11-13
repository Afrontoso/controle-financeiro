import { BrandMark } from "@/components/ui/BrandMark";

/**
 * Tela de carregamento com o ícone do app: as três barras sobem uma depois da
 * outra, como um gráfico crescendo.
 */
export function LoadingScreen({ label = "carregando" }: { label?: string }) {
  return (
    <main
      role="status"
      aria-live="polite"
      className="grid min-h-[100dvh] place-items-center bg-bg animate-fade-in"
    >
      <div className="flex flex-col items-center gap-4">
        <BrandMark size={64} animated className="drop-shadow-sm" />
        <span className="text-sm lowercase text-fg-muted">{label}</span>
      </div>
    </main>
  );
}
