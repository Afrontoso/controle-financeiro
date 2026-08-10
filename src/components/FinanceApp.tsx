"use client";

import { useCallback, useMemo, useState } from "react";
import { AppShell, type ViewKey } from "@/components/shell/AppShell";
import { BalancesView } from "@/components/views/BalancesView";
import { HorizonView } from "@/components/views/HorizonView";
import { TotalsView } from "@/components/views/TotalsView";
import { BudgetsView } from "@/components/views/BudgetsView";
import { DayDrawer } from "@/components/DayDrawer";
import { TransactionModal } from "@/components/TransactionModal";
import { BudgetModal } from "@/components/BudgetModal";
import { PeriodPicker } from "@/components/PeriodPicker";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useFinanceData, type TransactionPayload } from "@/hooks/useFinanceData";
import {
  buildLedger,
  shiftMonth,
  summarizeMonth,
  summarizeYear,
  type MonthEntry,
  type YearMonth,
} from "@/lib/ledger";
import { fromDateStr, toDateStr } from "@/lib/format";
import type { Budget, Transaction, TxType } from "@/lib/types";

/** Meses exibidos de uma vez em saldos e horizonte. */
const WINDOW_SPAN = 12;

const VIEW_TITLES: Record<ViewKey, string> = {
  saldos: "saldos",
  totais: "totais",
  horizonte: "horizonte de saldos",
  orcamentos: "orçamentos",
};

