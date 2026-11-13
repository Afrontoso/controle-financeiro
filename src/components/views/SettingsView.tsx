"use client";

import { ArrowDown, ArrowUp, Building2, RotateCcw } from "lucide-react";
import { orderedNavItems, type ViewKey } from "@/components/shell/AppShell";

interface SettingsViewProps {
  apartamento: boolean;
  onApartamentoChange: (on: boolean) => void;
  order?: ViewKey[];
  onOrderChange: (order: ViewKey[] | undefined) => void;
  /** Telas que não aparecem na barra (desligadas ou indisponíveis). */
  hiddenViews: ViewKey[];
}

export function SettingsView({ apartamento, onApartamentoChange, order, onOrderChange, hiddenViews }: SettingsViewProps) {
  const items = orderedNavItems(order).filter((item) => !hiddenViews.includes(item.key));

  // Troca com o vizinho visível e guarda a ordem completa (escondidas inclusive,
  // para elas voltarem no mesmo lugar se forem ligadas).
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const full = orderedNavItems(order).map((item) => item.key);
    const a = full.indexOf(items[index].key);
    const b = full.indexOf(items[target].key);
    [full[a], full[b]] = [full[b], full[a]];
    onOrderChange(full);
  };

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className="mx-auto flex max-w-xl flex-col gap-5">
        <section>
          <h2 className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">telas</h2>
          <div className="overflow-hidden rounded-2xl border border-border-base bg-surface">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <Building2 size={19} className="shrink-0 text-fg-muted" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium lowercase">apartamento</span>
                <span className="block text-xs lowercase text-fg-subtle">
                  plano de compra e financiamento: tela própria, card na visão geral e prazos nos alertas
                </span>
              </span>
              <Switch checked={apartamento} onChange={onApartamentoChange} label="Mostrar apartamento" />
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between px-1 pb-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">ordem da barra lateral</h2>
            {order && (
              <button
                type="button"
                onClick={() => onOrderChange(undefined)}
                className="flex items-center gap-1 text-xs lowercase text-fg-muted hover:text-fg"
              >
                <RotateCcw size={13} /> padrão
              </button>
            )}
          </div>
          <ul className="overflow-hidden rounded-2xl border border-border-base bg-surface">
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.key}
                  className="flex items-center gap-3 border-b border-border-base px-4 py-2 last:border-b-0"
                >
                  <Icon size={19} className="shrink-0 text-fg-muted" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium lowercase">{item.label}</span>
                  <MoveButton label={`Subir ${item.label}`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={16} />
                  </MoveButton>
                  <MoveButton
                    label={`Descer ${item.label}`}
                    disabled={i === items.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={16} />
                  </MoveButton>
                </li>
              );
            })}
          </ul>
          <p className="px-1 pt-2 text-xs lowercase text-fg-subtle">
            vale para a barra do computador. fica salvo na sua conta, em qualquer aparelho.
          </p>
        </section>
      </div>
    </div>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-[var(--entrada)]" : "bg-surface-3"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 shrink-0 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
