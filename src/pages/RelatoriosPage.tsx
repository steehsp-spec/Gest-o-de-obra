import React, { useState, useMemo } from 'react';
import { FileText, Download, Filter, TrendingUp, AlertCircle, DollarSign } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { exportToPdf } from '../utils/pdfExport';

export default function RelatoriosPage() {
  const { projects, activities, pendencies, transactions, scheduleItems, currentUser } = useData();
  const [selectedProject, setSelectedProject] = useState('');

  const reportData = useMemo(() => {
    const filteredProjects = selectedProject 
      ? projects.filter(p => p.id === selectedProject)
      : projects;

    return filteredProjects.map(project => {
      const projectPendencies = pendencies.filter(p => p.projectId === project.id);
      const projectTransactions = transactions.filter(t => t.projectId === project.id);
      const totalIncome = projectTransactions.filter(t => t.type === 'entrada').reduce((acc, t) => acc + t.amount, 0);
      const totalExpense = projectTransactions.filter(t => t.type === 'saida').reduce((acc, t) => acc + t.amount, 0);
      
      return {
        ...project,
        stats: {
          activitiesCount: scheduleItems.filter(s => s.projectId === project.id && s.parentStepId).length,
          completedActivities: scheduleItems.filter(s => s.projectId === project.id && s.parentStepId && s.progress === 100).length,
          pendenciesCount: projectPendencies.length,
          openPendencies: projectPendencies.filter(p => p.status === 'aberta' || (p.status as string) === 'em_analise').length,
          income: totalIncome,
          expense: totalExpense,
          balance: totalIncome - totalExpense,
          progress: project.progress
        }
      };
    });
  }, [selectedProject, projects, pendencies, transactions, scheduleItems]);

  const handleExportPdf = () => {
    const project = projects.find(p => p.id === selectedProject);
    const projectName = project ? project.name : 'Todas as Obras';
    
    const head = [['Obra', 'Status', 'Progresso Físico', 'Atividades', 'Pendências', 'Saldo Financeiro']];
    const body: any[][] = [];

    reportData.forEach(data => {
      body.push([
        data.name,
        data.status.replace('_', ' ').toUpperCase(),
        `${data.stats.progress}%`,
        `${data.stats.completedActivities} / ${data.stats.activitiesCount}`,
        `${data.stats.openPendencies} abertas`,
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.stats.balance)
      ]);
    });

    exportToPdf({
      title: 'Relatório Gerencial de Obras',
      projectName,
      userName: currentUser?.name,
      filename: `relatorio-gerencial-${new Date().toISOString().split('T')[0]}.pdf`,
      head,
      body,
      summary: [
        { label: 'Total de Obras', value: reportData.length.toString() },
        { label: 'Obras em Execução', value: reportData.filter(d => d.status === 'em_execucao').length.toString() }
      ]
    });
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white">Relatórios Gerenciais</h1>
          <p className="text-gray-400 text-xs lg:text-sm">Análise de desempenho e saúde das obras</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-2 bg-[#161B22] px-3 py-2 lg:px-4 lg:py-2 rounded-lg border border-white/10">
            <Filter size={16} className="text-gray-500 lg:w-[18px] lg:h-[18px]" />
            <select 
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="bg-transparent text-white text-xs lg:text-sm focus:outline-none w-full sm:w-auto"
            >
              <option value="">Todas as Obras</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <button 
            onClick={handleExportPdf}
            className="bg-white/5 hover:bg-white/10 text-white px-3 py-2 lg:px-4 lg:py-2 rounded-lg flex items-center justify-center gap-2 transition-colors border border-white/10 text-xs lg:text-sm font-semibold"
          >
            <Download size={16} className="lg:w-[18px] lg:h-[18px]" />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {reportData.map((data) => (
          <div key={data.id} className="bg-[#161B22] rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-4 lg:p-6 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="text-base lg:text-lg font-bold text-white truncate">{data.name}</h3>
                <p className="text-xs lg:text-sm text-gray-400 truncate">{data.client} • {(data as any).location}</p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest block mb-1">Status</span>
                <span className={`text-[10px] lg:text-xs font-bold uppercase px-2 py-1 rounded ${
                  data.status === 'em_execucao' ? 'bg-blue-500/10 text-blue-500' : 'bg-emerald-500/10 text-emerald-500'
                }`}>
                  {data.status.replace('_', ' ')}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
              <div className="p-4 lg:p-6">
                <div className="flex items-center gap-3 mb-4 text-blue-400">
                  <TrendingUp size={18} className="lg:w-5 lg:h-5" />
                  <span className="text-xs lg:text-sm font-semibold uppercase tracking-wider">Progresso Físico</span>
                </div>
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-2xl lg:text-3xl font-bold text-white">{data.stats.progress}%</span>
                  <span className="text-gray-500 text-[10px] lg:text-xs mb-1">Concluído</span>
                </div>
                <div className="w-full bg-white/5 h-1.5 lg:h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${data.stats.progress}%` }}></div>
                </div>
              </div>

              <div className="p-4 lg:p-6">
                <div className="flex items-center gap-3 mb-4 text-[#F97316]">
                  <FileText size={18} className="lg:w-5 lg:h-5" />
                  <span className="text-xs lg:text-sm font-semibold uppercase tracking-wider">Atividades</span>
                </div>
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-2xl lg:text-3xl font-bold text-white">{data.stats.completedActivities}</span>
                  <span className="text-gray-500 text-[10px] lg:text-xs mb-1">de {data.stats.activitiesCount} concluídas</span>
                </div>
                <p className="text-[10px] lg:text-xs text-gray-400">Taxa de conclusão: {data.stats.activitiesCount > 0 ? Math.round((data.stats.completedActivities / data.stats.activitiesCount) * 100) : 0}%</p>
              </div>

              <div className="p-4 lg:p-6">
                <div className="flex items-center gap-3 mb-4 text-red-400">
                  <AlertCircle size={18} className="lg:w-5 lg:h-5" />
                  <span className="text-xs lg:text-sm font-semibold uppercase tracking-wider">Pendências</span>
                </div>
                <div className="flex items-end gap-2 mb-1">
                  <span className="text-2xl lg:text-3xl font-bold text-white">{data.stats.openPendencies}</span>
                  <span className="text-gray-500 text-[10px] lg:text-xs mb-1">críticas / abertas</span>
                </div>
                <p className="text-[10px] lg:text-xs text-gray-400">Total de pendências registradas: {data.stats.pendenciesCount}</p>
              </div>

              <div className="p-4 lg:p-6">
                <div className="flex items-center gap-3 mb-4 text-emerald-400">
                  <DollarSign size={18} className="lg:w-5 lg:h-5" />
                  <span className="text-xs lg:text-sm font-semibold uppercase tracking-wider">Financeiro</span>
                </div>
                <div className="flex items-end gap-2 mb-1">
                  <span className={`text-xl lg:text-2xl font-bold ${data.stats.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.stats.balance)}
                  </span>
                </div>
                <div className="flex flex-col gap-1 text-[10px] text-gray-500 mt-2">
                  <span>Entradas: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.stats.income)}</span>
                  <span>Saídas: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.stats.expense)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
