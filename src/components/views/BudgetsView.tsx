"use client";

import { Pencil, Plus, Target, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { dailyDrain, monthlyBudgetTotal } from "@/lib/ledger";
import type { Budget } from "@/lib/types";

interface BudgetsViewProps {
  budgets: Budget[];
  onCreate: () => void;
  onEdit: (budget: Budget) => void;
  onDelete: (budget: Budget) => void;
}

export function BudgetsView({ budgets, onCreate, onEdit, onDelete }: BudgetsViewProps) {
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
            <article
              key={budget.id}
              className="flex items-center gap-4 rounded-2xl border border-border-base bg-surface p-4"
            >
              <span
                className="grid size-10 shrink-0 place-items-center rounded-xl"
                style={{ background: "var(--diario-soft)", color: "var(--diario)" }}
              >
                <Target size={20} />
              </span>

              <div className="min-w-0 flex-1">
                <h3 className="truncate font-medium lowercase">{budget.name}</h3>
                <p className="text-xs text-fg-subtle tabular">
                  {formatCurrency(budget.amount / budget.divideBy)} por dia · dividido por{" "}
                  {budget.divideBy} dias
                </p>
              </div>

              <span className="shrink-0 font-semibold tabular">
                {formatCurrency(budget.amount)}
              </span>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onEdit(budget)}
                  aria-label={`Editar ${budget.name}`}
                  className="grid size-8 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg"
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(budget)}
                  aria-label={`Excluir ${budget.name}`}
                  className="grid size-8 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-saida-soft hover:text-saida"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}

          {budgets.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border-strong px-6 py-12 text-center">
              <p className="text-sm lowercase text-fg-muted">
                nenhum orçamento fixo ainda.
                <br />
                cadastre suas contas recorrentes para o saldo futuro ficar realista.
              </p>
            </div>
          )}
        </section>

        <button
          type="button"
          onClick={onCreate}
          className="mx-auto flex items-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold lowercase text-brand-fg transition-transform active:scale-95"
        >
          <Plus size={18} /> novo orçamento
        </button>
      </div>
    </div>
  );
}
