"use client";

import { useCallback, useMemo, useState } from "react";
import { AppShell, type ViewKey } from "@/components/shell/AppShell";
import { BalancesView } from "@/components/views/BalancesView";
import { HorizonView } from "@/components/views/HorizonView";
import { TotalsView } from "@/components/views/TotalsView";
import { BudgetsView } from "@/components/views/BudgetsView";
import { CardsView } from "@/components/views/CardsView";
import { MenuView } from "@/components/views/MenuView";
import { OverviewView } from "@/components/views/OverviewView";
import { ApartmentView } from "@/components/views/ApartmentView";
import { ApartmentPlanModal } from "@/components/ApartmentPlanModal";
import { VaultsView, vaultDeleteDescription } from "@/components/views/VaultsView";
import { VaultModal } from "@/components/VaultModal";
import { BanksView, NEW_CARD } from "@/components/views/BanksView";
import { useOpenFinance, type ResolveAction } from "@/hooks/useOpenFinance";
import { fixedLivingCost, sortVaults, vaultBalances } from "@/lib/vaults";
import { DayDrawer, type DayFilter } from "@/components/DayDrawer";
import { TransactionModal } from "@/components/TransactionModal";
import { BudgetModal } from "@/components/BudgetModal";
import { CardModal } from "@/components/CardModal";
import { PeriodPicker } from "@/components/PeriodPicker";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { useFinanceData, type TransactionPayload, type VaultPayload } from "@/hooks/useFinanceData";
import { useApartment } from "@/hooks/useApartment";
import { EMPTY_PREMISES, isPlanComplete, type ApartmentPremises } from "@/lib/apartment";
import {
  buildLedger,
  cardLimitUsage,
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
import type { Budget, Card, Transaction, TxType, Vault } from "@/lib/types";

/** Meses exibidos de uma vez em saldos e horizonte. */
const WINDOW_SPAN = 12;

/** Meses da visão geral: o escolhido e os seguintes, para faturas e projeção. */
const OVERVIEW_SPAN = 6;

const VIEW_TITLES: Record<ViewKey, string> = {
  visao: "visão geral",
  saldos: "saldos",
  totais: "totais",
  horizonte: "horizonte de saldos",
  orcamentos: "orçamentos",
  apartamento: "apartamento",
  cofres: "cofres",
  bancos: "bancos",
  cartoes: "cartões de crédito",
  menu: "menu",
};

export function FinanceApp() {
  const showToast = useToast();
  const finance = useFinanceData();
  const { transactions, budgets, cards, vaults, loading } = finance;
  const apartment = useApartment();
  const openFinance = useOpenFinance();
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [vaultModal, setVaultModal] = useState<{ editing: Vault | null; asReserve?: boolean } | null>(null);
  const [deletingVault, setDeletingVault] = useState<Vault | null>(null);
  /** Guardar/resgatar a partir de um cofre: tipo e cofre já escolhidos no modal. */
  const [txPreset, setTxPreset] = useState<{ type: TxType; vaultId: string } | null>(null);
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);

  const [today] = useState(() => new Date());
  const todayMonth = useMemo<YearMonth>(
    () => ({ year: today.getFullYear(), month: today.getMonth() }),
    [today],
  );

  const [view, setView] = useState<ViewKey>("visao");
  const [windowStart, setWindowStart] = useState<YearMonth>(todayMonth);
  const [totalsMonth, setTotalsMonth] = useState<YearMonth>(todayMonth);
  const [overviewMonth, setOverviewMonth] = useState<YearMonth>(todayMonth);
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

  const overviewMonths: MonthEntry[] = useMemo(
    () =>
      buildLedger({
        transactions,
        budgets,
        cards,
        today,
        from: overviewMonth,
        to: shiftMonth(overviewMonth, OVERVIEW_SPAN - 1),
      }),
    [transactions, budgets, cards, today, overviewMonth],
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

  const fixedCost = useMemo(
    () => fixedLivingCost(transactions, budgets, today),
    [transactions, budgets, today],
  );
  const balances = useMemo(
    () => sortVaults(vaultBalances(vaults, transactions, today, fixedCost)),
    [vaults, transactions, today, fixedCost],
  );

  const cardIndex = useMemo(() => indexCards(cards), [cards]);

  /** Saldo que o app projeta para hoje: comparado com o do banco na tela de bancos. */
  const appBalanceToday = useMemo(() => {
    const [month] = buildLedger({ transactions, budgets, cards, today, from: todayMonth, to: todayMonth });
    return month?.days.find((day) => day.isToday)?.saldo ?? 0;
  }, [transactions, budgets, cards, today, todayMonth]);
  const cardUsage = useMemo(() => cardLimitUsage(transactions, cards, today), [transactions, cards, today]);

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
    setOverviewMonth(todayMonth);
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
    setTxPreset(null);
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
    async (card: { id?: string | null; name: string; dueDay: number; limit: number | null }) => {
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

  const openVaultMove = useCallback(
    (vault: Vault, kind: "guardar" | "resgatar") => {
      setTxPreset({ type: kind === "guardar" ? "investimento" : "entrada", vaultId: vault.id });
      setEditingTx(null);
      setTxModalDate(toDateStr(today));
      setTxModalSession((session) => session + 1);
      setTxModalOpen(true);
    },
    [today],
  );

  const handleSaveVault = useCallback(
    async (vault: VaultPayload) => {
      setSubmitting(true);
      try {
        await finance.saveVault(vault);
        showToast("cofre salvo.");
        setVaultModal(null);
      } catch (error) {
        console.error(error);
        showToast("não foi possível salvar o cofre.", "error");
      } finally {
        setSubmitting(false);
      }
    },
    [finance, showToast],
  );

  const confirmDeleteVault = useCallback(async () => {
    if (!deletingVault) return;
    setSubmitting(true);
    try {
      await finance.deleteVault(deletingVault.id);
      showToast("cofre excluído.");
      setDeletingVault(null);
    } catch (error) {
      console.error(error);
      showToast("não foi possível excluir o cofre.", "error");
    } finally {
      setSubmitting(false);
    }
  }, [deletingVault, finance, showToast]);

  const syncBanks = useCallback(async () => {
    try {
      const r = await openFinance.sync();
      showToast(
        r.naCaixa > 0
          ? `${r.naCaixa} ${r.naCaixa === 1 ? "transação nova" : "transações novas"} na caixa de entrada.`
          : r.novas > 0
            ? `${r.novas} transações lidas, nenhuma precisa de você.`
            : "nada novo nos bancos.",
      );
    } catch (error) {
      console.error(error);
      showToast("não foi possível ler os bancos agora.", "error");
    }
  }, [openFinance, showToast]);

  const resolveBank = useCallback(
    async (actions: ResolveAction[]) => {
      try {
        const { failed } = await openFinance.resolve(actions);
        await finance.refreshTransactions();
        const ok = actions.length - failed.length;
        if (failed.length > 0) showToast(`${failed.length} não ${failed.length === 1 ? "deu" : "deram"} certo; tente de novo.`, "error");
        else if (actions.some((a) => a.action === "import" || a.action === "link")) {
          showToast(ok === 1 ? "lançado." : `${ok} lançados.`);
        }
      } catch (error) {
        console.error(error);
        showToast("não foi possível aplicar.", "error");
      }
    },
    [openFinance, finance, showToast],
  );

  const adjustBalance = useCallback(
    async (diff: number) => {
      try {
        await finance.createTransaction({
          date: toDateStr(today),
          type: diff > 0 ? "entrada" : "saida",
          amount: Math.abs(Math.round(diff * 100) / 100),
          description: "ajuste com o saldo do banco",
        });
        showToast("ajuste lançado. o saldo do app agora bate com o banco.");
      } catch (error) {
        console.error(error);
        showToast("não foi possível lançar o ajuste.", "error");
      }
    },
    [finance, today, showToast],
  );

  const linkBankCard = useCallback(
    async (accountId: string, cardId: string | null) => {
      try {
        const account = openFinance.snapshot?.accounts.find((a) => a.id === accountId);
        // Um cartão do banco corresponde a no máximo um cartão do app.
        for (const card of cards.filter((c) => c.pluggyAccountId === accountId && c.id !== cardId)) {
          await finance.saveCard({ ...card, limit: card.limit ?? null, pluggyAccountId: null });
        }
        if (cardId === NEW_CARD) {
          const dueDay = account?.balanceDueDate ? Number(account.balanceDueDate.slice(8, 10)) : 10;
          await finance.saveCard({
            name: (account?.name ?? "cartão").toLowerCase(),
            dueDay,
            limit: account?.creditLimit ?? null,
            pluggyAccountId: accountId,
          });
          showToast("cartão criado e vinculado.");
        } else if (cardId) {
          const card = cards.find((c) => c.id === cardId);
          if (card) {
            await finance.saveCard({
              ...card,
              limit: account?.creditLimit ?? card.limit ?? null,
              pluggyAccountId: accountId,
            });
            showToast("cartão vinculado.");
          }
        }
      } catch (error) {
        console.error(error);
        showToast("não foi possível vincular o cartão.", "error");
      }
    },
    [openFinance.snapshot, cards, finance, showToast],
  );

  /** Gera os lançamentos do plano e recarrega o saldo. */
  const syncPlan = useCallback(async () => {
    setPlanBusy(true);
    try {
      const created = await apartment.syncTransactions();
      await finance.refreshTransactions();
      showToast(`${created} lançamentos do apê no saldo.`);
    } catch (error) {
      console.error(error);
      showToast("não foi possível lançar o plano.", "error");
    } finally {
      setPlanBusy(false);
    }
  }, [apartment, finance, showToast]);

  const savePlan = useCallback(
    async (premises: ApartmentPremises) => {
      setPlanBusy(true);
      try {
        await apartment.savePlan(premises);
        setPlanModalOpen(false);
        showToast(
          isPlanComplete(premises)
            ? "premissas salvas. toque em “lançar no saldo” para atualizar as parcelas."
            : "premissas salvas.",
        );
      } catch (error) {
        console.error(error);
        showToast("não foi possível salvar as premissas.", "error");
      } finally {
        setPlanBusy(false);
      }
    },
    [apartment, showToast],
  );

  const applyAmortization = useCallback(
    async (extra: number, modo: "prazo" | "parcela") => {
      if (!apartment.plan) return;
      setPlanBusy(true);
      try {
        await apartment.savePlan({ ...apartment.plan, amortizacaoExtra: extra, amortizacaoModo: modo });
        showToast(
          extra > 0
            ? "amortização salva no plano. toque em “lançar no saldo” para atualizar as parcelas."
            : "amortização tirada do plano. toque em “lançar no saldo” para atualizar.",
        );
      } catch (error) {
        console.error(error);
        showToast("não foi possível salvar a amortização.", "error");
      } finally {
        setPlanBusy(false);
      }
    },
    [apartment, showToast],
  );

  const confirmDeletePlan = useCallback(async () => {
    setPlanBusy(true);
    try {
      await apartment.deletePlan();
      await finance.refreshTransactions();
      setDeletingPlan(false);
      showToast("plano excluído.");
    } catch (error) {
      console.error(error);
      showToast("não foi possível excluir o plano.", "error");
    } finally {
      setPlanBusy(false);
    }
  }, [apartment, finance, showToast]);

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
      hiddenViews={openFinance.enabled ? [] : ["bancos"]}
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
        ) : view === "visao" ? (
          <PeriodPicker start={overviewMonth} span={1} onChange={setOverviewMonth} />
        ) : null}
      </ViewHeader>

      {view === "visao" && (
        <OverviewView
          months={overviewMonths}
          cards={cards}
          transactions={transactions}
          onTogglePaid={(ids, paid) => {
            finance.setPaid(ids, paid).catch((error) => {
              console.error(error);
              showToast("não foi possível marcar como paga.", "error");
            });
          }}
          savings={savings}
          today={today}
          plan={apartment.plan}
          onOpenApartment={() => setView("apartamento")}
          onOpenVaults={() => setView("cofres")}
          inboxCount={openFinance.enabled ? openFinance.pending.length : 0}
          onOpenBanks={() => setView("bancos")}
          reserve={balances.find((b) => b.vault.kind === "reserva") ?? null}
          fixedCost={fixedCost}
          onSelectDay={(dateStr) => openDay(dateStr)}
          onOpenMonth={(year, month) => {
            setTotalsMonth({ year, month });
            setView("totais");
          }}
        />
      )}

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

      {view === "apartamento" && (
        <ApartmentView
          plan={apartment.plan}
          today={today}
          busy={planBusy}
          onEdit={() => setPlanModalOpen(true)}
          onSync={() => void syncPlan()}
          onDelete={() => setDeletingPlan(true)}
          onApplyAmortization={(extra, modo) => void applyAmortization(extra, modo)}
        />
      )}

      {view === "cofres" && (
        <VaultsView
          balances={balances}
          fixedCost={fixedCost}
          onCreate={(asReserve) => setVaultModal({ editing: null, asReserve })}
          onEdit={(vault) => setVaultModal({ editing: vault })}
          onDelete={setDeletingVault}
          onMove={openVaultMove}
        />
      )}

      {view === "bancos" && openFinance.enabled && (
        <BanksView
          syncedAt={openFinance.syncedAt}
          snapshot={openFinance.snapshot}
          pending={openFinance.pending}
          ignored={openFinance.ignored}
          linkedIds={openFinance.linkedIds}
          syncing={openFinance.syncing}
          transactions={transactions}
          cards={cards}
          vaults={vaults}
          appBalanceToday={appBalanceToday}
          today={today}
          onSync={() => void syncBanks()}
          onResolve={(actions) => void resolveBank(actions)}
          onAdjustBalance={(diff) => void adjustBalance(diff)}
          onLinkCard={(accountId, cardId) => void linkBankCard(accountId, cardId)}
        />
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
          usage={cardUsage}
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
          onOpenHorizon={() => setView("horizonte")}
          onOpenApartment={() => setView("apartamento")}
          onOpenVaults={() => setView("cofres")}
          onOpenBanks={openFinance.enabled ? () => setView("bancos") : undefined}
          onResetData={finance.resetAllData}
          dataCounts={{
            transactions: transactions.length,
            budgets: budgets.length,
            cards: cards.length,
          }}
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
          defaultType={txPreset?.type ?? (dayFilter === "todos" ? mobileType : dayFilter)}
          defaultVaultId={txPreset?.vaultId ?? null}
          cards={cards}
          vaults={vaults}
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

      {vaultModal && (
        <VaultModal
          editing={vaultModal.editing}
          asReserve={vaultModal.asReserve}
          fixedCost={fixedCost}
          busy={submitting}
          onClose={() => setVaultModal(null)}
          onSave={(vault) => void handleSaveVault(vault)}
        />
      )}

      {deletingVault && (
        <ConfirmDialog
          onClose={() => setDeletingVault(null)}
          title={`excluir "${deletingVault.name}"`}
          description={vaultDeleteDescription(balances.find((b) => b.vault.id === deletingVault.id))}
          busy={submitting}
          actions={[
            {
              label: "excluir cofre",
              onClick: () => void confirmDeleteVault(),
              tone: "danger",
            },
          ]}
        />
      )}

      {planModalOpen && (
        <ApartmentPlanModal
          initial={apartment.plan ?? EMPTY_PREMISES}
          busy={planBusy}
          onClose={() => setPlanModalOpen(false)}
          onSave={(premises) => void savePlan(premises)}
        />
      )}

      {deletingPlan && (
        <ConfirmDialog
          onClose={() => setDeletingPlan(false)}
          title="excluir plano do apartamento"
          description="as premissas e as parcelas do apê de hoje em diante saem do saldo. as que já passaram continuam lançadas."
          busy={planBusy}
          actions={[
            {
              label: "excluir plano",
              onClick: () => void confirmDeletePlan(),
              tone: "danger",
            },
          ]}
        />
      )}
    </AppShell>
  );
}
