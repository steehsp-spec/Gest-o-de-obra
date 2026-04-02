import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { CronogramaHeader, SummaryPanel, StageBlock } from '../components/cronograma/CronogramaComponents';
import Modal from '../components/ui/Modal';
import { Filter, X, Search, AlertTriangle, Layout } from 'lucide-react';
import { Complexity, ScheduleItem } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { compareDates, addDays, getDaysBetween } from '../utils/dateUtils';
import { InlineDateInput } from '../components/InlineDateInput';

export default function CronogramaPage() {
  const { 
    scheduleItems,
    projects, 
    addScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    updateProject,
    users
  } = useData();

  // Local State
  const [filterProject, setFilterProject] = useState<string>('');
  
  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [parentStepId, setParentStepId] = useState<string | null>(null);
  
  // Filter State
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    responsible: '',
    search: ''
  });

  const project = projects.find(p => p.id === filterProject);

  // Calculate Project Steps with Progress and Dates
  const projectSteps = useMemo(() => {
    if (!filterProject || !project) return [];
    
    let items = scheduleItems.filter(s => s.projectId === filterProject);

    const mainStepsRaw = items
      .filter(s => !s.parentStepId)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    
    const calculatedSteps = mainStepsRaw.map(step => {
      const subSteps = items
        .filter(s => s.parentStepId === step.id)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      
      return {
        ...step,
        subSteps
      };
    });

    // Apply Filters to the calculated steps
    let filteredSteps = calculatedSteps;
    
    if (filters.status || filters.responsible || filters.search) {
      filteredSteps = filteredSteps.map(step => {
        const filteredSubSteps = step.subSteps.filter(sub => {
          const matchesStatus = !filters.status || sub.status === filters.status;
          const matchesResponsible = !filters.responsible || sub.responsibleId === filters.responsible;
          const matchesSearch = !filters.search || 
            sub.title.toLowerCase().includes(filters.search.toLowerCase()) ||
            step.title.toLowerCase().includes(filters.search.toLowerCase());
          return matchesStatus && matchesResponsible && matchesSearch;
        });

        // If the main step matches the search but has no sub-steps matching, we might still want to show it
        const mainMatchesSearch = !filters.search || step.title.toLowerCase().includes(filters.search.toLowerCase());
        
        if (filteredSubSteps.length > 0 || mainMatchesSearch) {
          return { ...step, subSteps: filteredSubSteps };
        }
        return null;
      }).filter(Boolean) as any[];
    }

    return filteredSteps;
  }, [scheduleItems, filterProject, filters]);

  // Calculate Overall Progress for selected project
  const overallProgress = useMemo(() => {
    if (!filterProject || projectSteps.length === 0) return 0;
    
    // Use all items for real progress, not just filtered ones
    const allItems = scheduleItems.filter(s => s.projectId === filterProject);
    const mainSteps = allItems.filter(s => !s.parentStepId);
    
    const totalWeight = mainSteps.reduce((acc, s) => acc + (Number(s.weight) || 0), 0);
    if (totalWeight === 0) return 0;
    
    const weightedProgress = mainSteps.reduce((acc, s) => {
      const weight = Number(s.weight) || 0;
      const progress = Number(s.progress) || 0;
      return acc + (progress * (weight / totalWeight));
    }, 0);
    
    return Math.round(weightedProgress);
  }, [scheduleItems, filterProject, projectSteps.length]);

  // Helper function to format YYYY-MM-DD to DD/MM/YYYY
  const formatDateToBR = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    weight: 0,
    progress: 0,
    complexity: 'media' as Complexity,
    responsibleId: '',
    status: 'pendente' as 'pendente' | 'em_andamento' | 'concluido' | 'atrasado',
    startDate: '',
    endDate: '',
    liberatingActivityId: '',
    linkType: 'FS' as 'FS' | 'SS',
    workFront: '',
    dateLockedManual: false
  });

  const handleOpenModal = (item?: any, parentId?: string) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        title: item.title || '',
        weight: item.weight || 0,
        progress: item.progress || 0,
        complexity: (item.complexity || 'media') as Complexity,
        responsibleId: item.responsibleId || '',
        status: (item.status || 'pendente') as any,
        startDate: item.startDate || '',
        endDate: item.endDate || '',
        liberatingActivityId: item.liberatingActivityId || '',
        linkType: item.linkType || 'FS',
        workFront: item.workFront || '',
        dateLockedManual: item.dateLockedManual || false
      });
    } else {
      setEditingItem(null);
      setParentStepId(parentId || null);
      
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      setFormData({
        title: '',
        weight: 0,
        progress: 0,
        complexity: 'media' as Complexity,
        responsibleId: '',
        status: 'pendente',
        startDate: todayStr,
        endDate: todayStr,
        liberatingActivityId: '',
        linkType: 'FS',
        workFront: '',
        dateLockedManual: false
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filterProject) return;

    const data: Omit<ScheduleItem, 'id'> = {
      ...formData,
      projectId: filterProject,
      parentStepId: (editingItem ? editingItem.parentStepId : parentStepId) || undefined,
      ordem: editingItem ? editingItem.ordem : (scheduleItems.filter(s => s.projectId === filterProject && s.parentStepId === (parentStepId || undefined)).length),
      startDateManual: formData.dateLockedManual,
      endDateManual: formData.dateLockedManual,
      dateLockedManual: formData.dateLockedManual
    };

    if (editingItem) {
      await updateScheduleItem(editingItem.id, data);
    } else {
      await addScheduleItem(data);
    }
    setIsModalOpen(false);
  };

  const handleUpdateSubStageProgress = async (subId: string, val: number) => {
    const subItem = scheduleItems.find(i => i.id === subId);
    if (!subItem) return;

    let newStatus: any = 'pendente';
    if (val === 100) newStatus = 'concluido';
    else if (val >= 75) newStatus = 'finalizando';
    else if (val >= 50) newStatus = 'revisao';
    else if (val >= 25) newStatus = 'em_processo';
    else if (val > 0) newStatus = 'em_processo'; // Default for > 0 but < 25
    
    await updateScheduleItem(subId, { progress: val, status: newStatus });
  };

  const handleUpdateProjectField = async (field: string, value: any) => {
    if (!project) return;
    await updateProject(project.id, { [field]: value });
  };

  const totalWeights = useMemo(() => {
    const mainSteps = scheduleItems.filter(s => s.projectId === filterProject && !s.parentStepId);
    return mainSteps.reduce((acc, curr) => acc + (Number(curr.weight) || 0), 0);
  }, [scheduleItems, filterProject]);

  const projectStatus = useMemo(() => {
    const endDateStr = project?.endDate;
    if (!endDateStr) return { status: 'ok', label: 'Dentro do prazo' };
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    if (endDateStr < todayStr && overallProgress < 100) {
      return { status: 'delayed', label: 'Atrasado' };
    }
    
    return { status: 'ok', label: 'Dentro do prazo' };
  }, [project, overallProgress]);

  // Calculate Dependency Options (Predecessors only, grouped by stage)
  const dependencyOptions = useMemo(() => {
    if (!filterProject) return [];
    
    const allItems = scheduleItems.filter(s => s.projectId === filterProject);
    
    // Helper to get global position
    const getPos = (item: any) => {
      if (!item.parentStepId) return (item.ordem || 0) * 1000;
      const parent = allItems.find(p => p.id === item.parentStepId);
      return ((parent?.ordem || 0) * 1000) + (item.ordem || 0);
    };

    // Find current item's position
    let currentPos = Infinity;
    if (editingItem) {
      currentPos = getPos(editingItem);
    } else if (parentStepId) {
      const parent = allItems.find(p => p.id === parentStepId);
      const subStepsCount = allItems.filter(s => s.parentStepId === parentStepId).length;
      currentPos = ((parent?.ordem || 0) * 1000) + subStepsCount;
    } else {
      const mainStepsCount = allItems.filter(s => !s.parentStepId).length;
      currentPos = mainStepsCount * 1000;
    }

    // Filter predecessors
    const predecessors = allItems.filter(i => {
      if (i.id === editingItem?.id) return false;
      return getPos(i) < currentPos;
    });

    // Group by Stage
    const mainStages = allItems
      .filter(i => !i.parentStepId)
      .sort((a, b) => compareDates(a.startDate, b.startDate));

    const grouped: { stage: string, items: any[] }[] = [];
    
    mainStages.forEach(stage => {
      const stageItems = predecessors.filter(p => p.id === stage.id || p.parentStepId === stage.id);
      if (stageItems.length > 0) {
        grouped.push({
          stage: stage.title,
          items: stageItems.sort((a, b) => compareDates(a.startDate, b.startDate))
        });
      }
    });

    return grouped;
  }, [scheduleItems, filterProject, editingItem, parentStepId]);

  const expectedEndDate = useMemo(() => {
    if (project?.endDate) return formatDateToBR(project.endDate);
    if (!project || !project.startDate || !project.totalDays) return '-';
    // Se não tem endDate, mas tem startDate e totalDays, calcula (apenas para fallback)
    const end = addDays(project.startDate, project.totalDays - 1);
    return formatDateToBR(end);
  }, [project]);

  const handleExportPdf = () => {
    if (!project) return;
    
    const doc = new jsPDF('landscape');
    
    // Title
    doc.setFontSize(18);
    doc.text(`Cronograma - ${project.name}`, 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Data de Início: ${project.startDate ? formatDateToBR(project.startDate) : '-'} | Previsão de Término: ${expectedEndDate} | Progresso: ${overallProgress}%`, 14, 30);

    const tableData: any[] = [];
    
    projectSteps.forEach(step => {
      // Add main stage row
      tableData.push([
        { content: step.title, styles: { fontStyle: 'bold', fillColor: [22, 27, 34], textColor: [255, 255, 255] } },
        { content: step.startDate ? formatDateToBR(step.startDate) : '-', styles: { fillColor: [22, 27, 34], textColor: [255, 255, 255] } },
        { content: step.endDate ? formatDateToBR(step.endDate) : '-', styles: { fillColor: [22, 27, 34], textColor: [255, 255, 255] } },
        { content: `${step.progress}%`, styles: { fontStyle: 'bold', fillColor: [22, 27, 34], textColor: [255, 255, 255] } },
        { content: step.status, styles: { fillColor: [22, 27, 34], textColor: [255, 255, 255] } }
      ]);

      // Add substages
      if (step.subSteps && step.subSteps.length > 0) {
        step.subSteps.forEach((sub: any) => {
          tableData.push([
            `   ↳ ${sub.title}`,
            sub.startDate ? formatDateToBR(sub.startDate) : '-',
            sub.endDate ? formatDateToBR(sub.endDate) : '-',
            `${sub.progress}%`,
            sub.status
          ]);
        });
      }
    });

    autoTable(doc, {
      startY: 35,
      head: [['Etapa / Subetapa', 'Início', 'Fim', 'Progresso', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [249, 115, 22], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 30 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 },
        4: { cellWidth: 40 }
      }
    });

    doc.save(`cronograma_${project.name.replace(/\s+/g, '_').toLowerCase()}.pdf`);
  };

  return (
    <div className="p-4 lg:p-8 bg-[#0B0E14] min-h-screen text-white">
      <CronogramaHeader 
        projects={projects}
        selectedProjectId={filterProject || ''}
        onSelectProject={setFilterProject}
        onAddEtapa={() => handleOpenModal()}
        onExportPdf={handleExportPdf}
      />
      
      {filterProject ? (
        <>
          <SummaryPanel data={{
            totalDays: (
              <div className="flex items-center gap-2">
                <input 
                  type="number"
                  value={project?.totalDays || 0}
                  onChange={(e) => handleUpdateProjectField('totalDays', parseInt(e.target.value) || 0)}
                  className="bg-white/5 w-20 text-xl font-black text-white outline-none border border-white/10 rounded px-2 focus:border-[#F97316] transition-all"
                />
                <span className="text-xs text-gray-500 font-bold uppercase">Dias</span>
              </div>
            ),
            startDate: (
              <InlineDateInput 
                value={project?.startDate || ''}
                className="text-xl font-black text-white"
                onUpdate={async (date) => {
                  await handleUpdateProjectField('startDate', date);
                }}
              />
            ),
            expectedDate: (
              <InlineDateInput 
                value={project?.endDate || ''}
                className="text-xl font-black text-white"
                onUpdate={async (date) => {
                  if (project?.startDate) {
                    const newTotalDays = getDaysBetween(project.startDate, date);
                    await handleUpdateProjectField('totalDays', newTotalDays);
                  }
                }}
              />
            ),
            status: projectStatus.label,
            progress: overallProgress,
            totalWeights: totalWeights
          }} />

          {/* Filters Bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border transition-all shadow-lg ${showFilters ? 'bg-[#F97316] border-[#F97316] text-white' : 'bg-[#161B22] border-white/10 text-gray-400 hover:bg-white/5'}`}
              >
                <Filter size={18} />
                <span className="text-xs font-black uppercase tracking-widest">Filtrar Cronograma</span>
              </button>
              
              {showFilters && (
                <button 
                  onClick={() => setFilters({ status: '', responsible: '', search: '' })}
                  className="text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-wider underline underline-offset-4"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="bg-[#161B22] p-6 rounded-2xl border border-white/10 mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 shadow-2xl">
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Status da Atividade</label>
                <select 
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  className="w-full bg-[#0B0E14] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#F97316] transition-all"
                >
                  <option value="">Todos os Status</option>
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="concluido">Concluído</option>
                  <option value="atrasado">Atrasado</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Responsável Técnico</label>
                <select 
                  value={filters.responsible}
                  onChange={(e) => setFilters({...filters, responsible: e.target.value})}
                  className="w-full bg-[#0B0E14] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#F97316] transition-all"
                >
                  <option value="">Todos os Responsáveis</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Busca Rápida</label>
                <div className="relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input 
                    type="text"
                    placeholder="Nome da etapa ou subetapa..."
                    value={filters.search}
                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                    className="w-full bg-[#0B0E14] border border-white/10 rounded-xl pl-12 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#F97316] transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-[minmax(320px,2.2fr)_minmax(140px,0.9fr)_minmax(200px,1fr)_minmax(120px,0.7fr)_minmax(80px,0.5fr)] gap-[12px] px-5 py-3 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] border-b border-white/5 mb-4">
            <div className="text-left">Etapa / Subetapa</div>
            <div className="text-left">Período</div>
            <div className="text-center">Progresso</div>
            <div className="text-center">Status</div>
            <div className="text-right">Ações</div>
          </div>

          <div className="space-y-2">
            {projectSteps?.length > 0 ? (
              projectSteps.map(step => (
                <StageBlock 
                  key={step.id} 
                  stage={step} 
                  subStages={step.subSteps} 
                  onEdit={() => handleOpenModal(step)} 
                  onDelete={() => {
                    if (confirm('Deseja realmente excluir esta etapa? Todas as subetapas vinculadas serão removidas permanentemente.')) {
                      deleteScheduleItem(step.id);
                    }
                  }} 
                  onAddSubStage={() => handleOpenModal(undefined, step.id)}
                  onEditSubStage={(sub) => handleOpenModal(sub)}
                  onDeleteSubStage={(subId) => {
                    if (confirm('Deseja excluir esta subetapa?')) {
                      deleteScheduleItem(subId);
                    }
                  }}
                  onUpdateSubStageProgress={handleUpdateSubStageProgress}
                />
              ))
            ) : (
              <div className="text-center py-32 bg-[#161B22] rounded-3xl border border-dashed border-white/10 shadow-inner">
                <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Layout size={32} className="text-gray-600" />
                </div>
                <p className="text-gray-400 font-medium">Nenhuma etapa encontrada para os filtros aplicados.</p>
                <button 
                  onClick={() => setFilters({ status: '', responsible: '', search: '' })}
                  className="mt-4 text-xs font-bold text-[#F97316] uppercase tracking-widest hover:underline"
                >
                  Limpar todos os filtros
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-40 bg-[#161B22] rounded-3xl border border-dashed border-white/10 shadow-inner">
          <div className="bg-white/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search size={40} className="text-gray-700" />
          </div>
          <h2 className="text-xl font-bold text-gray-300 mb-2">Cronograma não selecionado</h2>
          <p className="text-gray-500 max-w-xs mx-auto">Selecione uma obra no topo da tela para gerenciar o cronograma executivo.</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingItem ? 'Editar Item do Cronograma' : (parentStepId ? 'Nova Subetapa' : 'Nova Etapa Principal')}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Título da Atividade</label>
            <input 
              required
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="w-full bg-[#0B0E14] border border-white/10 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-[#F97316] transition-all"
              placeholder="Ex: Infraestrutura Elétrica do Mezanino"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Ambiente / Frente</label>
              <input 
                type="text"
                value={formData.workFront}
                onChange={(e) => setFormData({...formData, workFront: e.target.value})}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-[#F97316] transition-all"
                placeholder="Ex: Cozinha, Teto, Área Técnica..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Responsável</label>
              <select 
                value={formData.responsibleId}
                onChange={(e) => setFormData({...formData, responsibleId: e.target.value})}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-[#F97316] transition-all"
              >
                <option value="">Nenhum Responsável</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Peso (%)</label>
              <input 
                type="number"
                value={formData.weight}
                onChange={(e) => setFormData({...formData, weight: parseInt(e.target.value) || 0})}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-[#F97316] transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Progresso (%)</label>
              <input 
                type="number"
                min="0"
                max="100"
                value={formData.progress}
                disabled={!editingItem ? !parentStepId : !editingItem.parentStepId}
                onChange={(e) => setFormData({...formData, progress: parseInt(e.target.value) || 0})}
                className={`w-full bg-[#0B0E14] border border-white/10 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-[#F97316] transition-all ${(!editingItem ? !parentStepId : !editingItem.parentStepId) ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Complexidade</label>
              <select 
                value={formData.complexity}
                onChange={(e) => setFormData({...formData, complexity: e.target.value as Complexity})}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-[#F97316] transition-all"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Status</label>
              <select 
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-[#F97316] transition-all"
              >
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluido">Concluído</option>
                <option value="atrasado">Atrasado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Dependência (Interferência)</label>
              <select 
                value={formData.liberatingActivityId}
                onChange={(e) => setFormData({...formData, liberatingActivityId: e.target.value})}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-[#F97316] transition-all"
              >
                <option value="">Nenhuma Dependência</option>
                {dependencyOptions.map(group => (
                  <optgroup key={group.stage} label={group.stage} className="bg-[#161B22] text-[#F97316] font-bold">
                    {group.items.map(i => (
                      <option key={i.id} value={i.id} className="text-white font-normal">
                        {i.parentStepId ? '↳ ' : ''}{i.workFront ? `[${i.workFront}] ` : ''}{i.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Tipo de Vínculo</label>
              <select 
                value={formData.linkType}
                onChange={(e) => setFormData({...formData, linkType: e.target.value as any})}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-[#F97316] transition-all"
              >
                <option value="FS">Término-Início (FS)</option>
                <option value="SS">Início-Início (SS)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/10">
            <input 
              type="checkbox"
              id="dateLockedManual"
              checked={formData.dateLockedManual}
              onChange={(e) => setFormData({...formData, dateLockedManual: e.target.checked})}
              className="w-5 h-5 rounded border-white/10 bg-[#0B0E14] text-[#F97316] focus:ring-0 focus:ring-offset-0"
            />
            <label htmlFor="dateLockedManual" className="text-sm font-bold text-gray-300 cursor-pointer">
              Travar Datas Manualmente (Ignorar automação para este item)
            </label>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Data Início</label>
              <input 
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-[#F97316] transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Data Fim</label>
              <input 
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-xl px-5 py-3 text-white focus:outline-none focus:border-[#F97316] transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 pt-6 border-t border-white/5">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-white transition-all uppercase tracking-widest"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-10 py-3 bg-[#F97316] text-white rounded-xl font-black uppercase tracking-widest hover:bg-[#F97316]/90 transition-all shadow-xl shadow-orange-500/20"
            >
              {editingItem ? 'Salvar Alterações' : 'Criar Atividade'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
