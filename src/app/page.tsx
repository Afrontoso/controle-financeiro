"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, ChevronLeft, ChevronRight, Wallet, X, Target, Trash2, Edit2, TrendingUp, Calculator } from 'lucide-react';

// Tipagens
interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category?: string;
  type?: string;
  groupId?: string;
}

interface Budget {
  id: string;
  name: string;
  amount: number;
  divideBy: number;
}

export default function CashFlowApp() {
  const [todayDate] = useState(new Date());
  const [currentDate, setCurrentDate] = useState(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));

  const [isFabOpen, setIsFabOpen] = useState(false);
  const [isBudgetListModalOpen, setIsBudgetListModalOpen] = useState(false);
  const [filter, setFilter] = useState('diario');

  const todayRef = useRef<HTMLDivElement>(null);

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isSavingsDashboardOpen, setIsSavingsDashboardOpen] = useState(false);
  const [isSavingsClosing, setIsSavingsClosing] = useState(false);
  const [showSavingsProgress, setShowSavingsProgress] = useState(false);
  const [isTotalsOpen, setIsTotalsOpen] = useState(false);
  const [isTotalsClosing, setIsTotalsClosing] = useState(false);

  const closeSavingsDashboard = () => {
    setIsSavingsClosing(true);
    setTimeout(() => {
      setIsSavingsDashboardOpen(false);
      setIsSavingsClosing(false);
    }, 300);
  };

  const closeTotals = () => {
    setIsTotalsClosing(true);
    setTimeout(() => {
      setIsTotalsOpen(false);
      setIsTotalsClosing(false);
    }, 300);
  };

  const [isDailyDashOpen, setIsDailyDashOpen] = useState(false);
  const [isDailyDashClosing, setIsDailyDashClosing] = useState(false);

  const [isCostOfLivingOpen, setIsCostOfLivingOpen] = useState(false);
  const [isCostOfLivingClosing, setIsCostOfLivingClosing] = useState(false);

  const closeDailyDash = () => {
    setIsDailyDashClosing(true);
    setTimeout(() => {
      setIsDailyDashOpen(false);
      setIsDailyDashClosing(false);
    }, 300);
  };

  const closeCostOfLiving = () => {
    setIsCostOfLivingClosing(true);
    setTimeout(() => {
      setIsCostOfLivingOpen(false);
      setIsCostOfLivingClosing(false);
    }, 300);
  };

  useEffect(() => {
    if (isSavingsDashboardOpen) {
      const timer = setTimeout(() => setShowSavingsProgress(true), 150);
      return () => clearTimeout(timer);
    } else {
      setShowSavingsProgress(false);
    }
  }, [isSavingsDashboardOpen]);

  // --- DADOS (Carregados via Fetch) ---
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransacoes = async () => {
    try {
      const res = await fetch("/api/transactions");
      const data = await res.json();
      const formatTxs = data.map((t: any) => ({
        id: t.id,
        // Remove a parte de hora para bater string com o loop manual, converte DB datetime em string pura YYYY-MM-DD local
        date: new Date(new Date(t.date).getTime() + new Date(t.date).getTimezoneOffset() * 60000).toISOString().split('T')[0],
        type: (t.type || t.category) && ['entrada', 'saida', 'cartao', 'investimento', 'gasto_diario'].includes(t.type || t.category) ? (t.type || t.category) : (t.amount > 0 ? 'entrada' : 'saida'),
        amount: Math.abs(t.amount), // Amount absoluto pra o protótipo
        description: t.description,
        category: t.category,
        groupId: t.groupId,
        originalAmount: t.amount // Positivo entrada neg saida
      }));
      setTransactions(formatTxs);
    } catch (e) { console.error("Erro fetch txs", e); }
  }

  const fetchBudgets = async () => {
    try {
      const res = await fetch("/api/budgets");
      const data = await res.json();
      setBudgets(data);
    } catch (e) {
      console.error("Erro fetch budgets", e);
    }
  }

  useEffect(() => {
    Promise.all([fetchTransacoes(), fetchBudgets()]).finally(() => setLoading(false));
  }, []);


  const [txFormData, setTxFormData] = useState({
    date: todayDate.toISOString().split('T')[0],
    type: 'saida',
    amount: '',
    description: '',
    repeatEnabled: false,
    repeatFrequency: 'mensal', // diario, semanal, mensal
    repeatCount: '2', // minimo para repetir é 2x (a original + 1x a repetição)
    isIndeterminate: false,
    id: undefined as string | undefined, // Para saber se é edição
    groupId: undefined as string | undefined // Para saber se tem lote
  });

  const [deleteConfirmData, setDeleteConfirmData] = useState<{ id: string, groupId?: string, show: boolean }>({ id: '', show: false });
  const [editConfirmData, setEditConfirmData] = useState<{ show: boolean }>({ show: false });

  const [budgetFormData, setBudgetFormData] = useState({
    id: null as string | null,
    name: '',
    amount: '',
    divideBy: '30'
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // --- MOTOR FINANCEIRO CONTÍNUO ---
  const monthlyData = useMemo(() => {
    const targetYear = currentDate.getFullYear();
    const targetMonth = currentDate.getMonth();

    const globalDailyDrain = budgets.reduce((sum, b) => {
      const amt = Number(b.amount) || 0;
      const div = Number(b.divideBy) || 30;
      return sum + (amt / div);
    }, 0);

    const totalBudgetAmount = budgets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

    let startYear = todayDate.getFullYear();
    let startMonth = todayDate.getMonth();

    if (targetYear < startYear || (targetYear === startYear && targetMonth < startMonth)) {
      startYear = targetYear;
      startMonth = targetMonth;
    }

    transactions.forEach(t => {
      const [y, m] = t.date.split('-').map(Number);
      if (y < startYear || (y === startYear && m - 1 < startMonth)) {
        startYear = y;
        startMonth = m - 1;
      }
    });

    let simDate = new Date(startYear, startMonth, 1);
    const endViewedDate = new Date(targetYear, targetMonth + 1, 0);

    let runningBalance = 0;
    const daysData = [];

    const todayTime = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate()).getTime();

    while (simDate <= endViewedDate) {
      const y = simDate.getFullYear();
      const m = simDate.getMonth();
      const d = simDate.getDate();
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      const simTime = new Date(y, m, d).getTime();
      const isPastDay = simTime < todayTime;
      const isToday = simTime === todayTime;

      const dayTxs = transactions.filter(t => t.date === dateStr);

      let sumEntradas = 0;
      let sumSaidas = 0;
      let sumCartao = 0;
      let sumInvestimentos = 0;
      let sumGastoDiario = 0;

      dayTxs.forEach((t: any) => {
        if (t.type === 'entrada') sumEntradas += t.amount;
        if (t.type === 'saida') sumSaidas += t.amount;
        if (t.type === 'cartao') sumCartao += t.amount;
        if (t.type === 'investimento') sumInvestimentos += t.amount;
        if (t.type === 'gasto_diario') sumGastoDiario += t.amount;
      });

      let projectedDrain = 0;
      let diarioDisplayValue = 0;

      if (isPastDay) {
        projectedDrain = 0;
        diarioDisplayValue = sumSaidas + sumCartao + sumGastoDiario;
      } else {
        // Para Hoje (até 23:59) e para os próximos anos: Reserva a Cota Global Diária no Saldo Projetado
        projectedDrain = globalDailyDrain;
        diarioDisplayValue = globalDailyDrain;
      }

      runningBalance += sumEntradas - (sumSaidas + sumCartao + sumInvestimentos + sumGastoDiario) - projectedDrain;

      if (y === targetYear && m === targetMonth) {
        daysData.push({
          day: d,
          dateStr,
          entradas: sumEntradas,
          saidas: sumSaidas,
          cartao: sumCartao,
          investimentos: sumInvestimentos,
          gastoDiario: sumGastoDiario,
          diario: diarioDisplayValue,
          isPastDay,
          isToday,
          saldo: runningBalance,
          transactions: dayTxs
        });
      }

      simDate = new Date(y, m, d + 1);
    }

    return { daysData, totalBudgetAmount, globalDailyDrain };
  }, [transactions, budgets, currentDate, todayDate]);

  // --- MOTOR DASHBOARD ECONOMIAS ---
  const annualSavingsData = useMemo(() => {
    const yearViewed = currentDate.getFullYear();
    const metrics = { totalEntradas: 0, totalInvestido: 0, months: [] as any[] };

    for (let m = 0; m < 12; m++) {
      let monthEntradas = 0;
      let monthInvestido = 0;

      const txsOfMonth = transactions.filter(t => {
        const [y, mStr] = t.date.split('-');
        return Number(y) === yearViewed && Number(mStr) - 1 === m;
      });

      txsOfMonth.forEach(t => {
        if (t.type === 'entrada') monthEntradas += t.amount;
        if (t.type === 'investimento') monthInvestido += t.amount;
      });

      metrics.totalEntradas += monthEntradas;
      metrics.totalInvestido += monthInvestido;

      const safePercent = monthEntradas > 0 ? (monthInvestido / monthEntradas) * 100 : 0;

      metrics.months.push({
        monthName: new Date(yearViewed, m, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        entradas: monthEntradas,
        investido: monthInvestido,
        percent: safePercent
      });
    }

    const totalPercent = metrics.totalEntradas > 0 ? (metrics.totalInvestido / metrics.totalEntradas) * 100 : 0;

    return { ...metrics, totalPercent, yearViewed };
  }, [transactions, currentDate]);

  // --- MOTOR TOTAIS MENSAIS ---
  const monthlyTotals = useMemo(() => {
    const targetYear = currentDate.getFullYear();
    const targetMonth = currentDate.getMonth();
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

    let entradas = 0;
    let saidas = 0;
    let cartao = 0;
    let investimentos = 0;
    let gastoDiario = 0;

    let allMonthGastosTxs: any[] = [];
    transactions.forEach(t => {
      const [y, mStr] = t.date.split('-');
      if (Number(y) === targetYear && Number(mStr) - 1 === targetMonth) {
        if (t.type === 'entrada') entradas += t.amount;
        if (t.type === 'saida') { saidas += t.amount; allMonthGastosTxs.push(t); }
        if (t.type === 'cartao') { cartao += t.amount; allMonthGastosTxs.push(t); }
        if (t.type === 'investimento') investimentos += t.amount;
        if (t.type === 'gasto_diario') { gastoDiario += t.amount; allMonthGastosTxs.push(t); }
      }
    });

    const totalGastos = saidas + cartao + gastoDiario;
    allMonthGastosTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const performance = entradas - totalGastos - investimentos;
    const economiasPercent = entradas > 0 ? (investimentos / entradas) * 100 : 0;
    const diarioMedio = daysInMonth > 0 ? gastoDiario / daysInMonth : 0;

    // Dados do orçamento
    const orcamentoMensal = budgets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const diarioPrevisto = budgets.reduce((sum, b) => {
      const amt = Number(b.amount) || 0;
      const div = Number(b.divideBy) || 30;
      return sum + (amt / div);
    }, 0);

    // Dias decorridos no mês
    const today = new Date();
    let diasDecorridos = daysInMonth;
    if (targetYear === today.getFullYear() && targetMonth === today.getMonth()) {
      diasDecorridos = today.getDate();
    } else if (targetYear > today.getFullYear() || (targetYear === today.getFullYear() && targetMonth > today.getMonth())) {
      diasDecorridos = 0;
    }

    const sobraOrcamento = orcamentoMensal - totalGastos;
    const projecaoMes = diasDecorridos > 0 ? (totalGastos / diasDecorridos) * daysInMonth : 0;
    const gastoUsadoPercent = orcamentoMensal > 0 ? (totalGastos / orcamentoMensal) * 100 : 0;

    // Dados exclusivos do dashboard diário (apenas gasto_diario)
    const totalGastoDiarioOnly = gastoDiario;
    const diarioMedioOnly = daysInMonth > 0 ? totalGastoDiarioOnly / daysInMonth : 0;
    const sobraOrcamentoDaily = orcamentoMensal - totalGastoDiarioOnly;
    const projecaoMesDaily = diasDecorridos > 0 ? (totalGastoDiarioOnly / diasDecorridos) * daysInMonth : 0;
    const gastoUsadoPercentDaily = orcamentoMensal > 0 ? (totalGastoDiarioOnly / orcamentoMensal) * 100 : 0;

    return {
      entradas,
      totalGastos,
      investimentos,
      performance,
      economiasPercent,
      diarioMedio,
      daysInMonth,
      orcamentoMensal,
      diarioPrevisto,
      diasDecorridos,
      sobraOrcamento,
      projecaoMes,
      gastoUsadoPercent,
      totalGastoDiarioOnly,
      diarioMedioOnly,
      sobraOrcamentoDaily,
      projecaoMesDaily,
      gastoUsadoPercentDaily,
      monthLabel: currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      allMonthGastosTxs
    };
  }, [transactions, budgets, currentDate]);

  const getBalanceColor = (balance: number) => {
    if (balance >= 2000) return 'bg-emerald-800 text-emerald-100 font-bold';
    if (balance > 500 && balance < 2000) return 'bg-green-600 text-white font-semibold';
    if (balance >= 100 && balance <= 500) return 'bg-yellow-500 text-gray-900 font-semibold';
    if (balance >= 0 && balance < 100) return 'bg-blue-300 text-gray-900 font-semibold';
    if (balance >= -1000 && balance < 0) return 'bg-red-500 text-white font-semibold';
    return 'bg-red-950 text-red-100 font-bold';
  };

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  // --- HANDLERS DE FORMULÁRIO API ---
  const handleAddOrEditTransaction = async (e: React.FormEvent, applyToAll: boolean = false) => {
    e.preventDefault();
    if (!txFormData.amount || !txFormData.description) return;

    // Se estiver editando e for a primeira tela de confirmação (antes do modal 'todas vs só essa')
    if (txFormData.id && txFormData.groupId && !editConfirmData.show) {
      setEditConfirmData({ show: true });
      return;
    }

    // Trava Tipo conforme o Filtro da View, pra evitar erros, exceto se eu estiver no "Diário" (geral)
    let realType = txFormData.type;
    if (filter === 'entradas') realType = 'entrada';
    if (filter === 'saidas') realType = 'saida';
    if (filter === 'cartao') realType = 'cartao';
    if (filter === 'investimento') realType = 'investimento';
    if (filter === 'gasto_diario') realType = 'gasto_diario';

    const isPositiveForce = realType === 'entrada';
    let realAmount = parseFloat(txFormData.amount);

    // Converte de novo pra API do jeito antigo (+ ou -) para manter consistencia no banco
    const apiAmount = isPositiveForce ? realAmount : -Math.abs(realAmount);

    const txBody: any = {
      description: txFormData.description,
      amount: apiAmount,
      date: new Date(`${txFormData.date}T12:00:00`).toISOString(),
      type: realType,
      category: realType,
    }

    if (!txFormData.id) {
      txBody.repeatCount = txFormData.repeatEnabled ? parseInt(txFormData.repeatCount) : undefined;
      txBody.repeatFrequency = txFormData.repeatEnabled ? txFormData.repeatFrequency : undefined;
      txBody.isIndeterminate = txFormData.repeatEnabled ? txFormData.isIndeterminate : false;

      await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(txBody)
      });
    } else {
      txBody.updateAll = applyToAll;
      await fetch(`/api/transactions/${txFormData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(txBody)
      });
    }

    await fetchTransacoes();

    setIsTxModalOpen(false);
    setEditConfirmData({ show: false });
    setTxFormData(prev => ({ ...prev, amount: '', description: '', repeatEnabled: false, repeatFrequency: 'mensal', repeatCount: '2', isIndeterminate: false, id: undefined, groupId: undefined }));
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetFormData.name || !budgetFormData.amount) return;

    const body = {
      name: budgetFormData.name,
      amount: Number(budgetFormData.amount),
      divideBy: Number(budgetFormData.divideBy)
    };

    if (budgetFormData.id) {
      // Edit
      await fetch(`/api/budgets/${budgetFormData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } else {
      // Create
      await fetch(`/api/budgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    }

    await fetchBudgets();
    setIsBudgetModalOpen(false);
    setBudgetFormData({ id: null, name: '', amount: '', divideBy: '30' });
  };

  const deleteBudget = async (id: string) => {
    await fetch(`/api/budgets/${id}`, { method: "DELETE" });
    await fetchBudgets();
  };

  const editBudget = (b: Budget) => {
    setBudgetFormData({ id: b.id, name: b.name, amount: b.amount.toString(), divideBy: b.divideBy.toString() });
    setIsBudgetModalOpen(true);
  };

  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);

  const deleteTransaction = async (id: string, deleteAll: boolean = false) => {
    setDeletingTxId(id);
    await new Promise(r => setTimeout(r, 400));
    await fetch(`/api/transactions/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteAll })
    });
    await fetchTransacoes();
    setDeletingTxId(null);
    setDeleteConfirmData({ id: '', show: false });
  };

  const openEditTx = (tx: Transaction) => {
    setTxFormData({
      id: tx.id,
      groupId: tx.groupId,
      date: tx.date,
      type: tx.type || 'saida',
      amount: tx.amount.toString(),
      description: tx.description,
      repeatEnabled: false,
      repeatFrequency: 'mensal',
      repeatCount: '2',
      isIndeterminate: false
    });
  };

  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Carregando Fluxo de Caixa...</div>
  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-gray-950 text-gray-100 font-sans md:flex md:justify-center">
      <div className="w-full max-w-md bg-gray-900 h-full relative shadow-2xl overflow-hidden flex flex-col">

        <header className="bg-gray-800 p-4 shadow-md z-10 shrink-0 flex items-center justify-between border-b border-gray-900">
          {/* Botão Calendário (Hoje) - Fica na Esquerda */}
          <button
            onClick={() => {
              setCurrentDate(new Date(todayDate.getFullYear(), todayDate.getMonth(), 1));
              setTimeout(() => {
                todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 100);
            }}
            className="flex items-center justify-center w-10 h-10 bg-gray-900 hover:bg-gray-800 rounded-xl shadow-inner border border-gray-700 transition-colors active:scale-95 cursor-pointer"
            title="Voltar para Hoje"
          >
            <span className="text-xl">📅</span>
          </button>

          <div className="flex items-center bg-gray-900 rounded-lg p-1 border border-gray-700 shadow-sm">
            <button onClick={prevMonth} className="p-1 hover:text-blue-400 hover:bg-gray-800 rounded-md transition-colors"><ChevronLeft size={18} /></button>
            <span className="font-semibold text-sm capitalize tracking-widest w-16 text-center select-none text-gray-100">
              {currentDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '').replace(' de ', '/')}
            </span>
            <button onClick={nextMonth} className="p-1 hover:text-blue-400 hover:bg-gray-800 rounded-md transition-colors"><ChevronRight size={18} /></button>
          </div>

          <button
            onClick={() => setIsTotalsOpen(true)}
            className="flex items-center justify-center w-10 h-10 bg-gray-900 hover:bg-gray-800 rounded-xl shadow-inner border border-gray-700 transition-colors active:scale-95 cursor-pointer text-blue-400"
            title="Totais do Mês"
          >
            <Calculator size={20} />
          </button>
        </header>

        <div className="p-4 bg-gray-900 border-b border-gray-800 shrink-0">
          <label className="text-xs text-gray-400 mb-1 block uppercase tracking-wider">Visualização Central</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 font-medium">
            <option value="diario">Previsão Diária ({formatCurrency(monthlyData.globalDailyDrain)}/dia)</option>
            <option value="entradas">Entradas</option>
            <option value="saidas">Saídas</option>
            <option value="cartao">Cartão de Crédito</option>
            <option value="investimento">Investimento / Reservas</option>
            <option value="gasto_diario">Gasto Diário</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto pb-24 custom-scrollbar">
          <div className="flex text-xs text-gray-500 uppercase tracking-wider px-4 py-2 sticky top-0 bg-gray-900/95 backdrop-blur-sm z-10 border-b border-gray-800">
            <div className="w-12 text-center">Dia</div>
            <div className="flex-1 text-center">{filter === 'diario' ? 'Custo / Gasto' : filter}</div>
            <div className="w-32 min-w-[8rem] text-right pr-2 leading-tight">Saldo<br /><span className="text-[10px] text-gray-600">Projetado</span></div>
          </div>

          <div className="divide-y divide-gray-800/50">
            {monthlyData.daysData.map((data) => {
              let centerValue: number = 0, centerColor = 'text-gray-400';

              if (filter === 'diario') {
                centerValue = data.diario;
                if (data.isPastDay || data.isToday) centerColor = 'text-gray-500';
                else centerColor = 'text-blue-300/70';
              } else if (filter === 'entradas') {
                centerValue = data.entradas;
                centerColor = data.entradas > 0 ? 'text-green-400' : 'text-gray-600';
              } else if (filter === 'saidas') {
                centerValue = data.saidas;
                centerColor = data.saidas > 0 ? 'text-red-400' : 'text-gray-600';
              } else if (filter === 'cartao') {
                centerValue = data.cartao;
                centerColor = data.cartao > 0 ? 'text-purple-400' : 'text-gray-600';
              } else if (filter === 'investimento') {
                centerValue = data.investimentos;
                centerColor = data.investimentos > 0 ? 'text-emerald-300' : 'text-gray-600';
              } else if (filter === 'gasto_diario') {
                centerValue = data.gastoDiario;
                centerColor = data.gastoDiario > 0 ? 'text-amber-400' : 'text-gray-600';
              }

              return (
                // A MÁGICA ESTÁ AQUI: onClick na linha inteira!
                <div
                  key={data.day}
                  ref={data.isToday ? todayRef : null}
                  onClick={() => {
                    setTxFormData(prev => ({ ...prev, date: data.dateStr }));
                    setIsTxModalOpen(true);
                  }}
                  className={`flex items-center px-4 py-3 cursor-pointer hover:bg-gray-800/80 transition-colors ${data.isToday ? 'bg-blue-900/20 border-l-2 border-blue-500' : ''}`}
                  title={`Adicionar transação para o dia ${data.day}`}
                >
                  <div className="w-12 flex flex-col items-center justify-center">
                    <span className={`text-lg font-medium ${data.isToday ? 'text-blue-400' : (data.isPastDay ? 'text-gray-600' : 'text-gray-300')}`}>
                      {String(data.day).padStart(2, '0')}
                    </span>
                    {data.transactions.length > 0 && <div className="w-1.5 h-1.5 bg-gray-500 rounded-full mt-1"></div>}
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center">
                    <span className={`font-medium tabular-nums ${centerColor}`}>
                      {centerValue === 0 && filter !== 'diario' ? '-' : formatCurrency(centerValue)}
                    </span>
                    {filter === 'diario' && data.isPastDay && data.diario === 0 && (
                      <span className="text-[10px] text-gray-600">Zerado</span>
                    )}
                    {filter === 'diario' && !data.isPastDay && !data.isToday && (
                      <span className="text-[10px] text-blue-500/50">Custo Projetado</span>
                    )}
                    {filter === 'diario' && data.isToday && (
                      <span className="text-[10px] text-yellow-500/70 border-b border-yellow-500/30">Custo Hoje</span>
                    )}
                  </div>

                  <div className="w-32 min-w-[8rem] flex justify-end pl-2">
                    <span className={`px-2 py-1 rounded text-sm w-full text-right inline-block tracking-tight tabular-nums ${getBalanceColor(data.saldo)}`}>
                      {formatCurrency(data.saldo)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* --- FAB (SPEED DIAL) --- */}
        {/* Overlay invisível pra fechar o FAB ao clicar fora */}
        {isFabOpen && <div className="absolute inset-0 z-10" onClick={() => setIsFabOpen(false)} />}

        <div className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-3">
          {/* Opções Expandidas */}
          <div className={`flex flex-col gap-3 items-end transition-all origin-bottom duration-200 ${isFabOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>

            <button
              onClick={() => {
                setIsFabOpen(false);
                setIsBudgetListModalOpen(true);
              }}
              className="flex items-center gap-3 bg-gray-800 hover:bg-gray-700 text-white rounded-full px-4 py-2 shadow-lg border border-gray-700 transition-colors"
            >
              <span className="text-sm font-medium">Orçamentos Fixos</span>
              <div className="bg-gray-700 p-1.5 rounded-full"><Target size={16} /></div>
            </button>

            <button
              onClick={() => {
                setIsFabOpen(false);
                let defaultType = 'saida';
                if (filter === 'entradas') defaultType = 'entrada';
                if (filter === 'saidas') defaultType = 'saida';
                if (filter === 'cartao') defaultType = 'cartao';
                if (filter === 'investimento') defaultType = 'investimento';
                if (filter === 'gasto_diario') defaultType = 'gasto_diario';

                setTxFormData(p => ({ ...p, date: todayDate.toISOString().split('T')[0], type: defaultType }));
                setIsTxModalOpen(true);
              }}
              className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full px-4 py-2 shadow-lg transition-colors"
            >
              <span className="text-sm font-medium">Nova Transação</span>
              <div className="bg-blue-500 p-1.5 rounded-full"><Wallet size={16} /></div>
            </button>
          </div>

          {/* FAB Principal */}
          <button
            onClick={() => setIsFabOpen(!isFabOpen)}
            className={`w-14 h-14 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30 transition-transform flex-shrink-0 active:scale-95 ${isFabOpen ? 'rotate-45 bg-gray-800 hover:bg-gray-700 shadow-none border border-gray-700' : ''}`}
          >
            <Plus size={28} className={isFabOpen ? 'text-gray-400' : 'text-white'} />
          </button>
        </div>


        {/* --- MODAL DE PLANEJAMENTO (LISTA) --- */}
        {isBudgetListModalOpen && (
          <div className="absolute inset-0 bg-gray-950 z-30 flex flex-col animate-slide-up">
            <header className="bg-gray-900 border-b border-gray-800 p-4 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Target className="text-blue-400" size={24} />
                <h2 className="text-lg font-semibold text-white">Administrar Orçamentos</h2>
              </div>
              <button onClick={() => setIsBudgetListModalOpen(false)} className="text-gray-400 p-2"><X size={24} /></button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-24">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-white">Planejamento</h2>
                  <p className="text-xs text-gray-400">Total dividido para formar o dreno diário.</p>
                </div>
                <div className="text-right">
                  <span className="block text-xl font-bold text-blue-400">{formatCurrency(monthlyData.totalBudgetAmount)}</span>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">Total Mensal</span>
                </div>
              </div>

              <div className="space-y-3 mb-24">
                {budgets.map(b => (
                  <div key={b.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-gray-100">{b.name}</h3>
                      <p className="text-xs text-gray-400 mt-1">Gera {formatCurrency(b.amount / b.divideBy)} por dia</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-white">{formatCurrency(b.amount)}</span>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => editBudget(b)} className="text-gray-400 hover:text-blue-400"><Edit2 size={16} /></button>
                        <button onClick={() => deleteBudget(b.id)} className="text-gray-400 hover:text-red-400"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </div>
                ))}
                {budgets.length === 0 && (
                  <div className="text-center text-sm py-12 text-gray-500 border border-gray-800 border-dashed rounded-xl">
                    Nenhum orçamento fixo definido.<br />Clique em Novo Orçamento e cadastre suas contas rotineiras!
                  </div>
                )}
              </div>

              <button onClick={() => { setBudgetFormData({ id: null, name: '', amount: '', divideBy: '30' }); setIsBudgetModalOpen(true); }} className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-transform active:scale-95 font-medium text-white z-20">
                <Plus size={20} /> Novo Orçamento
              </button>
            </div>
          </div>
        )}

        {/* --- MODAIS --- */}
        {isTxModalOpen && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-gray-900 w-full max-w-sm max-h-[90vh] flex flex-col rounded-2xl sm:rounded-xl shadow-2xl border border-gray-800 overflow-hidden animate-zoom-in">
              <div className="flex justify-between items-center p-4 border-b border-gray-800 shrink-0">
                <h2 className="text-lg font-semibold text-white">Transações do Dia</h2>
                <button onClick={() => {
                  setIsTxModalOpen(false);
                  setDeleteConfirmData({ id: '', show: false });
                  setEditConfirmData({ show: false });
                }} className="text-gray-400"><X size={20} /></button>
              </div>

              {/* Lista do que já tem lá */}
              {!editConfirmData.show && !deleteConfirmData.show && (
                <div className="p-4 border-b border-gray-800 bg-gray-950/50 flex-1 overflow-y-auto custom-scrollbar">
                  <label className="text-xs text-gray-500 uppercase tracking-wider mb-3 block">Registros Existentes</label>

                  {(() => {
                    const currentDayTxs = transactions.filter(t => t.date === txFormData.date);

                    if (currentDayTxs.length === 0) {
                      return <p className="text-sm text-gray-500 italic text-center py-4 border border-dashed border-gray-800 rounded-lg">Nenhum registro para este dia.</p>;
                    }

                    return (
                      <div className="space-y-2">
                        {currentDayTxs.map(tx => {
                          let txColor = tx.type === 'entrada' ? 'text-green-400' : 'text-red-400';
                          if (tx.type === 'cartao') txColor = 'text-purple-400';
                          if (tx.type === 'investimento') txColor = 'text-emerald-300';
                          if (tx.type === 'gasto_diario') txColor = 'text-amber-400';

                          return (
                            <div key={tx.id} className={`flex justify-between items-center bg-gray-800 p-3 rounded-lg border border-gray-700 transition-all duration-300 ${deletingTxId === tx.id ? 'opacity-0 scale-95 -translate-x-4' : 'opacity-100'}`}>
                              <div className="overflow-hidden">
                                <p className="text-sm font-medium text-gray-200 truncate">{tx.description}</p>
                                <p className="text-xs text-gray-500 capitalize">{tx.type}</p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0 ml-2">
                                <span className={`text-sm font-bold tabular-nums ${txColor}`}>
                                  {formatCurrency(Math.abs(tx.amount))}
                                </span>
                                <button
                                  onClick={() => openEditTx(tx)}
                                  className={`p-1 rounded-md transition-colors text-gray-400 hover:text-blue-400 bg-gray-900`}
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    setDeleteConfirmData({ id: tx.id, groupId: tx.groupId || undefined, show: true });
                                  }}
                                  disabled={deletingTxId !== null}
                                  className={`p-1 rounded-md transition-colors ${deletingTxId === tx.id ? 'text-red-400 animate-spin' : 'text-gray-400 hover:text-red-500 bg-gray-900'} ${deletingTxId !== null && deletingTxId !== tx.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  {deletingTxId === tx.id
                                    ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                    : <Trash2 size={14} />}
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Formulário de Adição de Coisas Novas / Edição */}
              <form onSubmit={handleAddOrEditTransaction} className={`p-4 space-y-4 shrink-0 bg-gray-900 ${editConfirmData.show || deleteConfirmData.show ? 'hidden' : 'block'}`}>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-blue-400 uppercase tracking-wider block font-semibold">
                    {txFormData.id ? 'Editar Registro' : 'Novo Registro'}
                  </label>
                  {txFormData.id && (
                    <button type="button" onClick={() => setTxFormData(prev => ({ ...prev, amount: '', description: '', repeatEnabled: false, repeatFrequency: 'mensal', repeatCount: '2', isIndeterminate: false, id: undefined, groupId: undefined }))} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                      <X size={12} /> Cancelar Edição
                    </button>
                  )}
                </div>

                {/* Oculta os Radiais de Entrada/Saída/Etc se o usuário estiver numa aba travada pra evitar enganos */}
                {filter === 'diario' && (
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <label className={`cursor-pointer border rounded-lg p-2 text-center text-sm font-medium transition-colors ${txFormData.type === 'entrada' ? 'bg-green-900/30 border-green-500 text-green-400' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}><input type="radio" name="type" value="entrada" checked={txFormData.type === 'entrada'} onChange={(e) => setTxFormData({ ...txFormData, type: e.target.value })} className="hidden" /> Entrada</label>
                    <label className={`cursor-pointer border rounded-lg p-2 text-center text-sm font-medium transition-colors ${txFormData.type === 'saida' ? 'bg-red-900/30 border-red-500 text-red-400' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}><input type="radio" name="type" value="saida" checked={txFormData.type === 'saida'} onChange={(e) => setTxFormData({ ...txFormData, type: e.target.value })} className="hidden" /> Saída</label>
                    <label className={`cursor-pointer border rounded-lg p-2 text-center text-sm font-medium transition-colors ${txFormData.type === 'cartao' ? 'bg-purple-900/30 border-purple-500 text-purple-400' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}><input type="radio" name="type" value="cartao" checked={txFormData.type === 'cartao'} onChange={(e) => setTxFormData({ ...txFormData, type: e.target.value })} className="hidden" /> Cartão</label>
                    <label className={`cursor-pointer border rounded-lg p-2 text-center text-sm font-medium transition-colors ${txFormData.type === 'investimento' ? 'bg-emerald-900/30 border-emerald-500 text-emerald-300' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}><input type="radio" name="type" value="investimento" checked={txFormData.type === 'investimento'} onChange={(e) => setTxFormData({ ...txFormData, type: e.target.value })} className="hidden" /> Reserva</label>
                    <label className={`cursor-pointer border rounded-lg p-2 text-center text-sm font-medium transition-colors col-span-2 ${txFormData.type === 'gasto_diario' ? 'bg-amber-900/30 border-amber-500 text-amber-400' : 'border-gray-700 text-gray-400 hover:bg-gray-800'}`}><input type="radio" name="type" value="gasto_diario" checked={txFormData.type === 'gasto_diario'} onChange={(e) => setTxFormData({ ...txFormData, type: e.target.value })} className="hidden" /> Gasto Diário</label>
                  </div>
                )}

                <div className="flex gap-2">
                  <input type="date" value={txFormData.date} onChange={(e) => setTxFormData({ ...txFormData, date: e.target.value })} className="w-[145px] shrink-0 bg-gray-800 border border-gray-700 text-white rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 text-sm" style={{ colorScheme: 'dark' }} required />
                  <input type="number" step="0.01" min="0" placeholder="Valor" value={txFormData.amount} onChange={(e) => setTxFormData({ ...txFormData, amount: e.target.value })} className="flex-1 min-w-0 bg-gray-800 border border-gray-700 text-white rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>

                <div className="flex gap-2">
                  <input type="text" placeholder="Descrição" value={txFormData.description} onChange={(e) => setTxFormData({ ...txFormData, description: e.target.value })} className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500" required />
                </div>

                {!txFormData.id && (
                  <div className="border border-gray-800 rounded-lg bg-gray-950 p-3 flex flex-col gap-3 transition-all duration-300">
                    <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer w-fit select-none">
                      <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${txFormData.repeatEnabled ? 'bg-blue-600' : 'bg-gray-700'}`}>
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${txFormData.repeatEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                      <input type="checkbox" checked={txFormData.repeatEnabled} onChange={(e) => setTxFormData({ ...txFormData, repeatEnabled: e.target.checked })} className="sr-only" />
                      Repetir Lançamento?
                    </label>

                    {txFormData.repeatEnabled && (
                      <div className="flex flex-col gap-2 animate-slide-up origin-top pt-2 mt-[-4px] border-t border-gray-800">
                        <div className="flex gap-2 items-center">
                          <select value={txFormData.repeatFrequency} onChange={(e) => setTxFormData({ ...txFormData, repeatFrequency: e.target.value })} className="bg-gray-800 border border-gray-700 text-white rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-1/2">
                            <option value="mensal">Todo Mês</option>
                            <option value="semanal">Toda Semana</option>
                            <option value="diario">Todo Dia</option>
                          </select>
                          <span className="text-gray-500 text-xs text-center">por</span>
                          <div className="relative w-1/2 flex items-center">
                            <input type="number" min="2" max="360" value={txFormData.repeatCount} onChange={(e) => setTxFormData({ ...txFormData, repeatCount: e.target.value })} disabled={txFormData.isIndeterminate} className={`w-full bg-gray-800 border border-gray-700 text-white rounded-md p-2 pr-12 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${txFormData.isIndeterminate ? 'opacity-50 cursor-not-allowed' : ''}`} required={txFormData.repeatEnabled && !txFormData.isIndeterminate} />
                            <span className="absolute right-3 text-gray-500 text-xs pointer-events-none">Vezes</span>
                          </div>
                        </div>
                        <label className="flex items-center gap-3 text-sm text-gray-400 cursor-pointer w-fit select-none mt-1">
                          <div className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${txFormData.isIndeterminate ? 'bg-blue-600' : 'bg-gray-700'}`}>
                            <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${txFormData.isIndeterminate ? 'translate-x-3' : 'translate-x-0'}`} />
                          </div>
                          <input type="checkbox" checked={txFormData.isIndeterminate} onChange={(e) => setTxFormData({ ...txFormData, isIndeterminate: e.target.checked })} className="sr-only" />
                          Prazo Indeterminado
                        </label>
                      </div>
                    )}
                  </div>
                )}

                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 transition-colors text-white font-semibold rounded-lg p-3 flex justify-center items-center gap-2 mt-2">
                  <Plus size={20} /> {txFormData.id ? 'Salvar Edição' : 'Registrar'}
                </button>
              </form>

              {/* Modais de Confirmação Internos (Lote e Único) */}
              {deleteConfirmData.show && (
                <div className="p-6 bg-gray-900 flex flex-col items-center text-center animate-slide-up flex-1">
                  <Trash2 size={32} className="text-red-500 mb-2" />
                  <h3 className="text-white font-medium mb-1">Apagar Transação</h3>

                  {deleteConfirmData.groupId ? (
                    <>
                      <p className="text-sm text-gray-400 mb-6">Esta transação faz parte de uma repetição. O que você deseja excluir?</p>
                      <div className="w-full flex flex-col gap-2">
                        <button onClick={() => deleteTransaction(deleteConfirmData.id, true)} className="w-full bg-red-900/40 text-red-500 hover:bg-red-900/60 border border-red-500/50 p-3 rounded-lg font-medium transition-colors">
                          Excluir TODAS as parcelas
                        </button>
                        <button onClick={() => deleteTransaction(deleteConfirmData.id, false)} className="w-full bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 p-3 rounded-lg font-medium transition-colors">
                          Excluir APENAS esta parcela
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-400 mb-6">Tem certeza que deseja apagar permanentemente esta transação?</p>
                      <button onClick={() => deleteTransaction(deleteConfirmData.id, false)} className="w-full bg-red-900/40 text-red-500 hover:bg-red-900/60 border border-red-500/50 p-3 rounded-lg font-medium transition-colors">
                        Sim, excluir transação
                      </button>
                    </>
                  )}

                  <button onClick={() => setDeleteConfirmData({ id: '', show: false })} className="mt-4 text-sm text-gray-500 hover:text-white">Cancelar</button>
                </div>
              )}

              {editConfirmData.show && (
                <div className="p-6 bg-gray-900 flex flex-col items-center text-center animate-slide-up flex-1">
                  <Edit2 size={32} className="text-blue-500 mb-2" />
                  <h3 className="text-white font-medium mb-1">Salvar Edição Recorrente</h3>
                  <p className="text-sm text-gray-400 mb-6">Esta transação faz parte de uma repetição. Como deseja salvar as alterações?</p>

                  <div className="w-full flex flex-col gap-2">
                    <button onClick={(e) => handleAddOrEditTransaction(e, true)} className="w-full bg-blue-900/40 text-blue-400 hover:bg-blue-900/60 border border-blue-500/50 p-3 rounded-lg font-medium transition-colors">
                      Alterar TODAS as parcelas
                    </button>
                    <button onClick={(e) => handleAddOrEditTransaction(e, false)} className="w-full bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 p-3 rounded-lg font-medium transition-colors">
                      Alterar APENAS esta parcela
                    </button>
                  </div>

                  <button onClick={() => setEditConfirmData({ show: false })} className="mt-4 text-sm text-gray-500 hover:text-white">Voltar ao Formulário</button>
                </div>
              )}

            </div>
          </div>
        )}

        {isBudgetModalOpen && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 w-full max-w-sm rounded-xl shadow-2xl border border-gray-800 overflow-hidden animate-slide-up">
              <div className="flex justify-between items-center p-4 border-b border-gray-800"><h2 className="text-lg font-semibold text-white">{budgetFormData.id ? 'Editar' : 'Novo Orçamento'}</h2><button onClick={() => setIsBudgetModalOpen(false)} className="text-gray-400"><X size={20} /></button></div>
              <form onSubmit={handleSaveBudget} className="p-4 space-y-4">
                <input type="text" placeholder="Nome / Categoria" value={budgetFormData.name} onChange={(e) => setBudgetFormData({ ...budgetFormData, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 outline-none" required />
                <input type="number" step="0.01" min="0" placeholder="Valor Mensal Previsto" value={budgetFormData.amount} onChange={(e) => setBudgetFormData({ ...budgetFormData, amount: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 outline-none" required />
                <input type="number" min="1" max="31" placeholder="Dividir por (Dias)" value={budgetFormData.divideBy} onChange={(e) => setBudgetFormData({ ...budgetFormData, divideBy: e.target.value })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 outline-none" required />
                <button type="submit" className="w-full bg-blue-600 text-white font-semibold rounded-lg p-3">Salvar</button>
              </form>
            </div>
          </div>
        )}

        {/* --- PAINEL DE TOTAIS MENSAIS --- */}
        {(isTotalsOpen || isTotalsClosing) && (
          <div className={`absolute inset-0 bg-gray-950 z-40 flex flex-col overflow-hidden ${isTotalsClosing ? 'animate-slide-down' : 'animate-slide-up'}`}>
            <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-900 shrink-0">
              <h2 className="text-lg font-bold text-blue-400 flex items-center gap-2">
                <Calculator size={22} /> Totais
              </h2>
              <button onClick={closeTotals} className="text-gray-400 hover:text-white transition-colors bg-gray-800 p-2 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="bg-gray-900 p-3 border-b border-gray-800 flex justify-center shrink-0">
              <div className="flex items-center bg-gray-800 rounded-lg p-1 border border-gray-700 shadow-sm">
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-1 hover:text-blue-400 text-gray-400 hover:bg-gray-700 rounded-md transition-colors"><ChevronLeft size={18} /></button>
                <span className="font-semibold text-sm capitalize tracking-widest w-24 text-center select-none text-gray-100">
                  {currentDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '').replace(' de ', '/')}
                </span>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-1 hover:text-blue-400 text-gray-400 hover:bg-gray-700 rounded-md transition-colors"><ChevronRight size={18} /></button>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4">
              {/* Título do mês */}
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold text-center capitalize">{monthlyTotals.monthLabel}</p>

              {/* Card 1: Performance */}
              <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
                <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Performance</h3>
                <span className={`text-2xl font-extrabold tracking-tight tabular-nums ${monthlyTotals.performance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(monthlyTotals.performance)}
                </span>
                <p className="text-[10px] text-gray-500 mt-2">Entradas ({formatCurrency(monthlyTotals.entradas)}) − Gastos − Reservas</p>
              </div>

              {/* Card 2: Economias */}
              <button
                onClick={() => { setIsSavingsDashboardOpen(true); }}
                className="w-full bg-gray-800 border border-emerald-900/50 rounded-2xl p-5 shadow-lg relative overflow-hidden text-left hover:border-emerald-700/60 transition-colors active:scale-[0.98] cursor-pointer group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Economias</h3>
                  <ChevronRight size={16} className="text-gray-600 group-hover:text-emerald-400 transition-colors" />
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-2xl font-extrabold text-emerald-400 tracking-tight tabular-nums">
                    {formatCurrency(monthlyTotals.investimentos)}
                  </span>
                  <span className="text-sm font-medium text-emerald-400 bg-emerald-900/40 px-2 py-0.5 rounded-md">
                    {monthlyTotals.economiasPercent.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-900 h-2.5 rounded-full overflow-hidden border border-gray-700">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(monthlyTotals.economiasPercent, 100)}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-gray-500 mt-2">Reservas / Investimentos do mês</p>
              </button>

              {/* Card 3: Custo de Vida */}
              <button 
                onClick={() => setIsCostOfLivingOpen(true)}
                className="w-full text-left bg-gray-800 border border-red-900/30 rounded-2xl p-5 shadow-lg relative overflow-hidden active:scale-[0.98] transition-transform cursor-pointer group hover:border-red-700/50"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
                
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Custo de Vida</h3>
                    <ChevronRight size={16} className="text-gray-600 group-hover:text-red-400 transition-colors" />
                </div>
                
                <span className="block text-2xl font-extrabold text-red-400 tracking-tight tabular-nums">
                  {formatCurrency(monthlyTotals.totalGastos)}
                </span>
                <p className="text-[10px] text-gray-500 mt-2">Soma de saídas + cartão + gasto diário (Toque para listar)</p>
              </button>

              {/* Card 4: Diário Médio */}
              <button
                onClick={() => { setIsDailyDashOpen(true); }}
                className="w-full bg-gray-800 border border-amber-900/30 rounded-2xl p-5 shadow-lg relative overflow-hidden text-left hover:border-amber-700/50 transition-colors active:scale-[0.98] cursor-pointer group"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Diário Médio</h3>
                  <ChevronRight size={16} className="text-gray-600 group-hover:text-amber-400 transition-colors" />
                </div>
                <span className="text-2xl font-extrabold text-amber-400 tracking-tight tabular-nums">
                  {formatCurrency(monthlyTotals.diarioMedio)}
                </span>
                <p className="text-[10px] text-gray-500 mt-2">Custo de vida ÷ {monthlyTotals.daysInMonth} dias do mês</p>
              </button>
            </div>
          </div>
        )}

        {/* --- DASHBOARD DIÁRIO MÉDIO --- */}
        {(isDailyDashOpen || isDailyDashClosing) && (
          <div className={`absolute inset-0 bg-gray-950 z-50 flex flex-col overflow-hidden ${isDailyDashClosing ? 'animate-slide-down' : 'animate-slide-up'}`}>
            <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-900 shrink-0">
              <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                <Wallet size={22} /> Análise Diária
              </h2>
              <button onClick={closeDailyDash} className="text-gray-400 hover:text-white transition-colors bg-gray-800 p-2 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold text-center capitalize">{monthlyTotals.monthLabel}</p>

              {/* Orçamento Mensal */}
              <div className="bg-gray-800 border border-blue-900/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
                <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Orçamento Mensal</h3>
                <span className="text-2xl font-extrabold text-blue-400 tracking-tight tabular-nums">
                  {formatCurrency(monthlyTotals.orcamentoMensal)}
                </span>
                <p className="text-[10px] text-gray-500 mt-2">Total que poderia gastar no mês (soma dos orçamentos)</p>
              </div>

              {/* Já Gastei (apenas gasto diário) */}
              <div className="bg-gray-800 border border-red-900/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
                <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Já Gastei</h3>
                <span className="text-2xl font-extrabold text-red-400 tracking-tight tabular-nums">
                  {formatCurrency(monthlyTotals.totalGastoDiarioOnly)}
                </span>
                {/* Barra de uso do orçamento */}
                <div className="w-full bg-gray-900 h-2.5 rounded-full overflow-hidden border border-gray-700 mt-3">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${monthlyTotals.gastoUsadoPercentDaily > 100 ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-amber-600 to-amber-400'}`}
                    style={{ width: `${Math.min(monthlyTotals.gastoUsadoPercentDaily, 100)}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-gray-500 mt-2">{monthlyTotals.gastoUsadoPercentDaily.toFixed(1)}% do orçamento usado • {monthlyTotals.diasDecorridos} de {monthlyTotals.daysInMonth} dias</p>
              </div>

              {/* Sobra do Orçamento */}
              <div className={`bg-gray-800 border ${monthlyTotals.sobraOrcamentoDaily >= 0 ? 'border-green-900/30' : 'border-red-900/30'} rounded-2xl p-5 shadow-lg relative overflow-hidden`}>
                <div className={`absolute top-0 right-0 w-24 h-24 ${monthlyTotals.sobraOrcamentoDaily >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'} rounded-full blur-2xl -mr-8 -mt-8`}></div>
                <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Sobra do Orçamento</h3>
                <span className={`text-2xl font-extrabold tracking-tight tabular-nums ${monthlyTotals.sobraOrcamentoDaily >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(monthlyTotals.sobraOrcamentoDaily)}
                </span>
                <p className="text-[10px] text-gray-500 mt-2">
                  {monthlyTotals.sobraOrcamentoDaily >= 0
                    ? 'Valor que ainda pode gastar dentro do orçamento'
                    : 'Você ultrapassou o orçamento do mês!'}
                </p>
              </div>

              {/* Projeção do Mês */}
              {monthlyTotals.diasDecorridos > 0 && (
                <div className={`bg-gray-800 border ${monthlyTotals.projecaoMesDaily <= monthlyTotals.orcamentoMensal ? 'border-cyan-900/30' : 'border-orange-900/30'} rounded-2xl p-5 shadow-lg relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
                  <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Projeção do Mês</h3>
                  <span className={`text-2xl font-extrabold tracking-tight tabular-nums ${monthlyTotals.projecaoMesDaily <= monthlyTotals.orcamentoMensal ? 'text-cyan-400' : 'text-orange-400'}`}>
                    {formatCurrency(monthlyTotals.projecaoMesDaily)}
                  </span>
                  <p className="text-[10px] text-gray-500 mt-2">
                    Se continuar nesse ritmo ({formatCurrency(monthlyTotals.diarioMedioOnly)}/dia), gastará esse total até o fim do mês
                  </p>
                </div>
              )}

              {/* Comparativo Real vs Previsto */}
              <div className="bg-gray-800 border border-amber-900/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -mr-8 -mt-8"></div>
                <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Gasto Diário: Real vs Previsto</h3>
                <div className="flex gap-4">
                  <div className="flex-1 bg-gray-900/60 border border-gray-700 rounded-xl p-3 text-center">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Real</span>
                    <span className="text-lg font-extrabold text-amber-400 tabular-nums">{formatCurrency(monthlyTotals.diarioMedioOnly)}</span>
                  </div>
                  <div className="flex-1 bg-gray-900/60 border border-gray-700 rounded-xl p-3 text-center">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Previsto</span>
                    <span className="text-lg font-extrabold text-blue-400 tabular-nums">{formatCurrency(monthlyTotals.diarioPrevisto)}</span>
                  </div>
                </div>
                <p className={`text-[10px] mt-3 font-medium text-center ${monthlyTotals.diarioMedioOnly <= monthlyTotals.diarioPrevisto ? 'text-green-400' : 'text-red-400'
                  }`}>
                  {monthlyTotals.diarioMedioOnly <= monthlyTotals.diarioPrevisto
                    ? `✅ Dentro do previsto! Economizando ${formatCurrency(monthlyTotals.diarioPrevisto - monthlyTotals.diarioMedioOnly)}/dia`
                    : `⚠️ Acima do previsto em ${formatCurrency(monthlyTotals.diarioMedioOnly - monthlyTotals.diarioPrevisto)}/dia`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* --- DASHBOARD DETALHAMENTO CUSTO DE VIDA --- */}
        {(isCostOfLivingOpen || isCostOfLivingClosing) && (
          <div className={`absolute inset-0 bg-gray-950 z-50 flex flex-col overflow-hidden ${isCostOfLivingClosing ? 'animate-slide-down' : 'animate-slide-up'}`}>
            <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-900 shrink-0">
              <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
                <Wallet size={22} className="text-red-500" /> Custo de Vida ({monthlyTotals.monthLabel.split(' ')[0]})
              </h2>
              <button onClick={closeCostOfLiving} className="text-gray-400 hover:text-white transition-colors bg-gray-800 p-2 rounded-full cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 bg-gray-900 border-b border-gray-800 flex justify-between items-center shrink-0">
                <span className="text-sm font-semibold text-gray-400">Total do Mês:</span>
                <span className="text-xl font-extrabold text-red-400 tabular-nums tracking-tight">{formatCurrency(monthlyTotals.totalGastos)}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-950 pb-24">
                {monthlyTotals.allMonthGastosTxs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-20 text-gray-600">
                        <Wallet size={48} className="mb-4 opacity-20" />
                        <p className="text-sm">Sem gastos listados neste mês.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {monthlyTotals.allMonthGastosTxs.map(tx => {
                            let txColor = 'text-red-400';
                            if (tx.type === 'cartao') txColor = 'text-purple-400';
                            if (tx.type === 'gasto_diario') txColor = 'text-amber-400';

                            return (
                                <div key={tx.id} onClick={() => { closeCostOfLiving(); setTxFormData(prev => ({ ...prev, date: tx.date })); setIsTxModalOpen(true); }} className="flex justify-between items-center bg-gray-800/80 hover:bg-gray-800 p-4 rounded-xl border border-gray-700/50 hover:border-gray-600 transition-colors cursor-pointer group">
                                    <div className="overflow-hidden flex flex-col gap-1">
                                        <p className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">{tx.description}</p>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span className="bg-gray-900 px-2 py-0.5 rounded capitalize">{tx.type.replace('_', ' ')}</span>
                                            <span>•</span>
                                            <span>{tx.date.split('-').reverse().join('/')}</span>
                                        </div>
                                    </div>
                                    <span className={`text-base font-bold tabular-nums ml-4 shrink-0 ${txColor}`}>
                                        {formatCurrency(Math.abs(tx.amount))}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
          </div>
        )}

        {/* --- MODAL DO DASHBOARD ANUAL DE ECONOMIAS --- */}
        {(isSavingsDashboardOpen || isSavingsClosing) && (
          <div className={`absolute inset-0 bg-gray-950 z-50 flex flex-col overflow-hidden ${isSavingsClosing ? 'animate-slide-down' : 'animate-slide-up'}`}>
            <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-900 shrink-0">
              <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                <TrendingUp size={22} /> Desempenho Anual
              </h2>
              <button onClick={closeSavingsDashboard} className="text-gray-400 hover:text-white transition-colors bg-gray-800 p-2 rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="bg-gray-900 p-3 border-b border-gray-800 flex justify-center shrink-0">
              <div className="flex items-center bg-gray-800 rounded-lg p-1 border border-gray-700 shadow-sm">
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1))} className="p-1 hover:text-emerald-400 text-gray-400 hover:bg-gray-700 rounded-md transition-colors"><ChevronLeft size={18} /></button>
                <span className="font-semibold text-sm tracking-widest w-20 text-center select-none text-gray-100">
                  {annualSavingsData.yearViewed}
                </span>
                <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1))} className="p-1 hover:text-emerald-400 text-gray-400 hover:bg-gray-700 rounded-md transition-colors"><ChevronRight size={18} /></button>
              </div>
            </div>

            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6">
              {/* Card Resumo do Ano */}
              <div className="bg-gray-800 border border-emerald-900/50 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Protegido no Ano</h3>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-3xl font-extrabold text-white tracking-tight tabular-nums">
                    {formatCurrency(annualSavingsData.totalInvestido)}
                  </span>
                  <span className="text-sm font-medium text-emerald-400 bg-emerald-900/40 px-2 py-0.5 rounded-md">
                    {annualSavingsData.totalPercent.toFixed(1)}% Poupança
                  </span>
                </div>

                {/* Barra de Progresso Global */}
                <div className="w-full bg-gray-900 h-3 rounded-full overflow-hidden border border-gray-700">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-1000 ease-out relative"
                    style={{ width: `${showSavingsProgress ? Math.min(annualSavingsData.totalPercent, 100) : 0}%` }}
                  >
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500 mt-2 font-medium">
                  <span>R$ 0,00</span>
                  <span>Meta de Receita Anual ({formatCurrency(annualSavingsData.totalEntradas)})</span>
                </div>
              </div>

              {/* Lista Mês a Mês */}
              <div>
                <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3 px-1">Progresso Mensal</h3>
                <div className="flex flex-col gap-3">
                  {annualSavingsData.months.map((mInfo, idx) => {
                    // Evita poluir a viusalização cortando meses do futuro se for 0.
                    // Para dar uma sensação de "Timeline" sem sujeira matemática.
                    if (mInfo.entradas === 0 && mInfo.investido === 0) return null;

                    return (
                      <div key={idx} className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 flex flex-col gap-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-gray-200 capitalize w-14">{mInfo.monthName}</span>
                          <div className="flex-1 flex justify-between items-center bg-gray-950/50 rounded-lg px-3 py-1 ml-2 border border-gray-800/50">
                            <div className="flex flex-col text-left">
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Entrou</span>
                              <span className="text-xs font-bold text-green-400 tabular-nums">{formatCurrency(mInfo.entradas)}</span>
                            </div>
                            <div className="flex flex-col text-right">
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider text-emerald-300">Reserva</span>
                              <span className="text-xs font-bold text-emerald-400 tabular-nums">{formatCurrency(mInfo.investido)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Barra de Progressozinha do Mês */}
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out"
                              style={{ width: `${showSavingsProgress ? Math.min(mInfo.percent, 100) : 0}%` }}
                            ></div>
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 w-8 text-right tabular-nums">
                            {mInfo.percent.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; } 
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 4px; } 
        .animate-slide-up { animation: slideUp 0.3s ease-out forwards; } 
        .animate-slide-down { animation: slideDown 0.3s ease-in forwards; } 
        .animate-zoom-in { animation: zoomIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; transform-origin: center center; }
        .animate-fade-in { animation: fadeIn 0.2s ease-out forwards; }

        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideDown { from { transform: translateY(0); opacity: 1; } to { transform: translateY(100%); opacity: 0; } }
        @keyframes zoomIn { from { transform: scale(0.85) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}} />
    </div>
  );
};
