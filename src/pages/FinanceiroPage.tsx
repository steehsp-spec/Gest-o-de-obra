import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, TrendingUp, TrendingDown, DollarSign, Filter, Calendar, Download, PieChart, BarChart2 } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { Transaction, TransactionType, TransactionCategory, Project } from '../types';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import { exportToPdf } from '../utils/pdfExport';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart as RePieChart, Pie, Cell, BarChart, Bar } from 'recharts';

export default function FinanceiroPage() {
  const { transacoes, addTransacao, updateTransacao, deleteTransacao, obras, currentUser } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [filterProject, setFilterProject] = useState('');
  const [filterType, setFilterType] = useState('');
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState<Omit<Transaction, 'id'>>({
    obraId: '',
    description: '',
    amount: 0,
    type: 'saida',
    category: 'material',
    date: new Date().toISOString().split('T')[0],
    status: 'pago',
    workedHours: 0,
    workedDays: 0,
    dailyRateValue: 0,
    payableHours: 0,
    fullDailyRates: 0,
    adjustedDailyRates: 0,
    totalDailyRates: 0
  });

  const handleOpenModal = (transaction?: Transaction) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setFormData({ 
        ...transaction,
        workedHours: transaction.workedHours || 0,
        workedDays: transaction.workedDays || 0,
        dailyRateValue: transaction.dailyRateValue || 0,
        payableHours: transaction.payableHours || 0,
        fullDailyRates: transaction.fullDailyRates || 0,
        adjustedDailyRates: transaction.adjustedDailyRates || 0,
        totalDailyRates: transaction.totalDailyRates || 0
      });
    } else {
      setEditingTransaction(null);
      setFormData({
        obraId: filterProject || '',
        description: '',
        amount: 0,
        type: 'saida',
        category: 'material',
        date: new Date().toISOString().split('T')[0],
        status: 'pago',
        workedHours: 0,
        workedDays: 0,
        dailyRateValue: 0,
        payableHours: 0,
        fullDailyRates: 0,
        adjustedDailyRates: 0,
        totalDailyRates: 0
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    if (editingTransaction) {
      updateTransacao(editingTransaction.id, {
        ...formData,
        updatedAt: now
      });
    } else {
      addTransacao({
        ...formData,
        createdAt: now,
        updatedAt: now
      });
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setTransactionToDelete(id);
  };

  const confirmDelete = () => {
    if (transactionToDelete) {
      deleteTransacao(transactionToDelete);
      setTransactionToDelete(null);
    }
  };

  const filteredTransactions = transacoes.filter(t => {
    const matchesProject = filterProject === '' || t.obraId === filterProject;
    const matchesType = filterType === '' || t.type === filterType;
    return matchesProject && matchesType;
  });

  const totals = useMemo(() => {
    const defaultTotals = { 
      income: 0, 
      expense: 0, 
      balance: 0, 
      byCategory: {} as Record<TransactionCategory, number>,
      byDate: [] as { date: string, income: number, expense: number, cumulative: number }[],
      projectBudget: 0,
    };

    if (filteredTransactions.length === 0) {
      if (filterProject) {
        const project = obras.find(p => p.id === filterProject);
        if (project) defaultTotals.projectBudget = project.budget || 0;
      }
      return defaultTotals;
    }

    const categoryTotals = {} as Record<TransactionCategory, number>;
    const dateMap = new Map<string, { income: number, expense: number }>();
    
    let incomeTotal = 0;
    let expenseTotal = 0;

    filteredTransactions.forEach(t => {
      if (t.type === 'entrada') incomeTotal += t.amount;
      else {
        expenseTotal += t.amount;
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
      }

      const dateKey = t.date;
      const current = dateMap.get(dateKey) || { income: 0, expense: 0 };
      if (t.type === 'entrada') current.income += t.amount;
      else current.expense += t.amount;
      dateMap.set(dateKey, current);
    });

    const sortedDates = Array.from(dateMap.keys()).sort();
    let cumulative = 0;
    const byDate = sortedDates.map(date => {
      const data = dateMap.get(date)!;
      cumulative += (data.income - data.expense);
      return {
        date,
        income: data.income,
        expense: data.expense,
        cumulative
      };
    });

    let projectBudget = 0;
    if (filterProject) {
      const project = obras.find(p => p.id === filterProject);
      if (project) projectBudget = project.budget || 0;
    }

    return {
      income: incomeTotal,
      expense: expenseTotal,
      balance: incomeTotal - expenseTotal,
      byCategory: categoryTotals,
      byDate,
      projectBudget
    };
  }, [filteredTransactions, filterProject, obras]);

  const categoryData = useMemo(() => {
    const totalExpense = totals.expense || 1;
    return Object.entries(totals.byCategory).map(([category, amount]) => ({
      name: category.replace('_', ' ').charAt(0).toUpperCase() + category.replace('_', ' ').slice(1),
      value: amount,
      percentage: ((amount / totalExpense) * 100).toFixed(1)
    })).sort((a, b) => b.value - a.value);
  }, [totals.byCategory, totals.expense]);

  const COLORS = ['#F97316', '#3B82F6', '#10B981', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899'];

  // Labor calculation logic
  React.useEffect(() => {
    if (formData.category === 'mao_de_obra') {
      const workedHours = formData.workedHours || 0;
      const workedDays = formData.workedDays || 0;
      const dailyRateValue = formData.dailyRateValue || 0;

      // 1. total_horas_pagaveis = horas_trabalhadas + (1h × número de dias trabalhados)
      const payableHours = workedHours + workedDays;

      // 2. diarias_inteiras = floor(total_horas_pagaveis / 10)
      const fullDailyRates = Math.floor(payableHours / 10);
      
      // 3. resto_horas = total_horas_pagaveis % 10
      const remainder = payableHours % 10;

      // 4. Regra do restante:
      // - resto < 4 → não soma
      // - resto >= 4 e < 7 → soma 0.5 diária
      // - resto >= 7 → soma 1 diária
      let adjustment = 0;
      if (remainder >= 7) {
        adjustment = 1;
      } else if (remainder >= 4) {
        adjustment = 0.5;
      }

      const totalDailyRates = fullDailyRates + adjustment;
      const totalAmount = totalDailyRates * dailyRateValue;

      // Update state if values changed to avoid infinite loop
      if (
        formData.payableHours !== payableHours ||
        formData.fullDailyRates !== fullDailyRates ||
        formData.adjustedDailyRates !== adjustment ||
        formData.totalDailyRates !== totalDailyRates ||
        formData.amount !== totalAmount
      ) {
        setFormData(prev => ({
          ...prev,
          payableHours,
          fullDailyRates,
          adjustedDailyRates: adjustment,
          totalDailyRates,
          amount: totalAmount
        }));
      }
    }
  }, [formData.category, formData.workedHours, formData.workedDays, formData.dailyRateValue, formData.payableHours, formData.fullDailyRates, formData.adjustedDailyRates, formData.totalDailyRates, formData.amount]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDateToBR = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleExportPdf = () => {
    const project = obras.find(p => p.id === filterProject);
    const projectName = project ? project.name : 'Todas as Obras';
    
    const head = [['Data', 'Obra', 'Categoria', 'Descrição', 'Tipo', 'Valor']];
    const body: any[][] = [];

    filteredTransactions.forEach(t => {
      const proj = obras.find(proj => proj.id === t.obraId);
      body.push([
        formatDateToBR(t.date),
        proj?.name || '-',
        t.category,
        t.description,
        t.type === 'entrada' ? 'Entrada' : 'Saída',
        formatCurrency(t.amount)
      ]);
    });

    exportToPdf({
      title: 'Relatório Financeiro',
      projectName,
      userName: currentUser?.name,
      filename: `financeiro-${projectName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`,
      head,
      body,
      summary: [
        { label: 'Total Entradas', value: formatCurrency(totals.income) },
        { label: 'Total Saídas', value: formatCurrency(totals.expense) },
        { label: 'Saldo Líquido', value: formatCurrency(totals.balance) }
      ]
    });
  };

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 lg:mb-8">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white">Gestão Financeira</h1>
          <p className="text-gray-400 text-xs lg:text-sm">Controle de entradas e saídas por obra</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <button 
            onClick={handleExportPdf}
            className="bg-[#161B22] hover:bg-white/5 border border-white/10 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors font-semibold text-sm lg:text-base w-full sm:flex-1 lg:w-auto"
          >
            <Download size={18} className="lg:w-5 lg:h-5" />
            Exportar PDF
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-[#F97316] hover:bg-[#EA580C] text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors font-semibold text-sm lg:text-base w-full sm:flex-1 lg:w-auto"
          >
            <Plus size={18} className="lg:w-5 lg:h-5" />
            Nova Transação
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <div className="bg-[#161B22] p-4 lg:p-6 rounded-xl lg:rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-[10px] lg:text-xs font-semibold uppercase tracking-wider">Total Entradas</span>
            <TrendingUp size={18} className="text-emerald-500" />
          </div>
          <p className="text-xl lg:text-2xl font-bold text-emerald-500">{formatCurrency(totals.income)}</p>
        </div>
        <div className="bg-[#161B22] p-4 lg:p-6 rounded-xl lg:rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-[10px] lg:text-xs font-semibold uppercase tracking-wider">Total Saídas</span>
            <TrendingDown size={18} className="text-red-500" />
          </div>
          <p className="text-xl lg:text-2xl font-bold text-red-500">{formatCurrency(totals.expense)}</p>
        </div>
        <div className="bg-[#161B22] p-4 lg:p-6 rounded-xl lg:rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-[10px] lg:text-xs font-semibold uppercase tracking-wider">Saldo Líquido</span>
            <DollarSign size={18} className="text-[#F97316]" />
          </div>
          <p className={`text-xl lg:text-2xl font-bold ${totals.balance >= 0 ? 'text-white' : 'text-red-500'}`}>
            {formatCurrency(totals.balance)}
          </p>
        </div>
        {filterProject && (
          <div className="bg-[#161B22] p-4 lg:p-6 rounded-xl lg:rounded-2xl border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-[10px] lg:text-xs font-semibold uppercase tracking-wider">Saldo Orçamento</span>
              <PieChart size={18} className="text-blue-500" />
            </div>
            <p className={`text-xl lg:text-2xl font-bold ${totals.projectBudget - totals.expense >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
              {formatCurrency(totals.projectBudget - totals.expense)}
            </p>
            <div className="w-full bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${totals.expense > totals.projectBudget ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(100, (totals.expense / (totals.projectBudget || 1)) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {filterProject ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-[#161B22] p-6 rounded-2xl border border-white/10">
            <h3 className="text-white font-bold mb-6 flex items-center gap-2">
              <BarChart2 size={20} className="text-[#F97316]" />
              Evolução Financeira
            </h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={totals.byDate}>
                  <defs>
                    <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F97316" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#ffffff40" 
                    fontSize={10}
                    tickFormatter={(val) => formatDateToBR(val).split('/')[0] + '/' + formatDateToBR(val).split('/')[1]}
                  />
                  <YAxis stroke="#ffffff40" fontSize={10} tickFormatter={(val) => `R$ ${val/1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0B0E14', border: '1px solid #ffffff10', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(val: any) => [formatCurrency(Number(val)), 'Saldo']}
                    labelFormatter={(label) => `Data: ${formatDateToBR(label)}`}
                  />
                  <Area type="monotone" dataKey="cumulative" stroke="#F97316" fillOpacity={1} fill="url(#colorCumulative)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#161B22] p-6 rounded-2xl border border-white/10">
            <h3 className="text-white font-bold mb-6 flex items-center gap-2">
              <PieChart size={20} className="text-[#F97316]" />
              Distribuição por Categoria
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0B0E14', border: '1px solid #ffffff10', borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(val: any) => formatCurrency(Number(val))}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col justify-center space-y-3">
                {categoryData.map((cat, index) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs lg:text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-gray-300">{cat.name}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-white font-bold">{cat.percentage}%</span>
                      <span className="text-[10px] text-gray-500">{formatCurrency(cat.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
         <div className="bg-[#161B22] p-6 rounded-2xl border border-white/10 mb-8 flex flex-col items-center justify-center text-center">
            <Filter size={48} className="text-gray-600 mb-4" />
            <h2 className="text-white font-bold text-lg mb-2">Selecione uma obra para ver a análise financeira detalhada</h2>
            <p className="text-gray-500 text-sm max-w-md">Para visualizar gráficos de evolução, distribuição de custos e saldo de orçamento, selecione um projeto específico no filtro acima.</p>
         </div>
      )}

      <div className="bg-[#161B22] p-4 rounded-xl border border-white/10 mb-6 flex flex-col md:flex-row items-center gap-4">
        <div className="w-full md:flex-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Filtrar por Obra</label>
          <select 
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-[#F97316]"
          >
            <option value="">Todas as Obras</option>
            {obras.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="w-full md:w-48">
          <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Tipo</label>
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-[#F97316]"
          >
            <option value="">Todos</option>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </select>
        </div>
      </div>

      <div className="bg-[#161B22] rounded-xl lg:rounded-2xl border border-white/10 overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden lg:block">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#0B0E14] text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Data</th>
                <th className="px-6 py-4 font-semibold">Descrição</th>
                <th className="px-6 py-4 font-semibold">Obra</th>
                <th className="px-6 py-4 font-semibold">Categoria</th>
                <th className="px-6 py-4 font-semibold">Valor</th>
                <th className="px-6 py-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 text-gray-400 text-sm">{formatDateToBR(t.date)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {t.type === 'entrada' ? (
                        <TrendingUp size={16} className="text-emerald-500" />
                      ) : (
                        <TrendingDown size={16} className="text-red-500" />
                      )}
                      <span className="text-white font-medium">{t.description}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {obras.find(p => p.id === t.obraId)?.name || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 uppercase font-bold tracking-wider bg-white/5 px-2 py-1 rounded inline-block w-fit mb-1">
                        {t.category.replace('_', ' ')}
                      </span>
                      {t.category === 'mao_de_obra' && t.totalDailyRates && (
                        <span className="text-[10px] text-gray-500">
                          {t.workedHours}h + {t.workedDays}h (alm) • {t.totalDailyRates} diárias
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`px-6 py-4 font-bold ${t.type === 'entrada' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {t.type === 'entrada' ? '+' : '-'} {formatCurrency(t.amount)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleOpenModal(t)}
                        className="p-2 text-gray-400 hover:text-[#F97316]"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(t.id)}
                        className="p-2 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                    Nenhuma transação encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden divide-y divide-white/5">
          {filteredTransactions.map((t) => (
            <div key={t.id} className="p-4 hover:bg-white/5 transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${t.type === 'entrada' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                    {t.type === 'entrada' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white font-bold text-sm">{t.description}</span>
                    <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                      {obras.find(p => p.id === t.obraId)?.name || '-'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleOpenModal(t)}
                    className="p-2 text-gray-400 hover:text-[#F97316]"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(t.id)}
                    className="p-2 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Categoria</span>
                  <span className="text-xs text-gray-300">{t.category.replace('_', ' ')}</span>
                  {t.category === 'mao_de_obra' && t.totalDailyRates && (
                    <span className="text-[9px] text-[#F97316] font-medium">
                      {t.totalDailyRates} diárias ({t.workedHours}h + {t.workedDays}h)
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Data</span>
                  <span className="text-xs text-gray-300">{formatDateToBR(t.date)}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Valor</span>
                  <span className={`text-sm font-bold ${t.type === 'entrada' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {t.type === 'entrada' ? '+' : '-'} {formatCurrency(t.amount)}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {filteredTransactions.length === 0 && (
            <div className="px-6 py-10 text-center text-gray-500">
              Nenhuma transação encontrada.
            </div>
          )}
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingTransaction ? 'Editar Transação' : 'Nova Transação'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-6">
          <div className="space-y-2">
            <label className="text-xs lg:text-sm text-gray-400">Descrição *</label>
            <input 
              required
              type="text" 
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs lg:text-sm text-gray-400">Obra *</label>
              <select 
                required
                value={formData.obraId || ''}
                onChange={(e) => setFormData({ ...formData, obraId: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
              >
                <option value="">Selecione a obra</option>
                {obras.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs lg:text-sm text-gray-400">Data *</label>
              <input 
                required
                type="date" 
                value={formData.date || ''}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs lg:text-sm text-gray-400">Tipo *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'entrada' })}
                  className={`flex-1 py-2.5 lg:py-3 rounded-lg border font-semibold transition-all text-sm lg:text-base ${
                    formData.type === 'entrada' 
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' 
                      : 'bg-[#0B0E14] border-white/10 text-gray-500'
                  }`}
                >
                  Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'saida' })}
                  className={`flex-1 py-2.5 lg:py-3 rounded-lg border font-semibold transition-all text-sm lg:text-base ${
                    formData.type === 'saida' 
                      ? 'bg-red-500/10 border-red-500 text-red-500' 
                      : 'bg-[#0B0E14] border-white/10 text-gray-500'
                  }`}
                >
                  Saída
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs lg:text-sm text-gray-400">Valor (R$) *</label>
              <input 
                required
                type="number" 
                step="0.01"
                min="0"
                value={formData.amount || 0}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs lg:text-sm text-gray-400">Categoria *</label>
              <select 
                required
                value={formData.category || 'material'}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as TransactionCategory })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
              >
                <option value="material">Materiais</option>
                <option value="mao_de_obra">Mão de Obra</option>
                <option value="equipamento">Equipamentos</option>
                <option value="administrativo">Administrativo</option>
                <option value="servico">Serviços</option>
                <option value="outros">Outros</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs lg:text-sm text-gray-400">Status *</label>
              <select 
                required
                value={formData.status || 'pago'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago / Recebido</option>
                <option value="atrasado">Atrasado</option>
              </select>
            </div>
          </div>

          {formData.category === 'mao_de_obra' && (
            <div className="space-y-4 p-3 lg:p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-[#F97316]" />
                <h3 className="text-xs lg:text-sm font-bold text-[#F97316] uppercase tracking-wider">Cálculo de Mão de Obra (Almoço Pago)</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] lg:text-xs text-gray-400 uppercase font-semibold">Horas Trabalhadas</label>
                  <input 
                    type="number"
                    placeholder="Ex: 45"
                    value={formData.workedHours || ''}
                    onChange={(e) => setFormData({ ...formData, workedHours: Number(e.target.value) })}
                    className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2 text-white text-xs lg:text-sm focus:outline-none focus:border-[#F97316]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] lg:text-xs text-gray-400 uppercase font-semibold">Dias Trabalhados</label>
                  <input 
                    type="number"
                    placeholder="Ex: 5"
                    value={formData.workedDays || ''}
                    onChange={(e) => setFormData({ ...formData, workedDays: Number(e.target.value) })}
                    className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2 text-white text-xs lg:text-sm focus:outline-none focus:border-[#F97316]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] lg:text-xs text-gray-400 uppercase font-semibold">Vlr Diária (10h)</label>
                  <input 
                    type="number"
                    placeholder="Ex: 150"
                    value={formData.dailyRateValue || ''}
                    onChange={(e) => setFormData({ ...formData, dailyRateValue: Number(e.target.value) })}
                    className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2 text-white text-xs lg:text-sm focus:outline-none focus:border-[#F97316]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="bg-[#0B0E14] p-2 rounded-lg border border-white/5">
                  <span className="text-[9px] lg:text-[10px] text-gray-500 uppercase block">Horas Pagáveis</span>
                  <span className="text-xs lg:text-sm font-bold text-white">{formData.payableHours}h</span>
                </div>
                <div className="bg-[#0B0E14] p-2 rounded-lg border border-white/5">
                  <span className="text-[9px] lg:text-[10px] text-gray-500 uppercase block">Diárias Inteiras</span>
                  <span className="text-xs lg:text-sm font-bold text-white">{formData.fullDailyRates}</span>
                </div>
                <div className="bg-[#0B0E14] p-2 rounded-lg border border-white/5">
                  <span className="text-[9px] lg:text-[10px] text-gray-500 uppercase block">Ajuste (+0.5/1)</span>
                  <span className="text-xs lg:text-sm font-bold text-white">+{formData.adjustedDailyRates}</span>
                </div>
                <div className="bg-[#F97316]/10 p-2 rounded-lg border border-[#F97316]/20">
                  <span className="text-[9px] lg:text-[10px] text-[#F97316] uppercase block font-bold">Total Diárias</span>
                  <span className="text-xs lg:text-sm font-bold text-[#F97316]">{formData.totalDailyRates} uni</span>
                </div>
              </div>
              <p className="text-[9px] text-gray-500 italic">* Regra: 1h de almoço por dia. Diária de 10h. Resto &lt; 4h=0, &ge; 4h=0.5, &ge; 7h=1.</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm lg:text-base"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="bg-[#F97316] hover:bg-[#EA580C] text-white px-6 py-2 rounded-lg font-semibold transition-colors text-sm lg:text-base"
            >
              Salvar Transação
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!transactionToDelete}
        onClose={() => setTransactionToDelete(null)}
        onConfirm={confirmDelete}
        title="Excluir Transação"
        message="Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
