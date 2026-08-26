"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export interface SelectOption<T> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SelectProps<T> {
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  /** Conteúdo do gatilho antes da seta; por padrão, o rótulo da opção ativa. */
  trigger?: React.ReactNode;
  triggerClassName?: string;
  ariaLabel?: string;
}

interface MenuPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

/** Respiro entre o gatilho e o menu, e entre o menu e a borda da tela. */
const GAP = 8;
const EDGE = 12;

const DEFAULT_TRIGGER_CLASS =
  "flex w-full items-center justify-between gap-2 text-left lowercase";

/**
 * Menu suspenso que vive num portal, em posição fixa.
 *
 * Renderizar dentro do próprio formulário faria o menu ser cortado pelo
 * container que rola (era o caso do campo de repetição, o último do modal).
 * No portal ele escapa do recorte e ainda escolhe abrir para cima quando não
 * há espaço abaixo.
 */
export function Select<T>({
  value,
  options,
  onChange,
  trigger,
  triggerClassName = DEFAULT_TRIGGER_CLASS,
  ariaLabel,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const active = options.find((option) => Object.is(option.value, value));

  // Zerar a posição junto com o fechamento faz a próxima abertura medir de novo,
  // em vez de reaproveitar coordenadas de onde o gatilho estava antes.
  const close = useCallback(() => {
    setOpen(false);
    setPosition(null);
  }, []);

  const measure = useCallback(() => {
    const triggerNode = triggerRef.current;
    const menu = menuRef.current;
    if (!triggerNode || !menu) return;

    const rect = triggerNode.getBoundingClientRect();
    const height = menu.offsetHeight;

    // O teclado do celular encolhe a área visível sem mexer no layout viewport.
    const viewport = window.visualViewport;
    const viewTop = viewport?.offsetTop ?? 0;
    const viewBottom = viewTop + (viewport?.height ?? window.innerHeight);

    const roomBelow = viewBottom - rect.bottom - GAP - EDGE;
    const roomAbove = rect.top - viewTop - GAP - EDGE;
    // Abre para cima quando não cabe embaixo — é o caso do último campo do
    // formulário, onde o menu ficaria escondido sob o botão de salvar.
    const up = height > roomBelow && roomAbove > roomBelow;

    setPosition({
      left: rect.left,
      width: rect.width,
      top: up ? Math.max(viewTop + EDGE, rect.top - GAP - height) : rect.bottom + GAP,
      maxHeight: Math.max(140, up ? roomAbove : roomBelow),
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      close();
    };
    // Em captura e cortando a propagação: senão o Esc fecharia junto o modal.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
    };
    // Rolar move o gatilho e o menu ficaria para trás — fechar é mais honesto.
    const onScroll = () => close();
    // Já o teclado abrindo ou fechando muda a área visível sem que o usuário
    // tenha desistido do menu: aí é caso de remedir, não de fechar.
    const onResize = () => measure();

    // O clique que abriu o menu ainda está propagando; espera o próximo tick.
    const timer = setTimeout(() => document.addEventListener("pointerdown", onPointerDown), 0);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
  }, [open, close, measure]);

  // Mede o menu já montado (invisível) antes da pintura, então ele nunca
  // aparece no lugar errado.
  useLayoutEffect(() => {
    if (!open) return;
    measure();
  }, [open, options.length, measure]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={triggerClassName}
      >
        {trigger ?? active?.label ?? ""}
        <ChevronDown
          size={18}
          className={`shrink-0 text-fg-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            className="animate-pop-in scrollbar-thin fixed z-[200] overflow-y-auto overscroll-contain rounded-2xl border border-border-base bg-surface p-1.5 shadow-e3"
            style={
              position
                ? {
                    left: position.left,
                    top: position.top,
                    width: position.width,
                    maxHeight: position.maxHeight,
                  }
                : // Fora da tela até a medição: evita o menu piscar no lugar errado.
                  { left: -9999, top: 0, visibility: "hidden" }
            }
          >
            {options.map((option, index) => {
              const selected = Object.is(option.value, value);
              return (
                <button
                  key={`${option.label}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option.value);
                    close();
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm lowercase transition-colors ${
                    selected ? "bg-surface-3 font-medium" : "hover:bg-surface-2"
                  }`}
                >
                  {option.icon}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
