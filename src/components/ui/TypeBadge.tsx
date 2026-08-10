"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { TX_TYPE_META, type TxType } from "@/lib/types";

interface TypeBadgeProps {
  type: TxType;
  /** Apaga o selo quando a célula está zerada. */
  muted?: boolean;
  size?: number;
}

/**
 * Selo circular que identifica o tipo de lançamento: setas para entrada/saída,
 * inicial para os demais.
 */
export function TypeBadge({ type, muted = false, size = 20 }: TypeBadgeProps) {
  const meta = TX_TYPE_META[type];
  const iconSize = Math.round(size * 0.58);

  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: muted ? "var(--border)" : meta.color,
        color: muted ? "var(--fg-subtle)" : "#fff",
        fontSize: Math.round(size * 0.5),
        lineHeight: 1,
      }}
    >
      {type === "entrada" ? (
        <ArrowDownLeft size={iconSize} strokeWidth={3} />
      ) : type === "saida" ? (
        <ArrowUpRight size={iconSize} strokeWidth={3} />
      ) : (
        meta.badge
      )}
    </span>
  );
}
