import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, ChevronRight, ChevronDown, AlertTriangle, AlertCircle, Download, Loader2, Layout, Calendar } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { ScheduleItem, Complexity, Pendency } from '../types';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import { exportToPdf } from '../utils/pdfExport';
import { InlineDateInput } from '../components/InlineDateInput';

const getProgressColor = (val: number) => {
  if (val === 0) return 'bg-gray-600';
  if (val <= 25) return 'bg-yellow-500';
  if (val <= 50) return 'bg-blue-500';
  if (val <= 75) return 'bg-emerald-500';
  return 'bg-green-600';
};

const QuickProgress = ({ current, onUpdate }: { current: number, onUpdate: (val: number) => void }) => (
  <div className="flex items-center gap-1">
    {[0, 25, 50, 75, 100].map(val => {
      const colorClass = getProgressColor(val);
      return (
        <button
          key={val}
          type="button"
          onClick={(e) => { e.stopPropagation(); onUpdate(val); }}
          className={`text-[9px] px-1.5 py-0.5 rounded border transition-all ${
            current === val 
              ? `${colorClass} border-transparent text-white font-bold shadow-lg shadow-black/20` 
              : 'bg-transparent border-white/10 text-gray-400 hover:border-white/30 hover:text-white'
          }`}
        >
          {val}%
        </button>
      );
    })}
  </div>
);

