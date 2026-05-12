import React, { useMemo } from 'react';
import { HardHat, AlertCircle, TrendingUp, Clock, Download, Briefcase, FileText, DollarSign, CheckCircle2, PieChart } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { exportToPdf } from '../utils/pdfExport';
import { ProgressBar } from '../components/ui/ProgressBar';

const CircularProgress = ({ percentage = 0 }: { percentage: number }) => {
  const safePercentage = isNaN(percentage) ? 0 : Math.min(100, Math.max(0, Math.round(percentage)));
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safePercentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="transform -rotate-90 w-24 h-24">
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          className="text-white/10"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="text-emerald-500 transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute text-xl font-bold text-white">{safePercentage}%</span>
    </div>
  );
};

export default function DashboardPage() {
  const { obras, pendencias, tarefas, transacoes, currentUser } = useData();

  const stats = useMemo(() => {
    const activeProjects = obras.filter(p => p.status === 'em_execucao').length;
    const criticalPendencies = pendencias.filter(p => p.status === 'aberta' && (p.priority === 'critica' || p.priority === 'alta')).length;
    const lockedItems = tarefas.filter(s => pendencias.some(p => (p.tarefaId === s.id || p.scheduleItemId === s.id) && p.status === 'aberta'));
    
    const totalIncome = transacoes.filter(t => t.type === 'entrada').reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = transacoes.filter(t => t.type === 'saida').reduce((acc, t) => acc + t.amount, 0);
    const totalBudget = obras.reduce((acc, p) => acc + (p.budget || 0), 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const projectSummaries = obras.map(project => {
      const projectTransactions = transacoes.filter(t => t.obraId === project.id);
      const projectExpense = projectTransactions.filter(t => t.type === 'saida').reduce((acc, t) => acc + t.amount, 0);
      const projectBudget = project.budget || 0;
      const financialProgress = projectBudget > 0 ? Math.min(100, (projectExpense / projectBudget) * 100) : 0;
      const remainingBalance = projectBudget - projectExpense;
      
      const projectPendencies = pendencias.filter(p => p.obraId === project.id && p.status === 'aberta');
      
      let calculatedStatus = project.status as string;
      if (project.progress === 100) {
        calculatedStatus = 'concluida';
      } else if (project.endDate && project.endDate < todayStr && project.progress < 100) {
        calculatedStatus = 'atrasada';
      }

      return {
        ...project,
        expense: projectExpense,
        financialProgress,
        remainingBalance,
        pendenciesCount: projectPendencies.length,
        calculatedStatus
      };
    });

    const overallProgress = projectSummaries.length > 0 
      ? Math.round(projectSummaries.reduce((acc, p) => acc + (p.progress || 0), 0) / projectSummaries.length) 
      : 0;
    
    const totalFinancialProgress = totalBudget > 0 ? Math.round((totalExpense / totalBudget) * 100) : 0;

    // Alertas de atraso: dataAtual > dataFim e progresso < 100%
    const delayedItems = tarefas.filter(item => {
      // Somente tarefas "folha" (com peso ou título real) e que não são etapas pai vazias
      if (item.status === 'concluido' || item.progress === 100 || !item.endDate) return false;
      return item.endDate < todayStr;
    }).map(item => {
      const project = obras.find(p => p.id === item.obraId);
      return {
        ...item,
        projectName: project?.name || 'Obra Desconhecida'
      };
    }).sort((a, b) => (a.endDate! < b.endDate! ? -1 : 1));

    return {
      activeProjects,
      criticalPendencies,
      lockedItemsCount: lockedItems.length,
      balance: totalBudget - totalExpense,
      totalIncome,
      totalExpense,
      totalBudget,
      overallProgress,
      totalFinancialProgress,
      projectSummaries,
      totalPendencies: pendencias.filter(p => p.status === 'aberta').length,
      delayedItems
    };
  }, [obras, pendencias, tarefas, transacoes]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleExportPdf = () => {
    const head = [['Obra', 'Status', 'Prog. Físico', 'Prog. Financeiro', 'Prazo', 'Saldo']];
    const body = stats.projectSummaries.map(p => {
      let statusLabel = p.calculatedStatus.replace('_', ' ').toUpperCase();
      if (p.calculatedStatus === 'em_execucao') statusLabel = 'EM EXECUÇÃO';
      if (p.calculatedStatus === 'concluida') statusLabel = 'CONCLUÍDA';
      if (p.calculatedStatus === 'atrasada') statusLabel = 'ATRASADA';

      return [
        p.name,
        statusLabel,
        `${p.progress}%`,
        `${p.financialProgress.toFixed(1)}%`,
        formatDate(p.endDate),
        formatCurrency(p.remainingBalance)
      ];
    });

    exportToPdf({
      title: 'Dashboard Executivo de Obras',
      userName: currentUser?.name,
      filename: `dashboard-executivo-${new Date().toISOString().split('T')[0]}.pdf`,
      head,
      body,
      summary: [
        { label: 'Obras Ativas', value: stats.activeProjects.toString() },
        { label: 'Investimento Total', value: formatCurrency(stats.totalBudget) },
        { label: 'Progresso Físico Geral', value: `${stats.overallProgress}%` },
        { label: 'Progresso Financeiro Geral', value: `${stats.totalFinancialProgress}%` }
      ]
    });
  };

  const cards = [
    { 
      title: 'Status Geral', 
      value: stats.activeProjects.toString(), 
      icon: <HardHat size={24} />, 
      trend: `${stats.activeProjects} obras em execução`,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10'
    },
    { 
      title: 'Progresso Físico', 
      value: `${stats.overallProgress}%`, 
      icon: <TrendingUp size={24} />, 
      trend: 'Média ponderada',
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10'
    },
    { 
      title: 'Progresso Financeiro', 
      value: `${stats.totalFinancialProgress}%`, 
      icon: <DollarSign size={24} />, 
      trend: 'Gasto vs Orçado',
      color: 'text-amber-500',
      bg: 'bg-amber-500/10'
    },
    { 
      title: 'Saldo Orçado', 
      value: formatCurrency(stats.balance), 
      icon: <DollarSign size={24} />, 
      trend: 'Disponível para gasto',
      color: 'text-purple-500',
      bg: 'bg-purple-500/10'
    },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6 lg:space-y-8">
      {/* Header com Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-white uppercase tracking-tighter">Dashboard <span className="text-[#F97316]">Executivo</span></h1>
          <p className="text-gray-500 text-xs lg:text-sm">Visão geral do desempenho físico e financeiro de suas obras</p>
        </div>
        <button 
          onClick={handleExportPdf}
          className="bg-[#F97316] hover:bg-[#EA580C] text-white px-4 py-2 lg:px-6 lg:py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all text-xs lg:text-sm font-bold shadow-lg shadow-[#F97316]/20"
        >
          <Download size={18} />
          <span>Exportar Relatório</span>
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {cards.map((card, index) => (
          <div key={index} className="bg-[#161B22] p-5 lg:p-6 rounded-2xl border border-white/10 hover:border-[#F97316]/30 transition-all group">
            <div className={`w-10 h-10 lg:w-12 lg:h-12 rounded-xl ${card.bg} ${card.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
              {card.icon}
            </div>
            <div>
              <h3 className="text-gray-500 text-[10px] lg:text-xs font-black uppercase tracking-widest mb-1">{card.title}</h3>
              <p className="text-xl lg:text-2xl font-black text-white mb-1">{card.value}</p>
              <p className="text-[10px] lg:text-xs text-gray-500 font-medium">{card.trend}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Lista de Obras e Desempenho */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#161B22] rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-4 lg:p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <h2 className="text-sm lg:text-base font-black text-white uppercase tracking-widest">Acompanhamento por Obra</h2>
            </div>
            <div className="divide-y divide-white/5">
              {stats.projectSummaries.map((project) => (
                <div key={project.id} className="p-4 lg:p-6 hover:bg-white/[0.02] transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-base lg:text-lg font-black text-white mb-1 uppercase tracking-tight">{project.name}</h3>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                          project.calculatedStatus === 'em_execucao' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
                          project.calculatedStatus === 'concluida' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                          project.calculatedStatus === 'atrasada' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                          'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        }`}>
                          {project.calculatedStatus === 'em_execucao' ? 'EM EXECUÇÃO' : 
                           project.calculatedStatus === 'concluida' ? 'CONCLUÍDA' :
                           project.calculatedStatus === 'atrasada' ? 'ATRASADA' :
                           project.calculatedStatus.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Fim: {formatDate(project.endDate)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">Saldo Restante</p>
                      <p className={`text-sm lg:text-base font-black ${project.remainingBalance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {formatCurrency(project.remainingBalance)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Progresso Físico */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className="text-gray-500">Progresso Físico</span>
                        <span className="text-white">{Math.round(project.progress)}%</span>
                      </div>
                      <ProgressBar progress={project.progress} mode="simple" />
                    </div>
                    {/* Progresso Financeiro */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className="text-gray-500">Gasto vs Orçamentário</span>
                        <span className={project.financialProgress > 100 ? 'text-red-500' : 'text-amber-500'}>
                          {project.financialProgress.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${
                            project.financialProgress > 100 ? 'bg-red-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, project.financialProgress)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {stats.projectSummaries.length === 0 && (
                <div className="p-12 text-center text-gray-500 italic">
                  Nenhuma obra cadastrada no sistema.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar: Alertas e Notificações */}
        <div className="space-y-6">
          <div className="bg-[#161B22] rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" />
              <h2 className="text-xs font-black text-white uppercase tracking-widest">Alertas de Atraso</h2>
            </div>
            <div className="p-2 lg:p-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              {stats.delayedItems.length > 0 ? (
                stats.delayedItems.map((item) => (
                  <div key={item.id} className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl space-y-1 group hover:bg-red-500/10 transition-colors">
                    <p className="text-[10px] text-red-500 font-black uppercase tracking-tighter">{item.projectName}</p>
                    <p className="text-[11px] lg:text-xs font-bold text-white line-clamp-2">{item.title}</p>
                    <div className="flex items-center justify-between pt-1">
                        <span className="text-[9px] text-gray-500 font-bold uppercase">Vencido em {formatDate(item.endDate!)}</span>
                        <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-widest">ATRASADO</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center space-y-2">
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={24} />
                  </div>
                  <p className="text-[10px] lg:text-xs text-gray-500 font-bold uppercase italic tracking-widest">Tudo em dia!</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#161B22] rounded-2xl border border-white/10 p-5 lg:p-6 space-y-4">
             <div className="flex items-center gap-2">
                <PieChart size={18} className="text-[#F97316]" />
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Resumo de Saúde</h3>
             </div>
             
             <div className="flex items-center gap-4">
                <CircularProgress percentage={stats.overallProgress} />
                <div className="space-y-1">
                   <p className="text-lg font-black text-white">{stats.overallProgress}%</p>
                   <p className="text-[10px] text-gray-500 font-bold uppercase leading-tight">Progresso Físico Médio</p>
                </div>
             </div>

             <div className="pt-4 border-t border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                   <span className="text-[10px] text-gray-500 font-bold uppercase">Pendências Abertas</span>
                   <span className="text-xs font-black text-white">{stats.totalPendencies}</span>
                </div>
                <div className="flex items-center justify-between text-red-500">
                   <span className="text-[10px] font-bold uppercase">Etapas Atrasadas</span>
                   <span className="text-xs font-black">{stats.delayedItems.length}</span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}


