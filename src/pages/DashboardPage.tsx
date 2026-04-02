import React, { useMemo } from 'react';
import { HardHat, AlertCircle, TrendingUp, Clock, Download, Briefcase, FileText, DollarSign, CheckCircle2 } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { exportToPdf } from '../utils/pdfExport';

const CircularProgress = ({ percentage = 0 }: { percentage: number }) => {
  const safePercentage = isNaN(percentage) ? 0 : percentage;
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
  const { projects, pendencies, scheduleItems, transactions, currentUser } = useData();

  const stats = useMemo(() => {
    const activeProjects = projects.filter(p => p.status === 'em_execucao').length;
    const criticalPendencies = pendencies.filter(p => p.status === 'aberta' && (p.priority === 'critica' || p.priority === 'alta')).length;
    const lockedItems = scheduleItems.filter(s => pendencies.some(p => p.scheduleItemId === s.id && p.status === 'aberta')).length;
    
    const totalIncome = transactions.filter(t => t.type === 'entrada').reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'saida').reduce((acc, t) => acc + t.amount, 0);
    const balance = totalIncome - totalExpense;

    const projectSummaries = projects.map(project => {
      const projectPendencies = pendencies.filter(p => p.projectId === project.id && p.status === 'aberta');
      
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      let calculatedStatus = project.status as string;
      if (project.progress === 100) {
        calculatedStatus = 'concluida';
      } else if (project.endDate && project.endDate < todayStr && project.progress < 100) {
        calculatedStatus = 'atrasada';
      }

      return {
        ...project,
        pendenciesCount: projectPendencies.length,
        calculatedStatus
      };
    });

    const totalProgressSum = projectSummaries.reduce((acc, p) => acc + (p.progress || 0), 0);
    const overallProgress = projectSummaries.length > 0 ? Math.round(totalProgressSum / projectSummaries.length) : 0;

    return {
      activeProjects,
      criticalPendencies,
      lockedItems,
      balance,
      totalIncome,
      totalExpense,
      overallProgress,
      projectSummaries,
      totalPendencies: pendencies.filter(p => p.status === 'aberta').length
    };
  }, [projects, pendencies, scheduleItems, transactions]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleExportPdf = () => {
    const head = [['Projeto', 'Pendências', 'Fim Previsto', 'Status', 'Progresso']];
    const body = stats.projectSummaries.map(p => [
      p.name,
      p.pendenciesCount.toString(),
      formatDate(p.endDate),
      p.calculatedStatus.replace('_', ' ').toUpperCase(),
      `${p.progress}%`
    ]);

    exportToPdf({
      title: 'Resumo Geral das Obras',
      userName: currentUser?.name,
      filename: `dashboard-obras-${new Date().toISOString().split('T')[0]}.pdf`,
      head,
      body,
      summary: [
        { label: 'Obras Ativas', value: stats.activeProjects.toString() },
        { label: 'Pendências Críticas', value: stats.criticalPendencies.toString() },
        { label: 'Progresso Geral', value: `${stats.overallProgress}%` }
      ]
    });
  };

  const cards = [
    { 
      title: 'Obras Ativas', 
      value: stats.activeProjects.toString(), 
      icon: <HardHat size={24} />, 
      trend: 'Em Andamento',
      color: 'text-blue-500',
      bg: 'bg-blue-500/10'
    },
    { 
      title: 'Pendências Críticas', 
      value: stats.criticalPendencies.toString(), 
      icon: <AlertCircle size={24} />, 
      trend: 'Críticas',
      color: 'text-red-500',
      bg: 'bg-red-500/10'
    },
    { 
      title: 'Itens Travados', 
      value: stats.lockedItems.toString(), 
      icon: <AlertCircle size={24} />, 
      trend: 'Pendências',
      color: 'text-amber-500',
      bg: 'bg-amber-500/10'
    },
    { 
      title: 'Progresso Geral', 
      value: `${stats.overallProgress}%`, 
      icon: <TrendingUp size={24} />, 
      trend: 'De Todas Obras',
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10'
    },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      {/* 1. LINHA SUPERIOR DE CARDS RESUMO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        {cards.map((card, index) => (
          <div key={index} className="bg-[#161B22] p-4 lg:p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between h-32 lg:h-36">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${card.bg} ${card.color}`}>
                {React.cloneElement(card.icon as React.ReactElement, { size: 20 } as any)}
              </div>
              <h3 className="text-gray-400 text-xs lg:text-sm font-medium">{card.title}</h3>
            </div>
            <div>
              <p className="text-2xl lg:text-3xl font-bold text-white tracking-tight mb-1">{card.value}</p>
              <p className="text-[10px] lg:text-xs text-gray-500">{card.trend}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 2. BLOCO PRINCIPAL: RESUMO GERAL DAS OBRAS */}
      <div className="bg-[#161B22] rounded-2xl border border-white/10 overflow-hidden mb-8">
        <div className="p-4 lg:p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
          <h2 className="text-base lg:text-lg font-bold text-white">Resumo Geral das Obras</h2>
          <button 
            onClick={handleExportPdf}
            className="bg-[#161B22] hover:bg-white/10 border border-white/10 text-white px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg flex items-center gap-2 transition-colors text-xs lg:text-sm font-semibold"
          >
            <Download size={14} className="lg:w-4 lg:h-4" />
            <span className="hidden sm:inline">Exportar PDF</span>
          </button>
        </div>

        {/* Mobile View for Projects */}
        <div className="lg:hidden divide-y divide-white/5">
          {stats.projectSummaries.map((project) => (
            <div key={project.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-base">{project.name}</h3>
                <span className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  project.calculatedStatus === 'em_execucao' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 
                  project.calculatedStatus === 'concluida' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                  project.calculatedStatus === 'atrasada' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                  'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                }`}>
                  {project.calculatedStatus === 'concluida' && <CheckCircle2 size={8} />}
                  {project.calculatedStatus.replace('_', ' ')}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <Clock size={12} />
                  <span>Prazo: {formatDate(project.endDate)}</span>
                </div>
                <div className={project.pendenciesCount > 0 ? 'text-amber-500/80' : ''}>
                  {project.pendenciesCount} {project.pendenciesCount === 1 ? 'pendência' : 'pendências'}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 bg-white/5 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      project.progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${project.progress}%` }}
                  ></div>
                </div>
                <span className="text-sm font-bold text-white w-10 text-right">{project.progress}%</span>
              </div>
            </div>
          ))}
          {stats.projectSummaries.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              Nenhuma obra cadastrada.
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-gray-500">
                <th className="p-4 font-semibold">Projeto</th>
                <th className="p-4 font-semibold text-center">Status</th>
                <th className="p-4 font-semibold text-center">Prazo</th>
                <th className="p-4 font-semibold text-right">Progresso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {stats.projectSummaries.map((project) => (
                <tr key={project.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="p-4">
                    <div className="font-bold text-white text-base mb-1">{project.name}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <span className={project.pendenciesCount > 0 ? 'text-amber-500/80' : ''}>
                        {project.pendenciesCount} {project.pendenciesCount === 1 ? 'pendência' : 'pendências'}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                      project.calculatedStatus === 'em_execucao' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 
                      project.calculatedStatus === 'concluida' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                      project.calculatedStatus === 'atrasada' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                      'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                    }`}>
                      {project.calculatedStatus === 'concluida' && <CheckCircle2 size={10} />}
                      {project.calculatedStatus.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4 text-center text-sm text-gray-300">
                    {formatDate(project.endDate)}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-4">
                      <div className="w-32 bg-white/5 h-2 rounded-full overflow-hidden hidden sm:block">
                        <div 
                          className={`h-full rounded-full ${
                            project.progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${project.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-xl font-bold text-white w-12 text-right">{project.progress}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {stats.projectSummaries.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    Nenhuma obra cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. BLOCO INFERIOR: PROGRESSO TOTAL DAS OBRAS */}
      <div className="bg-[#161B22] rounded-2xl border border-white/10 p-4 lg:p-6 flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8">
        <div className="w-full lg:flex-1">
          <h3 className="text-base lg:text-lg font-bold text-white mb-4 lg:mb-6">Progresso Total das Obras</h3>
          <div className="grid grid-cols-2 gap-4 lg:gap-6">
            <div className="flex items-center gap-3">
              <Briefcase className="text-gray-500 lg:w-5 lg:h-5" size={18} />
              <div>
                <p className="text-[10px] lg:text-sm text-gray-400">Obras Totais</p>
                <p className="text-lg lg:text-xl font-bold text-white">{projects.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="text-gray-500 lg:w-5 lg:h-5" size={18} />
              <div>
                <p className="text-[10px] lg:text-sm text-gray-400">Pendências Totais</p>
                <p className="text-lg lg:text-xl font-bold text-white">{stats.totalPendencies}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DollarSign className="text-emerald-500 lg:w-5 lg:h-5" size={18} />
              <div>
                <p className="text-[10px] lg:text-sm text-gray-400">Entradas</p>
                <p className="text-base lg:text-lg font-bold text-emerald-500">{formatCurrency(stats.totalIncome)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DollarSign className="text-red-500 lg:w-5 lg:h-5" size={18} />
              <div>
                <p className="text-[10px] lg:text-sm text-gray-400">Saídas</p>
                <p className="text-base lg:text-lg font-bold text-red-500">{formatCurrency(stats.totalExpense)}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="w-full lg:w-auto flex items-center justify-center gap-6 bg-white/5 p-4 lg:p-6 rounded-xl border border-white/5">
          <CircularProgress percentage={stats.overallProgress} />
          <div className="hidden sm:block">
            <p className="text-white font-bold text-lg mb-1">Obras Totais: {projects.length}</p>
            <p className="text-gray-400 text-sm">Pendências Totais: {stats.totalPendencies}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

