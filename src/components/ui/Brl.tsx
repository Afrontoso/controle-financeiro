import { Fragment } from "react";
import { formatCurrency } from "@/lib/format";

/**
 * Valor em reais pronto para JSX. O app escreve quase tudo com `lowercase`, que
 * transformaria "R$" em "r$"; o `normal-case` aqui protege só o valor.
 */
export function Brl({ value, className = "" }: { value: number; className?: string }) {
  return <span className={`normal-case ${className}`}>{formatCurrency(value)}</span>;
}

/**
 * Texto livre (descrições, notas do contrato) que pode citar valores: continua
 * em minúsculas, mas cada "R$" sai maiúsculo.
 */
export function KeepRs({ text }: { text: string }) {
  const parts = text.split(/(r\$)/i);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        /^r\$$/i.test(part) ? (
          <span key={i} className="normal-case">
            R$
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
