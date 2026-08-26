"use client";

import { CreditCard, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { dailyDrain, monthlyBudgetTotal } from "@/lib/ledger";
import type { Budget, Card } from "@/lib/types";

interface PlanningViewProps {
  budgets: Budget[];
  cards: Card[];
  onCreateBudget: () => void;
  onEditBudget: (budget: Budget) => void;
  onDeleteBudget: (budget: Budget) => void;
  onCreateCard: () => void;
  onEditCard: (card: Card) => void;
  onDeleteCard: (card: Card) => void;
}

/** Orçamentos fixos e cartões: o que molda o saldo projetado fora do dia a dia. */
export function PlanningView({
  budgets,
  cards,
  onCreateBudget,
  onEditBudget,
  onDeleteBudget,
  onCreateCard,
  onEditCard,
  onDeleteCard,
}: PlanningViewProps) {
  const total = monthlyBudgetTotal(budgets);
  const perDay = dailyDrain(budgets);

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border-base bg-surface p-4">
            <p className="text-xs font-medium lowercase text-fg-muted">total mensal</p>
            <p className="mt-1.5 text-2xl font-bold tabular">{formatCurrency(total)}</p>
          </div>
          <div className="rounded-2xl border border-border-base bg-surface p-4">
            <p className="text-xs font-medium lowercase text-fg-muted">reserva diária</p>
            <p className="mt-1.5 text-2xl font-bold tabular" style={{ color: "var(--diario)" }}>
              {formatCurrency(perDay)}
            </p>
          </div>
        </section>

        <p className="text-sm text-fg-muted">
          cada orçamento é dividido em uma cota diária que sai do saldo projetado de hoje em
          diante. é o que faz o saldo futuro já considerar as contas que ainda vão chegar.
        </p>

        <section className="flex flex-col gap-3">
          {budgets.map((budget) => (
            <Item
              key={budget.id}
              icon={<Target size={20} />}
              tone="var(--diario)"
              softTone="var(--diario-soft)"
              title={budget.name}
              subtitle={`${formatCurrency(budget.amount / budget.divideBy)} por dia · dividido por ${budget.divideBy} dias`}
              value={formatCurrency(budget.amount)}
              onEdit={() => onEditBudget(budget)}
              onDelete={() => onDeleteBudget(budget)}
            />
          ))}

          {budgets.length === 0 && (
            <Empty>
              nenhum orçamento fixo ainda.
              <br />
              cadastre suas contas recorrentes para o saldo futuro ficar realista.
            </Empty>
          )}
        </section>

        <button
          type="button"
          onClick={onCreateBudget}
          className="mx-auto flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold lowercase text-brand-fg transition-transform active:scale-95"
        >
          <Plus size={18} /> novo orçamento
        </button>

        <hr className="mt-3 border-border-base" />

        <h2 className="text-lg font-semibold lowercase">cartões</h2>

        <p className="text-sm text-fg-muted">
          gastos lançados como cartão não saem do saldo no dia da compra: eles se juntam e
          caem de uma vez no vencimento — inclusive quando a fatura só vence no mês seguinte.
        </p>

        <section className="flex flex-col gap-3">
          {cards.map((card) => (
            <Item
              key={card.id}
              icon={<CreditCard size={20} />}
              tone="var(--cartao)"
              softTone="var(--cartao-soft)"
              title={card.name}
              subtitle={`fatura vence todo dia ${card.dueDay}`}
              onEdit={() => onEditCard(card)}
              onDelete={() => onDeleteCard(card)}
            />
          ))}

          {cards.length === 0 && (
            <Empty>
              nenhum cartão cadastrado.
              <br />
              sem cartão, os gastos de cartão saem do saldo no próprio dia da compra.
            </Empty>
          )}
        </section>

        <button
          type="button"
          onClick={onCreateCard}
          className="mx-auto flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold lowercase text-white transition-transform active:scale-95"
          style={{ background: "var(--cartao)" }}
        >
          <Plus size={18} /> novo cartão
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Item({
  icon,
  tone,
  softTone,
  title,
  subtitle,
  value,
  onEdit,
  onDelete,
}: {
  icon: React.ReactNode;
  tone: string;
  softTone: string;
  title: string;
  subtitle: string;
  value?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="flex items-center gap-4 rounded-2xl border border-border-base bg-surface p-4">
      <span
        className="grid size-10 shrink-0 place-items-center rounded-xl"
        style={{ background: softTone, color: tone }}
      >
        {icon}
      </span>

      <div className="min-w-0 flex-1">
        <h3 className="truncate font-medium lowercase">{title}</h3>
        <p className="text-xs text-fg-subtle tabular">{subtitle}</p>
      </div>

      {value && <span className="shrink-0 font-semibold tabular">{value}</span>}

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${title}`}
          className="grid size-8 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg"
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Excluir ${title}`}
          className="grid size-8 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-saida-soft hover:text-saida"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong px-6 py-12 text-center">
      <p className="text-sm lowercase text-fg-muted">{children}</p>
    </div>
  );
}