export default function CronogramaPage() {
  const { 
    scheduleItems, 
    addScheduleItem, 
    updateScheduleItem, 
    deleteScheduleItem, 
    projects, 
    users, 
    pendencies, 
    addPendency, 
    currentUser
  } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPendencyModalOpen, setIsPendencyModalOpen] = useState(false);
  const [selectedScheduleItemForPendency, setSelectedScheduleItemForPendency] = useState<ScheduleItem | null>(null);
  const [dependencySearchTerm, setDependencySearchTerm] = useState('');
  const [pendencyFormData, setPendencyFormData] = useState<Omit<Pendency, 'id'>>({
    title: '',
    description: '',
    projectId: '',
    stage: '',
    scheduleItemId: '',
    origin: 'cronograma',
    responsibleId: '',
    priority: 'media',
    deadline: '',
    status: 'aberta',
    createdAt: '',
  });

  const getPendencyStats = (itemId: string) => {
    const itemPendencies = pendencies.filter(p => p.scheduleItemId === itemId);
    const open = itemPendencies.filter(p => p.status === 'aberta').length;
    const inProgress = itemPendencies.filter(p => p.status === 'em_andamento').length;
    const resolved = itemPendencies.filter(p => p.status === 'resolvida').length;
    
    return { total: itemPendencies.length, open, inProgress, resolved };
  };

  const getPendencyIndicatorColor = (stats: { open: number, inProgress: number, resolved: number }) => {
    if (stats.open > 0) return 'text-red-500 bg-red-500/10 border-red-500/20';
    if (stats.inProgress > 0) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    if (stats.resolved > 0) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
  };

  const handleCreatePendency = (item: ScheduleItem) => {
    setSelectedScheduleItemForPendency(item);
    setPendencyFormData({
      title: `Pendência: ${item.title}`,
      description: '',
      projectId: item.projectId,
      stage: item.parentStepId ? scheduleItems.find(s => s.id === item.parentStepId)?.title || '' : item.title,
      scheduleItemId: item.id,
      origin: 'cronograma',
      responsibleId: item.responsibleId,
      priority: 'media',
      deadline: item.endDate,
      status: 'aberta',
      createdAt: new Date().toISOString(),
    });
    setIsPendencyModalOpen(true);
  };

  const handlePendencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addPendency({
        ...pendencyFormData,
        createdAt: new Date().toISOString(),
      });
      setIsPendencyModalOpen(false);
    } catch (error) {
      console.error('Error creating pendency:', error);
      alert('Erro ao criar pendência.');
    }
  };
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [filterProject, setFilterProject] = useState(projects[0]?.id || '');
  const [expandedSteps, setExpandedSteps] = useState<string[]>([]);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState<Omit<ScheduleItem, 'id'>>({
    projectId: filterProject,
    parentStepId: undefined,
    title: '',
    responsibleId: '',
    responsavelTipo: 'usuario',
    responsavelUserId: '',
    responsavelNome: '',
    startDate: '',
    endDate: '',
    progress: 0,
    weight: 1,
    complexity: 'media',
    status: 'pendente',
    dependsOnId: '',
    dependsOnIds: [],
    followScheduleOrder: false,
    workFront: 'Outros'
  });

  const handleOpenModal = (item?: ScheduleItem, parentId?: string) => {
    if (item) {
      setEditingItem(item);
      setFormData({ 
        ...item,
        responsavelTipo: item.responsavelTipo || 'usuario',
        responsavelUserId: item.responsavelUserId || item.responsibleId || '',
        responsavelNome: item.responsavelNome || (item.responsibleId ? users.find(u => u.id === item.responsibleId)?.name : '') || '',
        dependsOnIds: item.dependsOnIds || (item.dependsOnId ? [item.dependsOnId] : []),
        followScheduleOrder: item.followScheduleOrder || false,
        workFront: item.workFront || 'Outros'
      });
    } else {
      setEditingItem(null);
      setFormData({
        projectId: filterProject,
        parentStepId: parentId,
        title: '',
        responsibleId: '',
        responsavelTipo: 'usuario',
        responsavelUserId: '',
        responsavelNome: '',
        startDate: '',
        endDate: '',
        progress: 0,
        weight: parentId ? 2 : 10, // Default complexity weight 2 for sub-steps, 10% for main steps
        complexity: 'media',
        status: 'pendente',
        dependsOnId: '',
        dependsOnIds: [],
        followScheduleOrder: false,
        workFront: 'Outros'
      });
    }
    setIsModalOpen(true);
  };

  const projectSteps = useMemo(() => {
    const mainSteps = scheduleItems.filter(s => s.projectId === filterProject && !s.parentStepId);
    return mainSteps
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
      .map(step => ({
        ...step,
        subSteps: scheduleItems
          .filter(s => s.parentStepId === step.id)
          .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
      }));
  }, [scheduleItems, filterProject]);

  const allProjectItemsOrdered = useMemo(() => {
    const ordered: ScheduleItem[] = [];
    projectSteps.forEach(step => {
      ordered.push(step);
      step.subSteps.forEach(sub => {
        ordered.push(sub);
      });
    });
    return ordered;
  }, [projectSteps]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalData = { ...formData };
    
    // Apply "Follow Schedule Order" logic
    if (finalData.followScheduleOrder) {
      const currentIndex = allProjectItemsOrdered.findIndex(item => item.id === editingItem?.id);
      let previousItem: ScheduleItem | null = null;
      if (editingItem && currentIndex > 0) {
        previousItem = allProjectItemsOrdered[currentIndex - 1];
      } else if (!editingItem && allProjectItemsOrdered.length > 0) {
        previousItem = allProjectItemsOrdered[allProjectItemsOrdered.length - 1];
      }
      
      if (previousItem) {
        const currentIds = finalData.dependsOnIds || [];
        if (!currentIds.includes(previousItem.id)) {
          finalData.dependsOnIds = [...currentIds, previousItem.id];
        }
      }
    }

    if (finalData.responsavelTipo === 'usuario') {
      const user = users.find(u => u.id === finalData.responsavelUserId);
      finalData.responsavelNome = user ? user.name : '';
      finalData.responsibleId = finalData.responsavelUserId;
    } else {
      finalData.responsavelUserId = '';
      finalData.responsibleId = '';
    }

    if (editingItem) {
      updateScheduleItem(editingItem.id, finalData);
    } else {
      addScheduleItem(finalData);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteScheduleItem(itemToDelete);
      setItemToDelete(null);
    }
  };

  const toggleStep = (id: string) => {
    setExpandedSteps(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const totalMainWeight = useMemo(() => {
    return projectSteps.reduce((acc, step) => acc + step.weight, 0);
  }, [projectSteps]);

  const overallProgress = useMemo(() => {
    if (projectSteps.length === 0) return 0;
    
    // Calculate overall progress based on real weights of sub-steps (or main steps if no sub-steps)
    const projectItems = scheduleItems.filter(s => s.projectId === filterProject);
    let totalWeightedProgress = 0;
    
    // We only sum realWeight * progress for "leaf" items:
    // 1. Sub-steps
    // 2. Main steps that have NO sub-steps
    projectItems.forEach(item => {
      const isSubStep = !!item.parentStepId;
      const isMainStepWithoutSubSteps = !item.parentStepId && !projectItems.some(i => i.parentStepId === item.id);
      
      if ((isSubStep || isMainStepWithoutSubSteps) && item.realWeight && item.realWeight > 0) {
        totalWeightedProgress += (item.progress * (item.realWeight / 100));
      }
    });

    return Math.round(totalWeightedProgress);
  }, [scheduleItems, filterProject, projectSteps]);

  const getComplexityColor = (complexity?: Complexity) => {
    switch (complexity) {
      case 'alta': return 'text-red-400';
      case 'media': return 'text-yellow-400';
      case 'baixa': return 'text-emerald-400';
      default: return 'text-gray-400';
    }
  };

  const handleDateUpdate = (id: string, field: 'startDate' | 'endDate', value: string) => {
    return updateScheduleItem(id, { [field]: value });
  };

  const handleQuickProgress = (id: string, progress: number) => {
    updateScheduleItem(id, { progress });
  };

  const handleExportPdf = () => {
    const project = projects.find(p => p.id === filterProject);
    const projectName = project ? project.name : 'Todas as Obras';
    
    exportToPdf({
      title: 'Cronograma Executivo',
      projectName,
      userName: currentUser?.name,
      filename: `cronograma-${projectName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`,
      projectSteps,
      overallProgress
    });
  };

  const workFronts = ['Civil', 'Elétrica', 'Gesso', 'Hidráulica', 'Outros'];
  const workFrontSummary = workFronts.map(front => {
    const items = scheduleItems.filter(item => item.projectId === filterProject && item.workFront === front);
    if (items.length === 0) return null;

    const startDates = items.filter(i => i.startDate).map(i => new Date(i.startDate!));
    const endDates = items.filter(i => i.endDate).map(i => new Date(i.endDate!));

    if (startDates.length === 0 || endDates.length === 0) return null;

    const minStart = new Date(Math.min(...startDates.map(d => d.getTime())));
    const maxEnd = new Date(Math.max(...endDates.map(d => d.getTime())));
    
    // Calculate duration in days
    const duration = Math.ceil((maxEnd.getTime() - minStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Determine status
    let status: 'ok' | 'attention' | 'delayed' = 'ok';
    const today = new Date();
    const progress = items.reduce((acc, item) => acc + (item.progress || 0), 0) / items.length;

    if (maxEnd < today && progress < 100) {
      status = 'delayed';
    } else if (maxEnd.getTime() - today.getTime() < 3 * 24 * 60 * 60 * 1000 && progress < 100) {
      status = 'attention';
    }

    return {
      name: front,
      duration,
      startDate: minStart,
      endDate: maxEnd,
      status
    };
  }).filter(Boolean);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Cronograma Executivo</h1>
          <p className="text-gray-400 text-sm">Planejamento e controle físico da obra</p>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="bg-[#161B22] border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#F97316]"
          >
            <option value="">Selecione a Obra</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button 
            onClick={handleExportPdf}
            disabled={!filterProject}
            className="bg-[#161B22] hover:bg-white/5 border border-white/10 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={20} />
            Exportar PDF
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="bg-[#F97316] hover:bg-[#EA580C] text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-semibold"
          >
            <Plus size={20} />
            Nova Etapa Principal
          </button>
        </div>
      </div>

      {filterProject ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2 bg-[#161B22] p-6 rounded-2xl border border-white/10 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm font-semibold uppercase tracking-wider">Progresso Geral da Obra</span>
                  <span className="text-2xl font-bold text-white">{overallProgress}%</span>
                </div>
                <div className="w-full bg-[#0B0E14] h-3 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${getProgressColor(overallProgress)} transition-all duration-1000`} 
                    style={{ width: `${overallProgress}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            <div className={`p-6 rounded-2xl border flex items-center gap-4 ${totalMainWeight === 100 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
              <div className={`p-3 rounded-xl ${totalMainWeight === 100 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold">Soma dos Pesos</p>
                <p className={`text-xl font-bold ${totalMainWeight === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {totalMainWeight}% / 100%
                </p>
                {totalMainWeight !== 100 && (
                  <p className="text-[10px] text-amber-500/80 mt-1">Ajuste os pesos das etapas principais para totalizar 100%.</p>
                )}
              </div>
            </div>
          </div>

          {/* Resumo por Frente de Trabalho */}
          <div className="mb-6">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <Layout size={20} className="text-[#F97316]" />
              Resumo por Frente de Trabalho
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {workFrontSummary.map((front: any) => (
                <div key={front.name} className="bg-[#161B22] p-4 rounded-xl border border-white/10 hover:border-[#F97316]/30 transition-all group">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-white">{front.name}</span>
                    <div className={`w-2 h-2 rounded-full ${
                      front.status === 'delayed' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 
                      front.status === 'attention' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 
                      'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                    }`}></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-400 uppercase">Duração Total</span>
                      <span className="text-[#F97316] font-bold">{front.duration} dias</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-400 uppercase">Início</span>
                      <span className="text-white">{front.startDate.toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-400 uppercase">Término</span>
                      <span className="text-white">{front.endDate.toLocaleDateString('pt-BR')}</span>
                    </div>
                    {/* Visual Bar */}
                    <div className="pt-2">
                      <div className="w-full bg-[#0B0E14] h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-500 ${
                            front.status === 'delayed' ? 'bg-red-500' : 
                            front.status === 'attention' ? 'bg-amber-500' : 
                            'bg-emerald-500'
                          }`}
                          style={{ width: '100%' }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#161B22] rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0B0E14] text-gray-300 text-[13px] uppercase tracking-wider">
                    <th className="px-6 py-4 font-extrabold border-b border-white/5">Etapa / Subetapa</th>
                    <th className="px-4 py-4 font-extrabold border-b border-white/5">Responsável</th>
                    <th className="px-4 py-4 font-extrabold border-b border-white/5">Datas</th>
                    <th className="px-4 py-4 font-extrabold border-b border-white/5">Depende de</th>
                    <th className="px-4 py-4 font-extrabold border-b border-white/5">Complexidade</th>
                    <th className="px-4 py-4 font-extrabold border-b border-white/5">Peso Int.</th>
                    <th className="px-4 py-4 font-extrabold border-b border-white/5">Peso Real</th>
                    <th className="px-6 py-4 font-extrabold border-b border-white/5">Progresso / Atualização Rápida</th>
                    <th className="px-6 py-4 font-extrabold border-b border-white/5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {projectSteps.map((step) => (
                    <React.Fragment key={step.id}>
                      <tr className="hover:bg-white/5 transition-colors group bg-[#161B22]">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => toggleStep(step.id)}
                              className="text-gray-500 hover:text-white transition-colors"
                            >
                              {expandedSteps.includes(step.id) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                            </button>
                            <span className="text-blue-400 font-extrabold text-base tracking-wide">{step.title}</span>
                            {step.workFront && (
                              <span className="px-1.5 py-0.5 rounded bg-white/5 text-gray-500 text-[9px] font-bold uppercase border border-white/10">
                                {step.workFront}
                              </span>
                            )}
                            {(() => {
                              if (!step.endDate || step.progress === 100) return null;
                              const end = new Date(step.endDate);
                              const today = new Date();
                              const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                              
                              if (diffDays < 0) {
                                return (
                                  <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-500 text-[10px] font-bold uppercase ml-2">
                                    Atrasada
                                  </span>
                                );
                              }
                              if (diffDays <= 3) {
                                return (
                                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[10px] font-bold uppercase ml-2">
                                    Atenção
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            {(() => {
                              const stats = getPendencyStats(step.id);
                              if (stats.total > 0) {
                                return (
                                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ml-2 ${getPendencyIndicatorColor(stats)}`}>
                                    <AlertCircle size={12} />
                                    <span>{stats.open + stats.inProgress}</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-gray-300 text-xs">
                          {step.responsavelNome || (step.responsibleId ? users.find(u => u.id === step.responsibleId)?.name : '')}
                        </td>
                        <td className="px-4 py-5">
                          <div className="flex flex-col gap-1.5 text-[15px] text-gray-300 font-medium leading-relaxed">
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className="text-[#F97316] shrink-0" />
                              <InlineDateInput value={step.startDate || ''} onUpdate={(val) => handleDateUpdate(step.id, 'startDate', val)} />
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className="text-blue-400 shrink-0" />
                              <InlineDateInput value={step.endDate || ''} onUpdate={(val) => handleDateUpdate(step.id, 'endDate', val)} />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5 text-gray-500 text-sm">
                          {(() => {
                            const deps = step.dependsOnIds || (step.dependsOnId ? [step.dependsOnId] : []);
                            if (deps.length === 0) return '-';
                            return deps.map(id => {
                              const dep = scheduleItems.find(s => s.id === id);
                              return dep ? dep.title : 'Desconhecido';
                            }).join(', ');
                          })()}
                        </td>
                          <td className="px-4 py-5">
                            <span className={`text-xs font-bold uppercase tracking-wider ${getComplexityColor(step.complexity)}`}>
                              {step.complexity || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-5">
                            <span className="text-sm font-bold text-white bg-white/5 px-2.5 py-1.5 rounded">
                              {step.weight}%
                            </span>
                          </td>
                          <td className="px-4 py-5 text-gray-500 text-sm">-</td>
                          <td className="px-6 py-5">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 bg-[#0B0E14] h-4 rounded-full overflow-hidden min-w-[120px] shadow-inner">
                                <div className={`h-full ${getProgressColor(step.progress)} transition-all duration-500 rounded-full`} style={{ width: `${step.progress}%` }}></div>
                              </div>
                              <span className="text-sm text-white font-bold w-10 text-right">{step.progress}%</span>
                            </div>
                            <QuickProgress current={step.progress} onUpdate={(val) => handleQuickProgress(step.id, val)} />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleCreatePendency(step)}
                              className="p-2 text-gray-400 hover:text-amber-500 transition-colors" 
                              title="Criar Pendência"
                            >
                              <AlertCircle size={18} />
                            </button>
                            <button 
                              onClick={() => handleOpenModal(undefined, step.id)}
                              className="p-2 text-gray-400 hover:text-emerald-500 transition-colors" 
                              title="Adicionar Subetapa"
                            >
                              <Plus size={18} />
                            </button>
                            <button 
                              onClick={() => handleOpenModal(step)}
                              className="p-2 text-gray-400 hover:text-[#F97316] transition-colors"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleDelete(step.id)}
                              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedSteps.includes(step.id) && step.subSteps.map(sub => (
                        <tr key={sub.id} className="bg-[#0B0E14]/30 hover:bg-white/10 transition-colors group">
                          <td className="px-6 py-3 pl-14">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-300 text-[15px] font-medium">{sub.title}</span>
                              {sub.workFront && (
                                <span className="px-1.5 py-0.5 rounded bg-white/5 text-gray-500 text-[9px] font-bold uppercase border border-white/10">
                                  {sub.workFront}
                                </span>
                              )}
                              {(() => {
                                const stats = getPendencyStats(sub.id);
                                if (stats.total > 0) {
                                  return (
                                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ml-2 ${getPendencyIndicatorColor(stats)}`}>
                                      <AlertCircle size={12} />
                                      <span>{stats.open + stats.inProgress}</span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-[10px]">
                            {sub.responsavelNome || (sub.responsibleId ? users.find(u => u.id === sub.responsibleId)?.name : '')}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col gap-1 text-[11px] text-gray-400">
                              <div className="flex items-center gap-1">
                                <Calendar size={10} className="text-[#F97316] shrink-0" />
                                <InlineDateInput value={sub.startDate || ''} onUpdate={(val) => handleDateUpdate(sub.id, 'startDate', val)} />
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar size={10} className="text-blue-400 shrink-0" />
                                <InlineDateInput value={sub.endDate || ''} onUpdate={(val) => handleDateUpdate(sub.id, 'endDate', val)} />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-gray-400 text-[10px]">
                            {(() => {
                              const deps = sub.dependsOnIds || (sub.dependsOnId ? [sub.dependsOnId] : []);
                              if (deps.length === 0) return 'Nenhuma';
                              return deps.map(id => {
                                const dep = scheduleItems.find(s => s.id === id);
                                return dep ? dep.title : 'Desconhecido';
                              }).join(', ');
                            })()}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`text-xs font-bold uppercase tracking-wider ${getComplexityColor(sub.complexity)}`}>
                              {sub.complexity}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-gray-400 text-sm font-mono">{sub.weight}</td>
                          <td className="px-4 py-4">
                            <span className="text-sm text-emerald-400/80 font-mono font-medium">
                              {sub.realWeight?.toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-2.5">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 bg-[#0B0E14] h-3 rounded-full overflow-hidden min-w-[120px] shadow-inner">
                                  <div className={`h-full ${getProgressColor(sub.progress)} transition-all duration-500 rounded-full`} style={{ width: `${sub.progress}%` }}></div>
                                </div>
                                <span className="text-xs text-gray-300 font-bold w-10 text-right">{sub.progress}%</span>
                              </div>
                              <QuickProgress current={sub.progress} onUpdate={(val) => handleQuickProgress(sub.id, val)} />
                            </div>
                          </td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleCreatePendency(sub)}
                                className="p-1.5 text-gray-500 hover:text-amber-500 transition-colors"
                                title="Criar Pendência"
                              >
                                <AlertCircle size={14} />
                              </button>
                              <button 
                                onClick={() => handleOpenModal(sub)}
                                className="p-1.5 text-gray-500 hover:text-[#F97316] transition-colors"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => handleDelete(sub.id)}
                                className="p-1.5 text-gray-500 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-20 bg-[#161B22] rounded-2xl border border-dashed border-white/10">
          <p className="text-gray-500">Selecione uma obra para visualizar o cronograma.</p>
        </div>
      )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingItem ? 'Editar Etapa' : (formData.parentStepId ? 'Nova Subetapa' : 'Nova Etapa Principal')}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-gray-400 font-semibold">Título *</label>
            <input 
              required
              type="text" 
              placeholder="Ex: Infraestrutura Elétrica"
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316] transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-semibold">Tipo de Responsável *</label>
              <div className="flex bg-[#0B0E14] rounded-lg p-1 border border-white/10">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, responsavelTipo: 'usuario' })}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                    formData.responsavelTipo === 'usuario' 
                      ? 'bg-[#161B22] text-white shadow' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Usuário do Sistema
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, responsavelTipo: 'manual' })}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                    formData.responsavelTipo === 'manual' 
                      ? 'bg-[#161B22] text-white shadow' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  Nome Manual
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-semibold">Responsável *</label>
              {formData.responsavelTipo === 'usuario' ? (
                <select 
                  required
                  value={formData.responsavelUserId || ''}
                  onChange={(e) => setFormData({ ...formData, responsavelUserId: e.target.value })}
                  className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316] transition-colors"
                >
                  <option value="">Selecione o responsável</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              ) : (
                <input 
                  required
                  type="text" 
                  placeholder="Ex: Equipe Elétrica"
                  value={formData.responsavelNome || ''}
                  onChange={(e) => setFormData({ ...formData, responsavelNome: e.target.value })}
                  className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316] transition-colors"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-semibold">Status *</label>
              <select 
                required
                value={formData.status || 'pendente'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316] transition-colors"
              >
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="concluido">Concluído</option>
                <option value="atrasado">Atrasado</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-semibold">Frente de Trabalho *</label>
              <select 
                required
                value={formData.workFront || 'Outros'}
                onChange={(e) => setFormData({ ...formData, workFront: e.target.value as any })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316] transition-colors"
              >
                <option value="Civil">Civil</option>
                <option value="Elétrica">Elétrica</option>
                <option value="Gesso">Gesso</option>
                <option value="Hidráulica">Hidráulica</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-semibold">Data Início *</label>
              <input 
                required
                type="date" 
                value={formData.startDate ? formData.startDate.split('T')[0] : ''}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316] transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-semibold">Data Fim *</label>
              <input 
                required
                type="date" 
                value={formData.endDate ? formData.endDate.split('T')[0] : ''}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316] transition-colors"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox"
                id="followScheduleOrder"
                checked={formData.followScheduleOrder || false}
                onChange={(e) => setFormData({ ...formData, followScheduleOrder: e.target.checked })}
                className="w-4 h-4 rounded border-white/10 bg-[#0B0E14] text-[#F97316] focus:ring-[#F97316]"
              />
              <label htmlFor="followScheduleOrder" className="text-sm text-gray-300 font-semibold cursor-pointer">
                Seguir ordem do cronograma (depende do item anterior)
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-semibold">Depende de (Múltiplos)</label>
              <div className="space-y-2">
                <input 
                  type="text"
                  placeholder="Buscar atividade..."
                  className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-[#F97316]"
                  value={dependencySearchTerm}
                  onChange={(e) => setDependencySearchTerm(e.target.value)}
                />
                <div className="max-h-40 overflow-y-auto border border-white/5 rounded-lg bg-[#0B0E14]/50 p-2 space-y-1">
                  {allProjectItemsOrdered
                    .filter(item => 
                      item.id !== editingItem?.id && 
                      item.title.toLowerCase().includes(dependencySearchTerm.toLowerCase())
                    )
                    .map(item => {
                      const isSelected = (formData.dependsOnIds || []).includes(item.id);
                      const parent = item.parentStepId ? scheduleItems.find(s => s.id === item.parentStepId) : null;
                      
                      return (
                        <div 
                          key={item.id}
                          onClick={() => {
                            const current = formData.dependsOnIds || [];
                            const next = isSelected 
                              ? current.filter(id => id !== item.id)
                              : [...current, item.id];
                            setFormData({ ...formData, dependsOnIds: next });
                          }}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#F97316]/20 border border-[#F97316]/30' : 'hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isSelected ? 'bg-[#F97316] border-[#F97316]' : 'border-white/20'
                          }`}>
                            {isSelected && <Plus size={12} className="text-white" />}
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-xs ${isSelected ? 'text-white font-bold' : 'text-gray-300'}`}>
                              {item.title}
                            </span>
                            {parent && (
                              <span className="text-[10px] text-gray-500 italic">
                                Etapa: {parent.title}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400 font-semibold">Progresso (%) *</label>
              <input 
                required
                type="number" 
                min="0"
                max="100"
                value={formData.progress || 0}
                onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316] transition-colors"
              />
            </div>
            {!formData.parentStepId ? (
              <div className="space-y-2">
                <label className="text-sm text-gray-400 font-semibold">Peso da Etapa no Total (%) *</label>
                <input 
                  required
                  type="number" 
                  min="1"
                  max="100"
                  value={formData.weight || 1}
                  onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
                  className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316] transition-colors"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm text-gray-400 font-semibold">Complexidade *</label>
                <select 
                  required
                  value={formData.complexity || 'media'}
                  onChange={(e) => {
                    const complexity = e.target.value as Complexity;
                    const weight = complexity === 'alta' ? 3 : (complexity === 'media' ? 2 : 1);
                    setFormData({ ...formData, complexity, weight });
                  }}
                  className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316] transition-colors"
                >
                  <option value="baixa">Baixa (Peso 1)</option>
                  <option value="media">Média (Peso 2)</option>
                  <option value="alta">Alta (Peso 3)</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="bg-[#F97316] hover:bg-[#EA580C] text-white px-6 py-2 rounded-lg font-bold transition-colors shadow-lg shadow-orange-500/20"
            >
              {editingItem ? 'Atualizar Etapa' : 'Salvar Etapa'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmDelete}
        title="Excluir Etapa"
        message="Tem certeza que deseja excluir esta etapa? Esta ação não pode ser desfeita."
      />

      <Modal 
        isOpen={isPendencyModalOpen} 
        onClose={() => setIsPendencyModalOpen(false)} 
        title="Nova Pendência do Cronograma"
      >
        <form onSubmit={handlePendencySubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Título da Pendência *</label>
            <input 
              required
              type="text" 
              value={pendencyFormData.title || ''}
              onChange={(e) => setPendencyFormData({ ...pendencyFormData, title: e.target.value })}
              className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Descrição</label>
            <textarea 
              rows={3}
              value={pendencyFormData.description || ''}
              onChange={(e) => setPendencyFormData({ ...pendencyFormData, description: e.target.value })}
              className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Responsável *</label>
              <select 
                required
                value={pendencyFormData.responsibleId || ''}
                onChange={(e) => setPendencyFormData({ ...pendencyFormData, responsibleId: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316]"
              >
                <option value="">Selecione o responsável</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Prioridade *</label>
              <select 
                required
                value={pendencyFormData.priority || 'media'}
                onChange={(e) => setPendencyFormData({ ...pendencyFormData, priority: e.target.value as any })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316]"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Prazo *</label>
              <input 
                required
                type="date" 
                value={pendencyFormData.deadline || ''}
                onChange={(e) => setPendencyFormData({ ...pendencyFormData, deadline: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Status *</label>
              <select 
                required
                value={pendencyFormData.status || 'aberta'}
                onChange={(e) => setPendencyFormData({ ...pendencyFormData, status: e.target.value as any })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316]"
              >
                <option value="aberta">Aberta</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="resolvida">Resolvida</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setIsPendencyModalOpen(false)}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="bg-[#F97316] hover:bg-[#EA580C] text-white px-6 py-2 rounded-lg font-bold transition-colors shadow-lg shadow-orange-500/20"
            >
              Criar Pendência
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
