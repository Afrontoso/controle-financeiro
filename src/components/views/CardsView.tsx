"use client";

import { CreditCard, Pencil, Plus, Trash2 } from "lucide-react";
import { dayShortLabel, toDateStr } from "@/lib/format";
import { nextDueDate } from "@/lib/ledger";
import type { Card } from "@/lib/types";

interface CardsViewProps {
  cards: Card[];
  onCreate: () => void;
  onEdit: (card: Card) => void;
  onDelete: (card: Card) => void;
}

export function CardsView({ cards, onCreate, onEdit, onDelete }: CardsViewProps) {
  const hoje = toDateStr(new Date());

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <p className="text-sm text-fg-muted">
          gastos lançados como cartão não saem do saldo no dia da compra: eles se juntam e
          caem de uma vez no vencimento — inclusive quando a fatura só vence no mês seguinte.
        </p>

        <section className="flex flex-col gap-3">
          {cards.map((card) => (
            <article
              key={card.id}
              className="flex items-center gap-4 rounded-2xl border border-border-base bg-surface p-4"
            >
              <span
                className="grid size-10 shrink-0 place-items-center rounded-xl"
                style={{ background: "var(--cartao-soft)", color: "var(--cartao)" }}
              >
                <CreditCard size={20} />
              </span>

              <div className="min-w-0 flex-1">
                <h3 className="truncate font-medium lowercase">{card.name}</h3>
                <p className="text-xs lowercase text-fg-subtle tabular">
                  vence todo dia {card.dueDay} · uma compra de hoje cai em{" "}
                  {dayShortLabel(nextDueDate(hoje, card.dueDay))}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onEdit(card)}
                  aria-label={`Editar ${card.name}`}
                  className="grid size-8 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(card)}
                  aria-label={`Excluir ${card.name}`}
                  className="grid size-8 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-saida-soft hover:text-saida"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}

          {cards.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border-strong px-6 py-12 text-center">
              <p className="text-sm lowercase text-fg-muted">
                nenhum cartão cadastrado.
                <br />
                sem cartão, os gastos de cartão saem do saldo no próprio dia da compra.
              </p>
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={onCreate}
          className="mx-auto flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold lowercase text-white transition-transform active:scale-95"
          style={{ background: "var(--cartao)" }}
        >
          <Plus size={18} /> novo cartão
        </button>
      </div>
    </div>
  );
}
