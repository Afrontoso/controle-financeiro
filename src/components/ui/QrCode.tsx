"use client";

import { useMemo } from "react";
import qrcode from "qrcode-generator";

interface QrCodeProps {
  value: string;
  /** Lado do quadrado em pixels. */
  size?: number;
  /** Zona de silêncio em módulos — sem ela muitos leitores não enxergam o código. */
  quietZone?: number;
}

/**
 * QR desenhado como um único `<path>`: um `<rect>` por módulo seriam ~1200
 * nós no DOM para um código do tamanho de um payload Pix.
 *
 * As cores são fixas de propósito. Um QR só é lido com bom contraste e na
 * polaridade esperada, então ele fica preto no branco mesmo no tema escuro.
 */
export function QrCode({ value, size = 200, quietZone = 3 }: QrCodeProps) {
  const { path, extent } = useMemo(() => {
    // Versão 0 = a menor que couber; correção "M" equilibra densidade e leitura.
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();

    const count = qr.getModuleCount();
    let d = "";
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) d += `M${col},${row}h1v1h-1z`;
      }
    }

    return { path: d, extent: count + quietZone * 2 };
  }, [value, quietZone]);

  return (
    <svg
      role="img"
      aria-label="QR Code do pix"
      width={size}
      height={size}
      viewBox={`${-quietZone} ${-quietZone} ${extent} ${extent}`}
      shapeRendering="crispEdges"
      className="rounded-xl"
      style={{ background: "#fff" }}
    >
      <path d={path} fill="#000" />
    </svg>
  );
}
