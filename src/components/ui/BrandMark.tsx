/**
 * Marca do app: três barras subindo num quadrado escuro. Mesmo desenho do
 * `app/icon.svg` e do `app/apple-icon.tsx` — se mudar aqui, mude lá também.
 * Com `animated`, as barras sobem em sequência (usado no carregamento).
 */
export function BrandMark({
  size = 36,
  animated = false,
  className = "",
}: {
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  const bar = animated ? "loader-bar" : undefined;
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      className={`shrink-0 ${animated ? "loader-mark" : ""} ${className}`}
    >
      {/* Borda quase invisível no tema claro; no escuro separa o quadrado do fundo. */}
      <rect x="0.25" y="0.25" width="31.5" height="31.5" rx="6.75" fill="#1c1c1e" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="0.5" />
      <rect className={bar} x="7" y="17" width="5" height="7" rx="1.5" fill="#fafaf9" fillOpacity="0.55" />
      <rect className={bar} x="13.5" y="13" width="5" height="11" rx="1.5" fill="#fafaf9" fillOpacity="0.8" />
      <rect className={bar} x="20" y="8" width="5" height="16" rx="1.5" fill="#2f9e51" />
    </svg>
  );
}
