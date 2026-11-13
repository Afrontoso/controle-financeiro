"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { formatCurrency, formatDayMonth, formatPercent } from "@/lib/format";
import type { CardBill } from "@/lib/ledger";
import { Brl, KeepRs } from "@/components/ui/Brl";

/* Peças do painel em cards (visão geral, cartões, fluxo de caixa...). */

export function Tile({
  title,
  subtitle,
  info,
  illustration,
  onTitleClick,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  info: string;
  /** Nome do arquivo em /public/illustrations (Fluent Emoji 3D, licença MIT). */
  illustration?: string;
  onTitleClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <section
      className={`relative flex min-w-0 flex-col rounded-3xl border border-border-base bg-surface p-5 shadow-sm md:p-6 ${className}`}
    >
      {illustration && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/illustrations/${illustration}.png`}
          alt=""
          aria-hidden
          className="pointer-events-none absolute top-4 right-4 size-14 select-none md:size-16"
        />
      )}
      <div className="pr-16">
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold lowercase">
          {onTitleClick ? (
            <button type="button" onClick={onTitleClick} className="hover:underline">
              <KeepRs text={title} />
            </button>
          ) : (
            <KeepRs text={title} />
          )}
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            aria-expanded={infoOpen}
            aria-label={`Como é calculado: ${title}`}
            className={`grid size-5 place-items-center rounded-full border transition-colors hover:text-fg ${
              infoOpen ? "border-fg text-fg" : "border-border-strong text-fg-subtle"
            }`}
          >
            <Info size={11} />
          </button>
        </h2>
        {subtitle && <p className="mt-0.5 text-xs lowercase text-fg-muted">{subtitle}</p>}
      </div>
      {infoOpen && (
        <p className="animate-fade-in mt-3 rounded-xl bg-surface-2 px-3 py-2.5 text-xs lowercase leading-relaxed text-fg-muted">
          {info}
        </p>
      )}
      {children}
    </section>
  );
}

/** "R$ 776,11" grande: o R$ e os centavos menores e em cinza. */
export function BigMoney({ value, size, color }: { value: number; size: "lg" | "xl"; color?: string }) {
  const number = formatCurrency(Math.abs(value)).replace(/^R\$\s?/, "");
  const comma = number.lastIndexOf(",");
  const inteiro = comma >= 0 ? number.slice(0, comma) : number;
  const cents = comma >= 0 ? number.slice(comma) : "";

  return (
    <p
      className={`flex items-baseline font-bold tracking-tight tabular ${size === "xl" ? "text-6xl md:text-7xl" : "text-4xl"}`}
      style={color ? { color } : undefined}
    >
      <span className={`font-semibold text-fg-subtle ${size === "xl" ? "mr-2 text-4xl md:text-5xl" : "mr-1.5 text-2xl"}`}>
        {value < 0 && "−"}R$
      </span>
      {inteiro}
      <span className={`font-semibold text-fg-subtle ${size === "xl" ? "text-3xl" : "text-xl"}`}>{cents}</span>
    </p>
  );
}

export function LegendItem({
  label,
  value,
  dot,
  pct,
  color,
}: {
  label: string;
  value: React.ReactNode;
  dot?: string;
  pct?: number;
  color?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs lowercase text-fg-muted">
        {dot && <span className="size-1.5 shrink-0 rounded-full" style={{ background: dot }} />}
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-semibold tabular" style={color ? { color } : undefined}>
        {value}
      </dd>
      {pct !== undefined && <dd className="text-[11px] text-fg-subtle tabular">{formatPercent(pct, 0)} da renda</dd>}
    </div>
  );
}

/** Número pequeno num quadradinho cinza: "limite livre", "ponto mais baixo"... */
export function Stat({
  label,
  value,
  hint,
  color,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  color?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="block text-[11px] lowercase text-fg-muted">{label}</span>
      <span className="block text-lg font-bold tabular" style={color ? { color } : undefined}>
        {value}
      </span>
      {hint && <span className="block text-[11px] lowercase text-fg-subtle">{hint}</span>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="min-w-0 rounded-xl bg-surface-2 px-3 py-2.5 text-left hover:bg-surface-3">
      {content}
    </button>
  ) : (
    <div className="min-w-0 rounded-xl bg-surface-2 px-3 py-2.5">{content}</div>
  );
}

/** O cartão de crédito desenhado. */
/** Visual do cartão pelo banco, achado pelo nome que você deu. */
interface CardBrand {
  background: string;
  /** Marca do banco no canto, no lugar do nome. */
  logo: React.ReactNode;
  mastercard?: boolean;
}

function cardBrand(name: string): CardBrand | null {
  const n = name.toLowerCase();
  if (n.includes("nubank") || /\bnu\b/.test(n)) {
    return {
      background: "linear-gradient(135deg, #9b3ee6 0%, #820ad1 55%, #6a07ad 100%)",
      logo: <span className="text-3xl leading-none font-bold tracking-tighter">nu</span>,
      mastercard: true,
    };
  }
  return null;
}

function MastercardMark() {
  // Dois círculos de raio 14 com centros a 16 de distância; o meio é a interseção.
  return (
    <svg viewBox="0 0 46 28" className="h-7 w-[46px] shrink-0" aria-hidden>
      <circle cx="14" cy="14" r="14" fill="#eb001b" />
      <circle cx="32" cy="14" r="14" fill="#f79e1b" />
      <path d="M23 3.27a14 14 0 0 1 0 21.46a14 14 0 0 1 0-21.46z" fill="#ff5f00" />
    </svg>
  );
}

export function CardArt({
  name,
  usadoPct,
  vence,
  livre,
  className = "",
}: {
  name: string;
  /** 0–1; null sem limite informado. */
  usadoPct: number | null;
  vence: string;
  livre: number | null;
  className?: string;
}) {
  const brand = cardBrand(name);
  return (
      <div
        className={`flex aspect-[1.6/1] w-full max-w-72 flex-col justify-between rounded-2xl p-4 text-white shadow-lg ${className}`}
        style={{ background: brand?.background ?? "linear-gradient(135deg, var(--ov-card-from), var(--ov-card-to))" }}
      >
        <div className="flex items-start justify-between gap-2">
          {brand ? (
            <span aria-label={name}>{brand.logo}</span>
          ) : (
            <span className="truncate text-sm font-semibold lowercase">{name}</span>
          )}
          {brand?.mastercard ? (
            <MastercardMark />
          ) : (
            usadoPct !== null && (
              <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold tabular">
                {formatPercent(usadoPct * 100, 0)} usado
              </span>
            )
          )}
        </div>
        {brand ? (
          usadoPct !== null ? (
            <span className="self-start rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold tabular">
              {formatPercent(usadoPct * 100, 0)} usado
            </span>
          ) : (
            <span />
          )
        ) : (
          <span className="h-6 w-8 rounded-md bg-gradient-to-br from-zinc-200 to-zinc-400 opacity-80" aria-hidden />
        )}
        <div>
          <div className="flex items-end justify-between gap-2 text-[10px] uppercase tracking-wider text-white/60">
            <span>
              vence
              <span className="block text-sm font-semibold tracking-normal text-white tabular">
                {vence}
              </span>
            </span>
            {livre !== null && (
              <span className="text-right">
                limite livre
                <span className="block text-sm font-semibold normal-case tracking-normal text-white tabular">
                  {formatCurrency(livre)}
                </span>
              </span>
            )}
          </div>
          {usadoPct !== null && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white" style={{ width: `${usadoPct * 100}%` }} />
            </div>
          )}
        </div>
      </div>
  );
}

export function billStatus(bill: CardBill, todayStr: string): { label: string; color: string; bg: string } {
  if (bill.paid) return { label: "paga", color: "var(--entrada)", bg: "var(--entrada-soft)" };
  if (bill.amount === 0) return { label: "sem compras", color: "var(--fg-subtle)", bg: "var(--surface-3)" };
  if (bill.dueDate < todayStr) return { label: "vencida", color: "var(--saida)", bg: "var(--saida-soft)" };
  return { label: "aberta", color: "var(--ov-blue)", bg: "var(--ov-blue-soft)" };
}

export function BillTiles({
  bills,
  todayStr,
  onSelect,
}: {
  bills: CardBill[];
  todayStr: string;
  onSelect: (date: string) => void;
}) {
  const max = Math.max(...bills.map((b) => b.amount), 1);
  // Uma linha tracejada passando pelos meses, como um gráfico pequeno.
  const points = bills.map((b, i) => `${((i + 0.5) / bills.length) * 100},${85 - (b.amount / max) * 70}`);

  return (
    <div className="relative mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${bills.length}, minmax(0, 1fr))` }}>
      <svg
        className="pointer-events-none absolute inset-x-0 top-12 h-10 w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="var(--ov-blue)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {bills.map((b, i) => {
        // A primeira é a do mês em tela; as seguintes, se ainda não fecharam, são previsões.
        const status =
          i === 0 || b.paid || b.amount === 0
            ? billStatus(b, todayStr)
            : { label: "prevista", color: "var(--fg-muted)", bg: "var(--surface-3)" };
        return (
          <button
            key={b.key}
            type="button"
            onClick={() => onSelect(b.dueDate)}
            className={`flex h-28 flex-col items-center justify-between rounded-xl border px-1 py-2 text-center transition-colors hover:bg-surface-2 ${
              i === 0 ? "border-[var(--ov-blue)] bg-[var(--ov-blue-soft)]/40" : "border-transparent bg-surface-2"
            }`}
          >
            <span className="text-xs font-semibold lowercase">{b.label.split("/")[0]}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold lowercase"
              style={{ color: status.color, background: status.bg }}
            >
              {status.label}
            </span>
            <span className="h-6" />
            <span className="text-xs font-semibold tabular" style={{ color: i === 0 ? "var(--ov-blue)" : undefined }}>
              <Brl value={Math.round(b.amount)} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function LineChart({
  values,
  labels,
  onSelect,
  ariaLabel = "Saldo previsto nos próximos 30 dias",
  heightClass = "h-28",
}: {
  values: number[];
  labels: string[];
  onSelect: (label: string) => void;
  ariaLabel?: string;
  heightClass?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const x = (i: number) => (i / Math.max(values.length - 1, 1)) * 100;
  const y = (v: number) => 92 - ((v - min) / range) * 84;
  const line = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");

  return (
    <div className="mt-4">
      <svg
        className={`${heightClass} w-full cursor-pointer`}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHover(Math.round(((e.clientX - rect.left) / rect.width) * (values.length - 1)));
        }}
        onClick={() => hover !== null && labels[hover] && onSelect(labels[hover])}
        role="img"
        aria-label={ariaLabel}
      >
        <polygon points={`0,100 ${line} 100,100`} fill="var(--ov-blue-soft)" opacity="0.8" />
        {min < 0 && (
          <line
            x1="0"
            x2="100"
            y1={y(0)}
            y2={y(0)}
            stroke="var(--saida)"
            strokeWidth="1"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <polyline
          points={line}
          fill="none"
          stroke="var(--ov-blue)"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {hover !== null && values[hover] !== undefined && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1="0"
            y2="100"
            stroke="var(--fg-subtle)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <p className="mt-1 h-4 text-[11px] lowercase text-fg-muted tabular">
        {hover !== null && values[hover] !== undefined ? (
          <>
            {formatDayMonth(labels[hover])} · <Brl value={values[hover]} />
          </>
        ) : (
          "passe o dedo ou o mouse pelo gráfico"
        )}
      </p>
    </div>
  );
}

/** Barras verticais com a média tracejada; a destacada fica mais escura. */
export function BarChart({
  bars,
  highlight,
  onSelect,
}: {
  bars: { key: string; label: string; value: number }[];
  /** Índice da barra em destaque (ex.: mês atual). */
  highlight?: number;
  onSelect?: (key: string) => void;
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  const comValor = bars.filter((b) => b.value > 0);
  const media = comValor.length > 0 ? comValor.reduce((sum, b) => sum + b.value, 0) / comValor.length : 0;

  return (
    <div className="relative mt-4">
      <div className="relative flex h-36 items-end gap-2">
        {media > 0 && (
          <span
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-fg-subtle"
            style={{ bottom: `${(media / max) * 100}%` }}
            aria-hidden
          />
        )}
        {bars.map((b, i) => (
          <button
            key={b.key}
            type="button"
            disabled={!onSelect}
            onClick={() => onSelect?.(b.key)}
            title={`${b.label}: ${formatCurrency(b.value)}`}
            className="flex h-full flex-1 items-end justify-center"
          >
            <span
              className="w-full max-w-10 rounded-t-md transition-[height] duration-500"
              style={{
                height: `${(b.value / max) * 100}%`,
                minHeight: b.value > 0 ? 2 : 0,
                background: i === highlight ? "var(--ov-blue)" : "var(--ov-sky)",
              }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {bars.map((b) => (
          <span key={b.key} className="flex-1 text-center text-[10px] lowercase text-fg-muted">
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barra horizontal com nome e valor: "para onde foi o dinheiro". */
export function RankRow({ label, value, max, hint }: { label: string; value: number; max: number; hint?: string }) {
  return (
    <li className="py-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate lowercase">
          {label}
          {hint && <span className="ml-1.5 text-[11px] text-fg-subtle">{hint}</span>}
        </span>
        <span className="shrink-0 font-semibold tabular">
          <Brl value={value} />
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full" style={{ width: `${(value / Math.max(max, 1)) * 100}%`, background: "var(--ov-blue)" }} />
      </div>
    </li>
  );
}
