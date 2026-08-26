"use client";

import { useCallback, useMemo, useState } from "react";
import { AppShell, type ViewKey } from "@/components/shell/AppShell";
import { BalancesView } from "@/components/views/BalancesView";
import { HorizonView } from "@/components/views/HorizonView";
import { TotalsView } from "@/components/views/TotalsView";
import { BudgetsView } from "@/components/views/BudgetsView";
import { CardsView } from "@/components/views/CardsView";
import { MenuView } from "@/components/views/MenuView";
import { DayDrawer, type DayFilter } from "@/components/DayDrawer";
import { TransactionModal } from "@/components/TransactionModal";
import { BudgetModal } from "@/components/BudgetModal";
import { CardModal } from "@/components/CardModal";
import { PeriodPicker } from "@/components/PeriodPicker";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useFinanceData, type TransactionPayload } from "@/hooks/useFinanceData";
import {
  buildLedger,
  chargeDateOf,
  indexCards,
  shiftMonth,
  summarizeMonth,
  summarizeSavings,
  summarizeYear,
  type MonthEntry,
  type YearMonth,
} from "@/lib/ledger";
import { fromDateStr, toDateStr } from "@/lib/format";
import type { Budget, Card, Transaction, TxType } from "@/lib/types";

/** Meses exibidos de uma vez em saldos e horizonte. */
const WINDOW_SPAN = 12;

const VIEW_TITLES: Record<ViewKey, string> = {
  saldos: "saldos",
  totais: "totais",
  horizonte: "horizonte de saldos",
  orcamentos: "orçamentos",
  cartoes: "cartões de crédito",
  menu: "menu",
};

export function FinanceApp() {
  const showToast = useToast();
  const finance = useFinanceData();
  const { transactions, budgets, cards, loading } = finance;

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
  const [dayFilter, setDayFilter] = useState<DayFilter>("todos");

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

  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [deletingCard, setDeletingCard] = useState<Card | null>(null);

  const [submitting, setSubmitting] = useState(false);

  /* ---------------- dados derivados ---------------- */

  const windowMonths: MonthEntry[] = useMemo(
    () =>
      buildLedger({
        transactions,
        budgets,
        cards,
        today,
        from: windowStart,
        to: shiftMonth(windowStart, WINDOW_SPAN - 1),
      }),
    [transactions, budgets, cards, today, windowStart],
  );

  const summary = useMemo(() => {
    const [month] = buildLedger({
      transactions,
      budgets,
      cards,
      today,
      from: totalsMonth,
      to: totalsMonth,
    });
    return month ? summarizeMonth(month, budgets, today) : null;
  }, [transactions, budgets, cards, today, totalsMonth]);

  const annual = useMemo(
    () => summarizeYear(transactions, totalsMonth.year),
    [transactions, totalsMonth.year],
  );

  const savings = useMemo(() => summarizeSavings(transactions, today), [transactions, today]);

  const cardIndex = useMemo(() => indexCards(cards), [cards]);

  // O dia mostra o que sai do bolso nele: a compra no cartão aparece no dia do
  // vencimento, junto com o resto da fatura, e não no dia em que foi feita.
  const dayTransactions = useMemo(
    () =>
      selectedDay
        ? transactions.filter((tx) => chargeDateOf(tx, cardIndex) === selectedDay)
        : [],
    [transactions, cardIndex, selectedDay],
  );

  /* ---------------- ações ---------------- */

  /** Abre o painel do dia; com `type`, já na coluna que foi clicada. */
  const openDay = useCallback((dateStr: string, type?: TxType) => {
    setSelectedDay(dateStr);
    setDayFilter(type ?? "todos");
  }, []);

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

  const handleSaveCard = useCallback(
    async (card: { id?: string | null; name: string; dueDay: number }) => {
      setSubmitting(true);
      try {
        await finance.saveCard(card);
        showToast("cartão salvo.");
        setCardModalOpen(false);
        setEditingCard(null);
      } catch (error) {
        console.error(error);
        showToast("não foi possível salvar o cartão.", "error");
      } finally {
        setSubmitting(false);
      }
    },
    [finance, showToast],
  );

  const confirmDeleteCard = useCallback(async () => {
    if (!deletingCard) return;
    setSubmitting(true);
    try {
      await finance.deleteCard(deletingCard.id);
      showToast("cartão excluído.");
      setDeletingCard(null);
    } catch (error) {
      console.error(error);
      showToast("não foi possível excluir o cartão.", "error");
    } finally {
      setSubmitting(false);
    }
  }, [deletingCard, finance, showToast]);

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
      <ViewHeader
        title={VIEW_TITLES[view]}
        // Cartões é uma tela filha do menu: precisa de caminho de volta.
        onBack={view === "cartoes" ? () => setView("menu") : undefined}
      >
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
          onSelectDay={openDay}
          scrollToTodayToken={scrollToTodayToken}
        />
      )}

      {view === "horizonte" && (
        <HorizonView
          months={windowMonths}
          onSelectDay={openDay}
          scrollToTodayToken={scrollToTodayToken}
        />
      )}

      {view === "totais" && summary && (
        <TotalsView summary={summary} annual={annual} savings={savings} onSelectDay={openDay} />
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

      {view === "cartoes" && (
        <CardsView
          cards={cards}
          onCreate={() => {
            setEditingCard(null);
            setCardModalOpen(true);
          }}
          onEdit={(card) => {
            setEditingCard(card);
            setCardModalOpen(true);
          }}
          onDelete={setDeletingCard}
        />
      )}

      {view === "menu" && (
        <MenuView
          onOpenCards={() => setView("cartoes")}
          // "ir pra hoje" a partir do menu só faz sentido de volta na tabela.
          onGoToday={() => {
            setView("saldos");
            goToToday();
          }}
        />
      )}

      {selectedDay && (
        <DayDrawer
          dateStr={selectedDay}
          transactions={dayTransactions}
          cards={cards}
          filter={dayFilter}
          onFilterChange={setDayFilter}
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
          // Estando o painel filtrado numa coluna, o novo lançamento já nasce nela.
          defaultType={dayFilter === "todos" ? mobileType : dayFilter}
          cards={cards}
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

      {cardModalOpen && (
        <CardModal
          key={editingCard?.id ?? "novo"}
          onClose={() => {
            setCardModalOpen(false);
            setEditingCard(null);
          }}
          editing={editingCard}
          submitting={submitting}
          onSubmit={handleSaveCard}
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

      {deletingCard && (
        <ConfirmDialog
          onClose={() => setDeletingCard(null)}
          title="excluir cartão"
          description={`os lançamentos de "${deletingCard.name}" continuam salvos, mas voltam a sair do saldo no dia da compra.`}
          busy={submitting}
          actions={[
            {
              label: "excluir cartão",
              onClick: () => void confirmDeleteCard(),
              tone: "danger",
            },
          ]}
        />
      )}
    </AppShell>
  );
}
