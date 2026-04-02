import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, User as UserIcon, CheckCircle2, Clock, AlertCircle, CircleDashed, Download } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { ScheduleItem, Pendency } from '../types';
import { exportToPdf } from '../utils/pdfExport';

export default function ResponsaveisPage() {
  const { scheduleItems, projects, users, pendencies, currentUser } = useData();
  
  const [filterProject, setFilterProject] = useState('');
  const [filterResponsible, setFilterResponsible] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedUsers, setExpandedUsers] = useState<string[]>([]);

  const toggleUser = (userName: string) => {
    setExpandedUsers(prev => 
      prev.includes(userName) ? prev.filter(n => n !== userName) : [...prev, userName]
    );
  };

  const getItemStatus = (item: ScheduleItem, itemPendencies: Pendency[]) => {
    const hasOpenPendency = itemPendencies.some(p => p.status === 'aberta' || p.status === 'em_andamento');
    
    if (hasOpenPendency || item.status === 'atrasado') return 'Pendente';
    if (item.progress === 100 || item.status === 'concluido') return 'Finalizada';
    if (item.progress > 0 || item.status === 'em_andamento') return 'Em andamento';
    return 'A Fazer';
  };

  const responsaveisData = useMemo(() => {
    const map = new Map<string, {
      name: string;
      userId?: string;
      items: Array<{
        item: ScheduleItem;
        status: string;
        projectName: string;
        parentStepName?: string;
      }>;
      stats: {
        total: number;
        aFazer: number;
        pendente: number;
        emAndamento: number;
        finalizada: number;
      };
    }>();

    scheduleItems.forEach(item => {
      // Determine responsible name
      let respName = item.responsavelNome;
      
      // Removemos a busca na lista de usuários.
      // Se não houver nome, não consideramos este item.
      
      if (!respName) return; // Skip items without responsible

      // --- FILTRO DE INTEGRIDADE ---
      const project = projects.find(p => p.id === item.projectId);
      if (!project) {
        console.warn(`[LOG TEMPORÁRIO] Item órfão encontrado (sem obra) - Projetos carregados: ${projects.length}:`, item);
        return; // Exclui item sem obra válida
      }

      // Verifica se a etapa pai existe, caso o item tenha uma
      if (item.parentStepId) {
        const parentStep = scheduleItems.find(s => s.id === item.parentStepId);
        if (!parentStep) {
          console.warn(`[LOG TEMPORÁRIO] Item órfão encontrado (etapa pai inexistente):`, item);
          return; // Exclui item com etapa pai inexistente
        }
      }

      // Apply project filter
      if (filterProject && item.projectId !== filterProject) return;

      const itemPendencies = pendencies.filter(p => p.scheduleItemId === item.id);
      const status = getItemStatus(item, itemPendencies);

      // Apply status filter
      if (filterStatus && status !== filterStatus) return;

      const parentStep = item.parentStepId ? scheduleItems.find(s => s.id === item.parentStepId) : undefined;

      if (!map.has(respName)) {
        map.set(respName, {
          name: respName,
          userId: item.responsavelUserId,
          items: [],
          stats: { total: 0, aFazer: 0, pendente: 0, emAndamento: 0, finalizada: 0 }
        });
      }

      const data = map.get(respName)!;
      data.items.push({
        item,
        status,
        projectName: project.name, // Não usamos mais 'Obra Desconhecida'
        parentStepName: parentStep?.title
      });

      data.stats.total++;
      if (status === 'A Fazer') data.stats.aFazer++;
      else if (status === 'Pendente') data.stats.pendente++;
      else if (status === 'Em andamento') data.stats.emAndamento++;
      else if (status === 'Finalizada') data.stats.finalizada++;
    });

    return Array.from(map.values()).sort((a, b) => b.stats.total - a.stats.total);
  }, [scheduleItems, projects, users, pendencies, filterProject, filterStatus]);

  // Filter by responsible name
  const filteredResponsaveis = useMemo(() => {
    if (!filterResponsible) return responsaveisData;
    return responsaveisData.filter(r => r.name.toLowerCase().includes(filterResponsible.toLowerCase()));
  }, [responsaveisData, filterResponsible]);

  const uniqueResponsibleNames = useMemo(() => {
    const names = new Set<string>();
    scheduleItems.forEach(item => {
      let respName = item.responsavelNome;
      // Removemos a busca na lista de usuários.
      if (respName) names.add(respName);
    });
    return Array.from(names).sort();
  }, [scheduleItems]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Finalizada':
        return <span className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded text-xs font-medium"><CheckCircle2 size={12} /> Finalizada</span>;
      case 'Em andamento':
        return <span className="flex items-center gap-1 text-blue-500 bg-blue-500/10 px-2 py-1 rounded text-xs font-medium"><Clock size={12} /> Em andamento</span>;
      case 'Pendente':
        return <span className="flex items-center gap-1 text-amber-500 bg-amber-500/10 px-2 py-1 rounded text-xs font-medium"><AlertCircle size={12} /> Pendente</span>;
      default:
        return <span className="flex items-center gap-1 text-gray-400 bg-gray-500/10 px-2 py-1 rounded text-xs font-medium"><CircleDashed size={12} /> A Fazer</span>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Finalizada': return 'text-emerald-500';
      case 'Em andamento': return 'text-blue-500';
      case 'Pendente': return 'text-amber-500';
      default: return 'text-gray-400';
    }
  };

  const formatDateToBR = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleExportPdf = () => {
    const project = projects.find(p => p.id === filterProject);
    const projectName = project ? project.name : 'Todas as Obras';
    
    const head = [['Responsável', 'Total', 'A Fazer', 'Pendente', 'Em andamento', 'Finalizada', '% Concluída']];
    const body: any[][] = [];

    filteredResponsaveis.forEach(resp => {
      const percentComplete = resp.stats.total > 0 
        ? Math.round((resp.stats.finalizada / resp.stats.total) * 100) 
        : 0;
        
      body.push([
        resp.name,
        resp.stats.total,
        resp.stats.aFazer,
        resp.stats.pendente,
        resp.stats.emAndamento,
        resp.stats.finalizada,
        `${percentComplete}%`
      ]);
    });

    exportToPdf({
      title: 'Resumo Operacional por Responsável',
      projectName,
      userName: currentUser?.name,
      filename: `responsaveis-${new Date().toISOString().split('T')[0]}.pdf`,
      head,
      body,
      summary: [
        { label: 'Total de Responsáveis', value: filteredResponsaveis.length.toString() },
        { label: 'Total de Atividades', value: filteredResponsaveis.reduce((acc, r) => acc + r.stats.total, 0).toString() }
      ]
    });
  };

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 lg:mb-8">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white">Responsáveis</h1>
          <p className="text-gray-400 text-xs lg:text-sm">Resumo operacional de atividades por responsável</p>
        </div>
        <button 
          onClick={handleExportPdf}
          className="bg-[#161B22] hover:bg-white/5 border border-white/10 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors font-semibold text-sm lg:text-base w-full lg:w-auto"
        >
          <Download size={18} className="lg:w-5 lg:h-5" />
          Exportar PDF
        </button>
      </div>

      <div className="bg-[#161B22] rounded-xl lg:rounded-2xl border border-white/10 overflow-hidden mb-6">
        <div className="p-4 border-b border-white/10 flex flex-col md:flex-row gap-4 bg-[#0B0E14]">
          <div className="flex-1 min-w-0">
            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 block">Obra</label>
            <select 
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="w-full bg-[#161B22] border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-[#F97316]"
            >
              <option value="">Todas as Obras</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          
          <div className="flex-1 min-w-0">
            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 block">Responsável</label>
            <select 
              value={filterResponsible}
              onChange={(e) => setFilterResponsible(e.target.value)}
              className="w-full bg-[#161B22] border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-[#F97316]"
            >
              <option value="">Todos</option>
              {uniqueResponsibleNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-0">
            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 block">Status</label>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-[#161B22] border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-[#F97316]"
            >
              <option value="">Todos</option>
              <option value="A Fazer">A Fazer</option>
              <option value="Em andamento">Em andamento</option>
              <option value="Pendente">Pendente</option>
              <option value="Finalizada">Finalizada</option>
            </select>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#0B0E14] text-gray-400 text-[11px] uppercase tracking-wider border-b border-white/5">
                <th className="px-6 py-4 font-semibold">Responsável</th>
                <th className="px-4 py-4 font-semibold text-center">Total</th>
                <th className="px-4 py-4 font-semibold text-center">A Fazer</th>
                <th className="px-4 py-4 font-semibold text-center">Pendente</th>
                <th className="px-4 py-4 font-semibold text-center">Em andamento</th>
                <th className="px-4 py-4 font-semibold text-center">Finalizada</th>
                <th className="px-6 py-4 font-semibold text-right">% Concluída</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredResponsaveis.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Nenhum responsável encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredResponsaveis.map((resp) => {
                  const percentComplete = resp.stats.total > 0 
                    ? Math.round((resp.stats.finalizada / resp.stats.total) * 100) 
                    : 0;
                  
                  const isExpanded = expandedUsers.includes(resp.name);

                  return (
                    <React.Fragment key={resp.name}>
                      <tr 
                        className="hover:bg-white/5 transition-colors cursor-pointer group"
                        onClick={() => toggleUser(resp.name)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <button className="text-gray-500 group-hover:text-white transition-colors">
                              {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </button>
                            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold border border-blue-500/30">
                              {resp.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-blue-400 font-bold text-base">{resp.name}</span>
                              <span className="text-gray-500 text-xs">{resp.name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-white font-bold text-lg">{resp.stats.total}</span>
                            <span className="text-gray-500 text-[10px] uppercase">Total</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-gray-300 font-bold text-lg">{resp.stats.aFazer}</span>
                            <span className="text-gray-500 text-[10px] bg-gray-500/20 px-1.5 rounded">{resp.stats.aFazer}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-amber-400 font-bold text-lg">{resp.stats.pendente}</span>
                            <span className="text-amber-500/70 text-[10px] bg-amber-500/20 px-1.5 rounded">{resp.stats.pendente}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-white font-bold text-lg">{resp.stats.emAndamento}</span>
                            <span className="text-gray-500 text-[10px] bg-gray-500/20 px-1.5 rounded">{resp.stats.emAndamento}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-white font-bold text-lg">{resp.stats.finalizada}</span>
                            <span className="text-emerald-500/70 text-[10px] bg-emerald-500/20 px-1.5 rounded">{resp.stats.finalizada}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <div className="flex flex-col gap-1 w-24">
                              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${percentComplete === 100 ? 'bg-emerald-500' : percentComplete > 0 ? 'bg-blue-500' : 'bg-amber-500'}`} 
                                  style={{ width: `${percentComplete}%` }}
                                ></div>
                              </div>
                            </div>
                            <span className="text-white font-bold text-lg w-12">{percentComplete}%</span>
                          </div>
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="p-0 bg-[#0B0E14]/50 border-b border-white/5">
                            <div className="px-14 py-4">
                              <table className="w-full text-left">
                                <thead>
                                  <tr className="text-gray-500 text-[10px] uppercase tracking-wider border-b border-white/5">
                                    <th className="pb-2 font-semibold">Obra</th>
                                    <th className="pb-2 font-semibold">Etapa / Subitem</th>
                                    <th className="pb-2 font-semibold">Prazo</th>
                                    <th className="pb-2 font-semibold">Progresso</th>
                                    <th className="pb-2 font-semibold text-right">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                  {resp.items.map((itemData, idx) => (
                                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                                      <td className="py-3 text-sm text-gray-300">{itemData.projectName}</td>
                                      <td className="py-3 text-sm">
                                        <div className="flex flex-col">
                                          {itemData.parentStepName && <span className="text-gray-500 text-xs">{itemData.parentStepName}</span>}
                                          <span className="text-gray-300">{itemData.item.title}</span>
                                        </div>
                                      </td>
                                      <td className="py-3 text-sm text-gray-400">
                                        {itemData.item.endDate ? formatDateToBR(itemData.item.endDate) : '-'}
                                      </td>
                                      <td className="py-3 text-sm">
                                        <div className="flex items-center gap-2">
                                          <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                            <div 
                                              className="h-full bg-blue-500 rounded-full" 
                                              style={{ width: `${itemData.item.progress}%` }}
                                            ></div>
                                          </div>
                                          <span className="text-gray-400 text-xs">{itemData.item.progress}%</span>
                                        </div>
                                      </td>
                                      <td className="py-3 text-right">
                                        {getStatusBadge(itemData.status)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden divide-y divide-white/5">
          {filteredResponsaveis.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              Nenhum responsável encontrado com os filtros atuais.
            </div>
          ) : (
            filteredResponsaveis.map((resp) => {
              const percentComplete = resp.stats.total > 0 
                ? Math.round((resp.stats.finalizada / resp.stats.total) * 100) 
                : 0;
              
              const isExpanded = expandedUsers.includes(resp.name);

              return (
                <div key={resp.name} className="flex flex-col">
                  <div 
                    className="p-4 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => toggleUser(resp.name)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold border border-blue-500/30">
                          {resp.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-blue-400 font-bold text-sm">{resp.name}</span>
                          <span className="text-gray-500 text-[10px] uppercase tracking-wider">{resp.stats.total} Atividades</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                          <span className="text-white font-bold text-sm">{percentComplete}%</span>
                          <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden mt-1">
                            <div 
                              className={`h-full rounded-full ${percentComplete === 100 ? 'bg-emerald-500' : percentComplete > 0 ? 'bg-blue-500' : 'bg-amber-500'}`} 
                              style={{ width: `${percentComplete}%` }}
                            ></div>
                          </div>
                        </div>
                        <button className="text-gray-500">
                          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div className="bg-[#0B0E14] p-2 rounded border border-white/5 flex flex-col items-center">
                        <span className="text-gray-400 font-bold text-xs">{resp.stats.aFazer}</span>
                        <span className="text-[8px] text-gray-500 uppercase">A Fazer</span>
                      </div>
                      <div className="bg-[#0B0E14] p-2 rounded border border-white/5 flex flex-col items-center">
                        <span className="text-amber-400 font-bold text-xs">{resp.stats.pendente}</span>
                        <span className="text-[8px] text-amber-500/70 uppercase">Pendente</span>
                      </div>
                      <div className="bg-[#0B0E14] p-2 rounded border border-white/5 flex flex-col items-center">
                        <span className="text-blue-400 font-bold text-xs">{resp.stats.emAndamento}</span>
                        <span className="text-[8px] text-blue-500/70 uppercase">Em and.</span>
                      </div>
                      <div className="bg-[#0B0E14] p-2 rounded border border-white/5 flex flex-col items-center">
                        <span className="text-emerald-400 font-bold text-xs">{resp.stats.finalizada}</span>
                        <span className="text-[8px] text-emerald-500/70 uppercase">Final.</span>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-[#0B0E14]/50 p-4 space-y-4">
                      {resp.items.map((itemData, idx) => (
                        <div key={idx} className="bg-[#161B22] p-3 rounded-lg border border-white/5 space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">{itemData.projectName}</span>
                              <span className="text-white text-sm font-medium">{itemData.item.title}</span>
                              {itemData.parentStepName && <span className="text-gray-500 text-[10px]">{itemData.parentStepName}</span>}
                            </div>
                            {getStatusBadge(itemData.status)}
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 rounded-full" 
                                  style={{ width: `${itemData.item.progress}%` }}
                                ></div>
                              </div>
                              <span className="text-gray-400 text-[10px]">{itemData.item.progress}%</span>
                            </div>
                            <span className="text-gray-500 text-[10px]">Prazo: {itemData.item.endDate ? formatDateToBR(itemData.item.endDate) : '-'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        
        <div className="p-4 border-t border-white/5 bg-[#0B0E14] flex flex-wrap items-center justify-center gap-4 lg:gap-6">
          <div className="flex items-center gap-2 text-[10px] lg:text-xs text-gray-400">
            <CircleDashed size={14} />
            <span>A Fazer</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] lg:text-xs text-amber-400">
            <AlertCircle size={14} />
            <span>Pendente</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] lg:text-xs text-blue-400">
            <Clock size={14} />
            <span>Em andamento</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] lg:text-xs text-emerald-400">
            <CheckCircle2 size={14} />
            <span>Finalizada</span>
          </div>
        </div>
      </div>
    </div>
  );
}