export function FinanceApp() {
  const showToast = useToast();
  const finance = useFinanceData();
  const { transactions, budgets, loading } = finance;

  const [today] = useState(() => new Date());
  const todayMonth = useMemo<YearMonth>(
    () => ({ year: today.getFullYear(), month: today.getMonth() }),
    [today],
  );

  const [view, setView] = useState<ViewKey>("saldos");
  const [windowStart, setWindowStart] = useState<YearMonth>(todayMonth);
  const [totalsMonth, setTotalsMonth] = useState<YearMonth>(todayMonth);
  const [mobileType, setMobileType] = useState<TxType>("saida");
  const [scrollToTodayToken, setScrollToTodayToken] = useState(0);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [txModalOpen, setTxModalOpen] = useState(false);
  /** Muda a cada abertura para o formulário remontar limpo. */
  const [txModalSession, setTxModalSession] = useState(0);
  const [txModalDate, setTxModalDate] = useState(() => toDateStr(new Date()));
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [pendingPayload, setPendingPayload] = useState<TransactionPayload | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);

  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deletingBudget, setDeletingBudget] = useState<Budget | null>(null);

  const [submitting, setSubmitting] = useState(false);

  /* ---------------- dados derivados ---------------- */

  const windowMonths: MonthEntry[] = useMemo(
    () =>
      buildLedger({
        transactions,
        budgets,
        today,
        from: windowStart,
        to: shiftMonth(windowStart, WINDOW_SPAN - 1),
      }),
    [transactions, budgets, today, windowStart],
  );

  const summary = useMemo(() => {
    const [month] = buildLedger({
      transactions,
      budgets,
      today,
      from: totalsMonth,
      to: totalsMonth,
    });
    return month ? summarizeMonth(month, budgets, today) : null;
  }, [transactions, budgets, today, totalsMonth]);

  const annual = useMemo(
    () => summarizeYear(transactions, totalsMonth.year),
    [transactions, totalsMonth.year],
  );

  const dayTransactions = useMemo(
    () => (selectedDay ? transactions.filter((tx) => tx.date === selectedDay) : []),
    [transactions, selectedDay],
  );

  /* ---------------- ações ---------------- */

  const goToToday = useCallback(() => {
    setWindowStart(todayMonth);
    setTotalsMonth(todayMonth);
    setScrollToTodayToken((token) => token + 1);
  }, [todayMonth]);

  const openCreateModal = useCallback(
    (date?: string) => {
      setEditingTx(null);
      setTxModalDate(date ?? selectedDay ?? toDateStr(today));
      setTxModalSession((session) => session + 1);
      setTxModalOpen(true);
    },
    [selectedDay, today],
  );

  const openEditModal = useCallback((tx: Transaction) => {
    setEditingTx(tx);
    setTxModalDate(tx.date);
    setTxModalSession((session) => session + 1);
    setTxModalOpen(true);
  }, []);

  const closeTxModal = useCallback(() => {
    setTxModalOpen(false);
    setEditingTx(null);
  }, []);

  const persistTransaction = useCallback(
    async (payload: TransactionPayload, applyToAll: boolean) => {
      setSubmitting(true);
      try {
        if (editingTx) {
          await finance.updateTransaction(editingTx.id, payload, applyToAll);
          showToast("lançamento atualizado.");
        } else {
          await finance.createTransaction(payload);
          showToast("lançamento registrado.");
        }
        setTxModalOpen(false);
        setEditingTx(null);
        setPendingPayload(null);
      } catch (error) {
        console.error(error);
        showToast("não foi possível salvar.", "error");
      } finally {
        setSubmitting(false);
      }
    },
    [editingTx, finance, showToast],
  );

  const handleSubmitTransaction = useCallback(
    (payload: TransactionPayload) => {
      // Editar uma parcela de série exige escolher o alcance da mudança.
      if (editingTx?.groupId) {
        setPendingPayload(payload);
        return;
      }
      void persistTransaction(payload, false);
    },
    [editingTx, persistTransaction],
  );

  const confirmDeleteTransaction = useCallback(
    async (deleteAll: boolean) => {
      if (!deletingTx) return;
      setSubmitting(true);
      try {
        await finance.deleteTransaction(deletingTx.id, deleteAll);
        showToast("lançamento excluído.");
        setDeletingTx(null);
      } catch (error) {
        console.error(error);
        showToast("não foi possível excluir.", "error");
      } finally {
        setSubmitting(false);
      }
    },
    [deletingTx, finance, showToast],
  );

  const handleSaveBudget = useCallback(
    async (budget: { id?: string | null; name: string; amount: number; divideBy: number }) => {
      setSubmitting(true);
      try {
        await finance.saveBudget(budget);
        showToast("orçamento salvo.");
        setBudgetModalOpen(false);
        setEditingBudget(null);
      } catch (error) {
        console.error(error);
        showToast("não foi possível salvar o orçamento.", "error");
      } finally {
        setSubmitting(false);
      }
    },
    [finance, showToast],
  );

  const confirmDeleteBudget = useCallback(async () => {
    if (!deletingBudget) return;
    setSubmitting(true);
    try {
      await finance.deleteBudget(deletingBudget.id);
      showToast("orçamento excluído.");
      setDeletingBudget(null);
    } catch (error) {
      console.error(error);
      showToast("não foi possível excluir o orçamento.", "error");
    } finally {
      setSubmitting(false);
    }
  }, [deletingBudget, finance, showToast]);

  const stepDay = useCallback((delta: number) => {
    setSelectedDay((current) => {
      if (!current) return current;
      const date = fromDateStr(current);
      date.setDate(date.getDate() + delta);
      return toDateStr(date);
    });
  }, []);

  /* ---------------- render ---------------- */

  if (loading) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-bg text-sm lowercase text-fg-muted">
        carregando seu fluxo de caixa...
      </main>
    );
  }

  return (
    <AppShell
      view={view}
      onViewChange={setView}
      onAdd={() => openCreateModal()}
      onGoToday={goToToday}
    >
      <ViewHeader title={VIEW_TITLES[view]}>
        {view === "saldos" || view === "horizonte" ? (
          <PeriodPicker start={windowStart} span={WINDOW_SPAN} onChange={setWindowStart} />
        ) : view === "totais" ? (
          <PeriodPicker start={totalsMonth} span={1} onChange={setTotalsMonth} />
        ) : null}
      </ViewHeader>

      {view === "saldos" && (
        <BalancesView
          months={windowMonths}
          mobileType={mobileType}
          onMobileTypeChange={setMobileType}
          onSelectDay={setSelectedDay}
          scrollToTodayToken={scrollToTodayToken}
        />
      )}

      {view === "horizonte" && (
        <HorizonView
          months={windowMonths}
          onSelectDay={setSelectedDay}
          scrollToTodayToken={scrollToTodayToken}
        />
      )}

      {view === "totais" && summary && (
        <TotalsView summary={summary} annual={annual} onSelectDay={setSelectedDay} />
      )}

      {view === "orcamentos" && (
        <BudgetsView
          budgets={budgets}
          onCreate={() => {
            setEditingBudget(null);
            setBudgetModalOpen(true);
          }}
          onEdit={(budget) => {
            setEditingBudget(budget);
            setBudgetModalOpen(true);
          }}
          onDelete={setDeletingBudget}
        />
      )}

      {selectedDay && (
        <DayDrawer
          dateStr={selectedDay}
          transactions={dayTransactions}
          onClose={() => setSelectedDay(null)}
          onStepDay={stepDay}
          onAdd={() => openCreateModal(selectedDay)}
          onEdit={openEditModal}
          onDelete={setDeletingTx}
        />
      )}

      {txModalOpen && (
        <TransactionModal
          key={txModalSession}
          onClose={closeTxModal}
          date={txModalDate}
          editing={editingTx}
          defaultType={mobileType}
          submitting={submitting}
          onSubmit={handleSubmitTransaction}
        />
      )}

      {budgetModalOpen && (
        <BudgetModal
          key={editingBudget?.id ?? "novo"}
          onClose={() => {
            setBudgetModalOpen(false);
            setEditingBudget(null);
          }}
          editing={editingBudget}
          submitting={submitting}
          onSubmit={handleSaveBudget}
        />
      )}

      {pendingPayload && (
        <ConfirmDialog
          onClose={() => setPendingPayload(null)}
          title="alterar recorrência"
          description="este lançamento se repete. o que você quer alterar?"
          busy={submitting}
          actions={[
            {
              label: "alterar todas as parcelas",
              onClick: () => void persistTransaction(pendingPayload, true),
            },
            {
              label: "alterar apenas esta",
              onClick: () => void persistTransaction(pendingPayload, false),
            },
          ]}
        />
      )}

      {deletingTx && (
        <ConfirmDialog
          onClose={() => setDeletingTx(null)}
          title="excluir lançamento"
          description={
            deletingTx.groupId
              ? "este lançamento se repete. o que você quer excluir?"
              : "essa ação não pode ser desfeita."
          }
          busy={submitting}
          actions={
            deletingTx.groupId
              ? [
                  {
                    label: "excluir todas as parcelas",
                    onClick: () => void confirmDeleteTransaction(true),
                    tone: "danger",
                  },
                  {
                    label: "excluir apenas esta",
                    onClick: () => void confirmDeleteTransaction(false),
                  },
                ]
              : [
                  {
                    label: "excluir lançamento",
                    onClick: () => void confirmDeleteTransaction(false),
                    tone: "danger",
                  },
                ]
          }
        />
      )}

      {deletingBudget && (
        <ConfirmDialog
          onClose={() => setDeletingBudget(null)}
          title="excluir orçamento"
          description={`"${deletingBudget.name}" deixará de reservar valor no saldo projetado.`}
          busy={submitting}
          actions={[
            {
              label: "excluir orçamento",
              onClick: () => void confirmDeleteBudget(),
              tone: "danger",
            },
          ]}
        />
      )}
    </AppShell>
  );
}
