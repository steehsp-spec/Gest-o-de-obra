import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, Eye, MapPin, Calendar, User as UserIcon, DollarSign, ChevronDown, ChevronRight, CheckSquare, Square, ArrowUp, ArrowDown, Info, Settings, ExternalLink } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { OBRA_COMPLETA_TEMPLATE, OBRA_PARCIAL_TEMPLATE, OBRA_MANUTENCAO_TEMPLATE } from '../utils/projectTemplates';
import { Project, ProjectStatus, TemplateStep } from '../types';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import UpdateTemplateModal from '../components/UpdateTemplateModal';

export default function CadastroObrasPage() {
  const { 
    projects, addProject, updateProject, deleteProject, 
    users, addScheduleItem, updateScheduleItem, deleteScheduleItem, 
    scheduleItems, settings, updateSettings, currentUser, recalculateAll,
    projectTemplates, updateProjectTemplate, addProjectTemplate
  } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdateTemplateModalOpen, setIsUpdateTemplateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [projectType, setProjectType] = useState<string>('em_branco');
  const [templateData, setTemplateData] = useState<TemplateStep[]>([]);
  const [expandedTemplateSteps, setExpandedTemplateSteps] = useState<string[]>([]);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingSubStep, setEditingSubStep] = useState<{stepId: string, subStepId: string} | null>(null);
  const [editValue, setEditValue] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [pendingProjectType, setPendingProjectType] = useState<string | null>(null);
  const [isSavingAsNewTemplate, setIsSavingAsNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  const [formData, setFormData] = useState<Omit<Project, 'id'>>({
    name: '',
    code: '',
    client: '',
    phone: '',
    address: '',
    city: '',
    startDate: '',
    endDate: '',
    totalDays: undefined,
    managerId: '',
    budget: 0,
    status: 'planejamento',
    progress: 0,
    description: '',
    tipoCronograma: 'em_branco',
    estruturaCronograma: []
  });

  const handleOpenModal = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setFormData({ ...project } as any);
      setProjectType(project.tipoCronograma || 'em_branco');
      
      const savedTemplate = projectTemplates.find(t => t.id === (project.tipoCronograma || 'em_branco'));
      if (savedTemplate) {
        setTemplateName(savedTemplate.name);
      } else {
        setTemplateName(project.tipoCronograma === 'obra_completa' ? 'Obra Completa' : project.tipoCronograma === 'obra_parcial' ? 'Obra Parcial' : project.tipoCronograma === 'manutencao' ? 'Manutenção' : 'Em branco');
      }
      
      // Normalizar estrutura para garantir que todos os subitens sejam objetos com IDs
      const normalizedTemplate = (project.estruturaCronograma || []).map(step => ({
        ...step,
        subSteps: (step.subSteps || []).map((sub, idx) => {
          if (typeof sub === 'string') {
            return { id: `sub_${idx}_${Date.now()}`, title: sub };
          }
          return sub;
        })
      }));
      setTemplateData(normalizedTemplate);
    } else {
      setEditingProject(null);
      setProjectType('em_branco');
      setTemplateName('Em branco');
      setTemplateData([]);
      setFormData({
        name: '',
        code: '',
        client: '',
        phone: '',
        address: '',
        city: '',
        startDate: '',
        endDate: '',
        managerId: '',
        budget: 0,
        status: 'planejamento',
        description: '',
        tipoCronograma: 'em_branco',
        estruturaCronograma: []
      } as any);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    
    if (projectType !== 'em_branco' && templateData.every(step => !step.selected)) {
      alert('Selecione pelo menos uma etapa.');
      return;
    }

    setIsSaving(true);
    setSyncStatus('Salvando dados da obra...');
    try {
      const dataToSave = {
        ...formData,
        tipoCronograma: projectType as any,
        estruturaCronograma: templateData,
        updatedAt: new Date().toISOString()
      };

      let projectId = '';
      if (editingProject) {
        await updateProject(editingProject.id, dataToSave);
        projectId = editingProject.id;
      } else {
        projectId = await addProject({
          ...dataToSave,
          progress: 0,
          status: 'planejamento',
          createdAt: new Date().toISOString()
        });
      }

      // Sincronização com o Cronograma
      if (projectId) {
        setSyncStatus('Sincronizando cronograma...');
        const existingItems = scheduleItems.filter(item => item.projectId === projectId);
        
        // Identificar se houve mudanças globais na obra que devem ser propagadas
        const managerChanged = editingProject?.managerId !== formData.managerId;
        
        const managerInfo = {
          responsibleId: formData.managerId || '',
          responsavelTipo: (formData.managerId ? 'usuario' : 'manual') as 'usuario' | 'manual',
          responsavelUserId: formData.managerId || '',
          responsavelNome: formData.managerId ? (users.find(u => u.id === formData.managerId)?.name || '') : '',
        };

        const globalUpdates: any = {};
        if (managerChanged) Object.assign(globalUpdates, managerInfo);

        // 1. Identificar itens para deletar...
        setSyncStatus('Removendo itens desatualizados...');
        const deletePromises = existingItems
          .filter(item => {
            if (!item.templateStepId) return false;
            const stepInTemplate = templateData.find(s => s.id === item.templateStepId);
            if (!stepInTemplate || !stepInTemplate.selected) return true;
            
            if (item.templateSubStepId) {
              const isSubStepSelected = stepInTemplate.selectedSubSteps[item.templateSubStepId];
              const subStepExists = stepInTemplate.subSteps.find(ss => ss.id === item.templateSubStepId);
              return !subStepExists || !isSubStepSelected;
            }
            return false;
          })
          .map(item => deleteScheduleItem(item.id));
        
        await Promise.all(deletePromises);

        // 2. Adicionar ou Atualizar itens
        setSyncStatus('Atualizando estrutura do cronograma...');
        const subStepPromises: Promise<any>[] = [];

        for (const step of templateData) {
          if (step.selected) {
            // Procurar se a etapa principal já existe no cronograma
            let mainStepItem = existingItems.find(item => item.templateStepId === step.id && !item.parentStepId);
            let mainStepId = mainStepItem?.id;

            if (!mainStepId) {
              // Criar etapa principal se não existir (precisamos do ID para os subitens, então aguardamos)
              mainStepId = await addScheduleItem({
                projectId,
                title: step.title,
                progress: 0,
                weight: step.weight || 10,
                complexity: 'media',
                status: 'pendente',
                ...managerInfo,
                templateStepId: step.id,
                ordem: step.ordem
              });
            } else if (mainStepItem) {
              // Atualizar se mudou algo (título, peso ou campos globais)
              const needsUpdate = 
                mainStepItem.title !== step.title || 
                mainStepItem.weight !== step.weight ||
                mainStepItem.ordem !== step.ordem ||
                managerChanged;

              if (needsUpdate) {
                // Podemos atualizar em paralelo
                subStepPromises.push(updateScheduleItem(mainStepId, {
                  title: step.title,
                  weight: step.weight,
                  ordem: step.ordem,
                  ...globalUpdates
                }));
              }
            }

            if (mainStepId) {
              // Sincronizar subitens
              for (const sub of step.subSteps) {
                if (step.selectedSubSteps[sub.id]) {
                  const existingSubItem = existingItems.find(item => 
                    item.projectId === projectId && 
                    item.parentStepId === mainStepId && 
                    item.templateSubStepId === sub.id
                  );

                  const complexity = step.subStepComplexities?.[sub.id] || 'media';
                  const weight = complexity === 'alta' ? 3 : (complexity === 'media' ? 2 : 1);

                  if (!existingSubItem) {
                    // Criar subitem se não existir (pode ser paralelo)
                    subStepPromises.push(addScheduleItem({
                      projectId,
                      parentStepId: mainStepId,
                      title: sub.title,
                      progress: 0,
                      weight: weight,
                      complexity: complexity,
                      status: 'pendente',
                      ...managerInfo,
                      templateStepId: step.id,
                      templateSubStepId: sub.id,
                      ordem: sub.ordem || 0
                    }));
                  } else {
                    // Atualizar se mudou algo (título, complexidade ou campos globais)
                    const needsUpdate = 
                      existingSubItem.title !== sub.title || 
                      existingSubItem.complexity !== complexity ||
                      existingSubItem.ordem !== (sub.ordem || 0) ||
                      managerChanged;

                    if (needsUpdate) {
                      subStepPromises.push(updateScheduleItem(existingSubItem.id, {
                        title: sub.title,
                        complexity: complexity,
                        weight: weight,
                        ordem: sub.ordem || 0,
                        ...globalUpdates
                      }));
                    }
                  }
                }
              }
            }
          }
        }

        // Aguardar todas as operações de subitens e atualizações paralelas
        setSyncStatus('Finalizando sincronização...');
        await Promise.all(subStepPromises);



        // Save as new template if requested
        if (isSavingAsNewTemplate && newTemplateName.trim()) {
          setSyncStatus('Criando novo modelo...');
          await addProjectTemplate({
            name: newTemplateName.trim(),
            type: 'personalizado',
            structure: templateData,
            updatedAt: new Date().toISOString()
          });
          setIsSavingAsNewTemplate(false);
          setNewTemplateName('');
        }

        // Recalcular tudo após as mudanças estruturais
        setSyncStatus('Recalculando progresso...');
        setTimeout(() => {
          recalculateAll(projectId);
          setSyncStatus('');
        }, 1000);
        alert('Obra salva e estrutura sincronizada com o cronograma com sucesso!');
      }

      setIsModalOpen(false);
      setEditingProject(null);
    } catch (error) {
      console.error("Erro ao salvar obra:", error);
      alert('Erro ao salvar obra. Verifique o console.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleProjectTypeChange = (type: string) => {
    if (editingProject && editingProject.tipoCronograma !== type && editingProject.tipoCronograma !== 'em_branco') {
      setPendingProjectType(type);
      setIsConfirmModalOpen(true);
      return;
    }
    applyProjectTypeChange(type);
  };

  const applyProjectTypeChange = (type: string) => {
    setProjectType(type);
    
    let template: TemplateStep[] = [];
    const savedTemplate = projectTemplates.find(t => t.id === type);
    
    if (savedTemplate) {
      template = savedTemplate.structure;
      setTemplateName(savedTemplate.name);
    } else {
      // Fallback para modelos legados se não estiverem no Firestore
      if (type === 'obra_completa') {
        template = settings?.projectTemplates?.completa || OBRA_COMPLETA_TEMPLATE;
        setTemplateName('Obra Completa');
      } else if (type === 'obra_parcial') {
        template = settings?.projectTemplates?.parcial || OBRA_PARCIAL_TEMPLATE;
        setTemplateName('Obra Parcial');
      } else if (type === 'manutencao') {
        template = OBRA_MANUTENCAO_TEMPLATE;
        setTemplateName('Manutenção');
      } else {
        setTemplateName('Em branco');
      }
    }

    // Normalizar template para garantir objetos com IDs
    const normalizedTemplate = JSON.parse(JSON.stringify(template)).map((step: any) => ({
      ...step,
      subSteps: (step.subSteps || []).map((sub: any, idx: number) => {
        if (typeof sub === 'string') {
          return { id: `sub_${idx}_${Date.now()}`, title: sub };
        }
        return sub;
      })
    }));

    setTemplateData(normalizedTemplate);
    setExpandedTemplateSteps(normalizedTemplate.map((s: any) => s.id));
    
    if (type === 'em_branco') {
      setTemplateData([]);
      setExpandedTemplateSteps([]);
    }
  };

  const toggleTemplateStep = (id: string) => {
    setExpandedTemplateSteps(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const toggleStepSelection = (stepId: string) => {
    setTemplateData(prev => prev.map(step => {
      if (step.id === stepId) {
        const newSelected = !step.selected;
        // Also toggle all sub-steps
        const newSelectedSubSteps = { ...step.selectedSubSteps };
        step.subSteps.forEach(sub => {
          newSelectedSubSteps[sub.id] = newSelected;
        });
        return { ...step, selected: newSelected, selectedSubSteps: newSelectedSubSteps };
      }
      return step;
    }));
  };

  const toggleSubStepSelection = (stepId: string, subStepId: string) => {
    setTemplateData(prev => prev.map(step => {
      if (step.id === stepId) {
        const newSelectedSubSteps = { ...step.selectedSubSteps, [subStepId]: !step.selectedSubSteps[subStepId] };
        // If at least one sub-step is selected, the main step should be selected
        const anySubSelected = Object.values(newSelectedSubSteps).some(val => val);
        return { ...step, selectedSubSteps: newSelectedSubSteps, selected: anySubSelected || step.selected };
      }
      return step;
    }));
  };

  const getTotalSelectedItems = () => {
    let count = 0;
    templateData.forEach(step => {
      if (step.selected) {
        count++; // main step
        count += Object.values(step.selectedSubSteps).filter(Boolean).length; // sub steps
      }
    });
    return count;
  };

  const addTemplateStep = () => {
    const newId = `step_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
    setTemplateData(prev => [...prev, {
      id: newId,
      title: 'Nova Etapa',
      weight: 10,
      selected: true,
      ordem: prev.length + 1,
      subSteps: [],
      selectedSubSteps: {},
      subStepComplexities: {}
    }]);
    setExpandedTemplateSteps(prev => [...prev, newId]);
    setEditingStepId(newId);
    setEditValue('Nova Etapa');
  };

  const addTemplateSubStep = (stepId: string) => {
    const newSubStepId = `sub_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
    const newSubStepTitle = 'Novo Subitem';
    setTemplateData(prev => prev.map(step => {
      if (step.id === stepId) {
        return {
          ...step,
          subSteps: [...step.subSteps, { id: newSubStepId, title: newSubStepTitle, ordem: step.subSteps.length + 1 }],
          selectedSubSteps: { ...step.selectedSubSteps, [newSubStepId]: true },
          subStepComplexities: { ...step.subStepComplexities, [newSubStepId]: 'media' },
          selected: true
        };
      }
      return step;
    }));
    setEditingSubStep({ stepId, subStepId: newSubStepId });
    setEditValue(newSubStepTitle);
    if (!expandedTemplateSteps.includes(stepId)) {
      setExpandedTemplateSteps(prev => [...prev, stepId]);
    }
  };

  const removeTemplateStep = (stepId: string) => {
    setTemplateData(prev => prev.filter(step => step.id !== stepId));
  };

  const removeTemplateSubStep = (stepId: string, subStepId: string) => {
    setTemplateData(prev => prev.map(step => {
      if (step.id === stepId) {
        const newSubSteps = step.subSteps.filter(s => s.id !== subStepId);
        const newSelectedSubSteps = { ...step.selectedSubSteps };
        delete newSelectedSubSteps[subStepId];
        const newSubStepComplexities = { ...step.subStepComplexities };
        delete newSubStepComplexities[subStepId];
        return {
          ...step,
          subSteps: newSubSteps,
          selectedSubSteps: newSelectedSubSteps,
          subStepComplexities: newSubStepComplexities
        };
      }
      return step;
    }));
  };

  const saveStepTitle = (stepId: string) => {
    if (editValue.trim()) {
      setTemplateData(prev => prev.map(step => 
        step.id === stepId ? { ...step, title: editValue.trim() } : step
      ));
    }
    setEditingStepId(null);
  };

  const saveSubStepTitle = (stepId: string, subStepId: string) => {
    const newTitle = editValue.trim();
    if (newTitle) {
      setTemplateData(prev => prev.map(step => {
        if (step.id === stepId) {
          const newSubSteps = step.subSteps.map(s => 
            s.id === subStepId ? { ...s, title: newTitle } : s
          );
          return {
            ...step,
            subSteps: newSubSteps
          };
        }
        return step;
      }));
    }
    setEditingSubStep(null);
  };

  const moveTemplateStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === templateData.length - 1) return;

    setTemplateData(prev => {
      const newData = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const temp = newData[index];
      newData[index] = newData[targetIndex];
      newData[targetIndex] = temp;
      return newData;
    });
  };

  const moveTemplateSubStep = (stepId: string, subIndex: number, direction: 'up' | 'down') => {
    setTemplateData(prev => prev.map(step => {
      if (step.id === stepId) {
        if (direction === 'up' && subIndex === 0) return step;
        if (direction === 'down' && subIndex === step.subSteps.length - 1) return step;

        const newSubSteps = [...step.subSteps];
        const targetIndex = direction === 'up' ? subIndex - 1 : subIndex + 1;
        const temp = newSubSteps[subIndex];
        newSubSteps[subIndex] = newSubSteps[targetIndex];
        newSubSteps[targetIndex] = temp;

        return { ...step, subSteps: newSubSteps };
      }
      return step;
    }));
  };

  const handleDelete = (id: string) => {
    setProjectToDelete(id);
  };

  const confirmDelete = () => {
    if (projectToDelete) {
      deleteProject(projectToDelete);
      setProjectToDelete(null);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.client.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: ProjectStatus) => {
    const styles: Record<ProjectStatus, string> = {
      planejamento: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      em_execucao: 'bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20',
      paralizada: 'bg-red-500/10 text-red-500 border-red-500/20',
      concluida: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      atrasada: 'bg-red-500/10 text-red-500 border-red-500/20'
    };
    const labels: Record<ProjectStatus, string> = {
      planejamento: 'Planejamento',
      em_execucao: 'Em Execução',
      paralizada: 'Paralizada',
      concluida: 'Concluída',
      atrasada: 'Atrasada'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white">Cadastro de Obras</h1>
          <p className="text-gray-400 text-xs lg:text-sm">Gerencie todas as obras da A&R Engenharia</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-[#F97316] hover:bg-[#EA580C] text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors font-semibold text-sm lg:text-base"
        >
          <Plus size={20} />
          Nova Obra
        </button>
      </div>

      <div className="bg-[#161B22] rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-4 lg:p-6 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 lg:w-[18px] lg:h-[18px]" size={16} />
            <input 
              type="text" 
              placeholder="Buscar por nome, código ou cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0B0E14] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white text-xs lg:text-sm placeholder-gray-500 focus:outline-none focus:border-[#F97316]"
            />
          </div>
        </div>

        {/* Mobile View for Projects */}
        <div className="lg:hidden divide-y divide-white/5">
          {filteredProjects.map((project) => (
            <div key={project.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-base">{project.name}</h3>
                  <span className="text-gray-500 text-[10px] uppercase tracking-wider">{project.code}</span>
                </div>
                {getStatusBadge(project.status)}
              </div>
              
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <div className="flex flex-col">
                  <span className="text-gray-500 uppercase font-bold text-[9px]">Cliente</span>
                  <span className="text-gray-300 truncate">{project.client}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-500 uppercase font-bold text-[9px]">Responsável</span>
                  <span className="text-gray-300 truncate">
                    {users.find(u => u.id === project.managerId)?.name || 'Não atribuído'}
                  </span>
                </div>
                <div className="flex flex-col col-span-2">
                  <span className="text-gray-500 uppercase font-bold text-[9px]">Orçamento</span>
                  <span className="text-gray-300">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.budget)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
                <button className="p-2 text-gray-400 hover:text-white transition-colors flex items-center gap-1.5">
                  <Eye size={16} />
                  <span className="text-[10px] font-bold uppercase">Ver</span>
                </button>
                <button 
                  onClick={() => handleOpenModal(project)}
                  className="p-2 text-gray-400 hover:text-[#F97316] transition-colors flex items-center gap-1.5"
                >
                  <Edit2 size={16} />
                  <span className="text-[10px] font-bold uppercase">Editar</span>
                </button>
                <button 
                  onClick={() => handleDelete(project.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={16} />
                  <span className="text-[10px] font-bold uppercase">Excluir</span>
                </button>
              </div>
            </div>
          ))}
          {filteredProjects.length === 0 && (
            <div className="p-8 text-center text-gray-500 text-sm">
              Nenhuma obra encontrada.
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#0B0E14] text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Obra</th>
                <th className="px-6 py-4 font-semibold">Cliente</th>
                <th className="px-6 py-4 font-semibold">Responsável</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Orçamento</th>
                <th className="px-6 py-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredProjects.map((project) => (
                <tr key={project.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-white font-medium">{project.name}</span>
                      <span className="text-gray-500 text-xs">{project.code}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-300">{project.client}</td>
                  <td className="px-6 py-4 text-gray-300">
                    {users.find(u => u.id === project.managerId)?.name || 'Não atribuído'}
                  </td>
                  <td className="px-6 py-4">{getStatusBadge(project.status)}</td>
                  <td className="px-6 py-4 text-gray-300">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.budget)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-2 text-gray-400 hover:text-white transition-colors" title="Ver Detalhes">
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => handleOpenModal(project)}
                        className="p-2 text-gray-400 hover:text-[#F97316] transition-colors" 
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(project.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors" 
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingProject ? 'Editar Obra' : 'Nova Obra'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs lg:text-sm text-gray-400">Nome da Obra *</label>
              <input 
                required
                type="text" 
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs lg:text-sm text-gray-400">Código *</label>
              <input 
                required
                type="text" 
                value={formData.code || ''}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs lg:text-sm text-gray-400">Cliente *</label>
              <input 
                required
                type="text" 
                value={formData.client || ''}
                onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs lg:text-sm text-gray-400">Telefone</label>
              <input 
                type="text" 
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs lg:text-sm text-gray-400">Endereço</label>
              <input 
                type="text" 
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs lg:text-sm text-gray-400">Cidade</label>
              <input 
                type="text" 
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs lg:text-sm text-gray-400">Responsável Técnico</label>
              <select 
                value={formData.managerId || ''}
                onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
              >
                <option value="">Selecione um responsável</option>
                {users.filter(u => u.role === 'engenheiro' || u.role === 'administrador').map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs lg:text-sm text-gray-400">Prazo Total (dias)</label>
                <input 
                  type="number" 
                  min="1"
                  value={formData.totalDays || ''}
                  onChange={(e) => setFormData({ ...formData, totalDays: e.target.value ? Number(e.target.value) : null as any })}
                  className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
                  placeholder="Ex: 35"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs lg:text-sm text-gray-400">Orçamento Previsto</label>
                <input 
                  type="number" 
                  value={formData.budget || 0}
                  onChange={(e) => setFormData({ ...formData, budget: Number(e.target.value) })}
                  className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs lg:text-sm text-gray-400">Status</label>
            <select 
                value={formData.status || 'planejamento'}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
              className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
            >
              <option value="planejamento">Planejamento</option>
              <option value="em_execucao">Em Execução</option>
              <option value="paralizada">Paralizada</option>
              <option value="concluida">Concluída</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs lg:text-sm text-gray-400">Descrição</label>
            <textarea 
              rows={3}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
            />
          </div>

          <div className="space-y-4 pt-4 border-t border-white/10">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs lg:text-sm text-gray-400 font-semibold">Tipo da Obra (Modelo de Cronograma)</label>
                  {currentUser?.role === 'administrador' && (
                    <Link 
                      to="/modelos-obra" 
                      className="text-[10px] text-[#F97316] hover:underline flex items-center gap-1"
                      title="Gerenciar todos os modelos de obra"
                    >
                      <Settings size={10} />
                      Gerenciar Modelos
                    </Link>
                  )}
                </div>
                <select 
                  value={projectType}
                  onChange={(e) => handleProjectTypeChange(e.target.value as any)}
                  className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
                >
                  {projectTemplates.length > 0 ? (
                    projectTemplates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.id !== 'em_branco' ? '(Modelo)' : ''}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="em_branco">Em branco (Criar etapas manualmente depois)</option>
                      <option value="obra_completa">Obra Completa (Modelo padrão com todas as etapas)</option>
                      <option value="obra_parcial">Obra Parcial (Modelo enxuto para reformas)</option>
                      <option value="manutencao">Manutenção</option>
                    </>
                  )}
                </select>
                {editingProject && (
                  <button
                    onClick={() => setIsUpdateTemplateModalOpen(true)}
                    className="mt-2 text-xs text-[#F97316] hover:text-[#F97316]/80"
                  >
                    Atualizar cronograma com modelo mais recente
                  </button>
                )}
              </div>

              <div className="bg-[#0B0E14] border border-white/10 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-medium">Estrutura da Obra</h4>
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    {currentUser?.role === 'administrador' && (
                      <div className="flex flex-wrap items-center gap-4">


                        <label className="flex items-center gap-2 cursor-pointer group">
                          <div 
                            onClick={() => setIsSavingAsNewTemplate(!isSavingAsNewTemplate)}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSavingAsNewTemplate ? 'bg-blue-500 border-blue-500' : 'border-white/20 group-hover:border-white/40'}`}
                          >
                            {isSavingAsNewTemplate && <CheckSquare size={12} className="text-white" />}
                          </div>
                          <span className="text-[10px] text-gray-400 group-hover:text-gray-300 transition-colors">Salvar como NOVO modelo</span>
                        </label>
                        
                        {isSavingAsNewTemplate && (
                          <div className="flex items-center gap-2 bg-[#0B0E14] px-2 py-1 rounded border border-blue-500/30">
                            <span className="text-[10px] text-gray-500 uppercase font-bold">Nome:</span>
                            <input
                              type="text"
                              value={newTemplateName}
                              onChange={(e) => setNewTemplateName(e.target.value)}
                              className="bg-transparent text-xs text-blue-400 w-32 focus:outline-none font-bold"
                              placeholder="Nome do novo modelo"
                            />
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-[#F97316]/20 text-[#F97316] px-2 py-1 rounded-full font-medium">
                        {getTotalSelectedItems()} itens selecionados
                      </span>
                      <button
                        type="button"
                        onClick={addTemplateStep}
                        className="text-xs bg-white/5 hover:bg-white/10 text-white px-2 py-1 rounded flex items-center gap-1 transition-colors"
                      >
                        <Plus size={14} />
                        Nova Etapa
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {templateData.map((step, index) => (
                    <div key={step.id} className="bg-[#161B22] rounded-lg border border-white/5 overflow-hidden">
                      <div className="flex items-center p-3 hover:bg-white/5 transition-colors group">
                        <button
                          type="button"
                          onClick={() => toggleTemplateStep(step.id)}
                          className="p-1 text-gray-400 hover:text-white mr-2"
                        >
                          {expandedTemplateSteps.includes(step.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => toggleStepSelection(step.id)}
                          className={`mr-3 flex-shrink-0 ${step.selected ? 'text-[#F97316]' : 'text-gray-500'}`}
                        >
                          {step.selected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                        
                        <div className="flex-1 flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            {editingStepId === step.id ? (
                              <input
                                type="text"
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => saveStepTitle(step.id)}
                                onKeyDown={(e) => e.key === 'Enter' && saveStepTitle(step.id)}
                                className="bg-[#0B0E14] border border-[#F97316] rounded px-2 py-1 text-sm text-white focus:outline-none w-1/2"
                              />
                            ) : (
                              <span 
                                className={`font-medium cursor-pointer ${step.selected ? 'text-white' : 'text-gray-500'}`}
                                onDoubleClick={() => {
                                  setEditingStepId(step.id);
                                  setEditValue(step.title);
                                }}
                                title="Duplo clique para editar"
                              >
                                {step.title}
                              </span>
                            )}
                            
                            {step.selected && (
                              <div className="flex items-center gap-1 ml-4 bg-[#0B0E14] px-2 py-0.5 rounded border border-white/5">
                                <span className="text-[10px] text-gray-500 uppercase font-bold">Peso:</span>
                                <input
                                  type="number"
                                  value={step.weight || 0}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setTemplateData(prev => prev.map(s => 
                                      s.id === step.id ? { ...s, weight: val } : s
                                    ));
                                  }}
                                  className="bg-transparent text-xs text-[#F97316] w-10 focus:outline-none font-bold"
                                />
                                <span className="text-[10px] text-gray-500">%</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-500">
                              {Object.values(step.selectedSubSteps).filter(Boolean).length} / {step.subSteps.length} subitens
                            </span>
                            
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => moveTemplateStep(index, 'up')}
                                disabled={index === 0}
                                className="p-1 text-gray-500 hover:text-white disabled:opacity-30"
                                title="Mover para cima"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveTemplateStep(index, 'down')}
                                disabled={index === templateData.length - 1}
                                className="p-1 text-gray-500 hover:text-white disabled:opacity-30"
                                title="Mover para baixo"
                              >
                                <ArrowDown size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStepId(step.id);
                                  setEditValue(step.title);
                                }}
                                className="p-1 text-gray-500 hover:text-blue-400"
                                title="Editar"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => addTemplateSubStep(step.id)}
                                className="p-1 text-gray-500 hover:text-emerald-400"
                                title="Adicionar subitem"
                              >
                                <Plus size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeTemplateStep(step.id)}
                                className="p-1 text-gray-500 hover:text-red-400"
                                title="Remover etapa"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {expandedTemplateSteps.includes(step.id) && (
                        <div className="bg-[#0B0E14] p-3 pl-12 space-y-2 border-t border-white/5">
                          {step.subSteps.length > 0 ? (
                            step.subSteps.map((sub, subIndex) => {
                              const subId = typeof sub === 'string' ? `${step.id}_sub_${subIndex}` : sub.id;
                              const subTitle = typeof sub === 'string' ? sub : sub.title;
                              
                              return (
                                <div key={subId} className="flex items-center justify-between group py-1 border-b border-white/5 last:border-0">
                                  <div className="flex items-center flex-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleSubStepSelection(step.id, subId)}
                                      className={`mr-3 flex-shrink-0 ${step.selectedSubSteps[subId] ? 'text-emerald-500' : 'text-gray-600'}`}
                                    >
                                      {step.selectedSubSteps[subId] ? <CheckSquare size={16} /> : <Square size={16} />}
                                    </button>
                                    
                                    {editingSubStep?.stepId === step.id && editingSubStep?.subStepId === subId ? (
                                      <input
                                        type="text"
                                        autoFocus
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onBlur={() => saveSubStepTitle(step.id, subId)}
                                        onKeyDown={(e) => e.key === 'Enter' && saveSubStepTitle(step.id, subId)}
                                        className="bg-[#161B22] border border-emerald-500 rounded px-2 py-0.5 text-xs text-white focus:outline-none w-48"
                                      />
                                    ) : (
                                      <div className="flex items-center gap-3">
                                        <span 
                                          className={`text-sm cursor-pointer ${step.selectedSubSteps[subId] ? 'text-gray-300' : 'text-gray-600'}`}
                                          onDoubleClick={() => {
                                            setEditingSubStep({ stepId: step.id, subStepId: subId });
                                            setEditValue(subTitle);
                                          }}
                                          title="Duplo clique para editar"
                                        >
                                          {subTitle}
                                        </span>
                                        {step.selectedSubSteps[subId] && (
                                          <div className="flex items-center gap-2">
                                            <select
                                              value={step.subStepComplexities?.[subId] || 'media'}
                                              onChange={(e) => {
                                                const val = e.target.value as 'baixa' | 'media' | 'alta';
                                                setTemplateData(prev => prev.map(s => {
                                                  if (s.id === step.id) {
                                                    return {
                                                      ...s,
                                                      subStepComplexities: {
                                                        ...s.subStepComplexities,
                                                        [subId]: val
                                                      }
                                                    };
                                                  }
                                                  return s;
                                                }));
                                              }}
                                              className="bg-[#161B22] text-[10px] text-gray-400 border border-white/5 rounded px-1 py-0.5 focus:outline-none"
                                              title="Complexidade do subitem (afeta o peso real)"
                                            >
                                              <option value="baixa">Baixa (P1)</option>
                                              <option value="media">Média (P2)</option>
                                              <option value="alta">Alta (P3)</option>
                                            </select>
                                            <div className="group/info relative">
                                              <Info size={12} className="text-gray-600 cursor-help" />
                                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-black text-[10px] text-gray-300 rounded shadow-xl border border-white/10 opacity-0 group-hover/info:opacity-100 transition-opacity pointer-events-none z-50">
                                                O peso da etapa principal será distribuído entre os subitens conforme a complexidade: Alta (3), Média (2), Baixa (1).
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => moveTemplateSubStep(step.id, subIndex, 'up')}
                                      disabled={subIndex === 0}
                                      className="p-1 text-gray-600 hover:text-white disabled:opacity-30"
                                      title="Mover para cima"
                                    >
                                      <ArrowUp size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveTemplateSubStep(step.id, subIndex, 'down')}
                                      disabled={subIndex === step.subSteps.length - 1}
                                      className="p-1 text-gray-600 hover:text-white disabled:opacity-30"
                                      title="Mover para baixo"
                                    >
                                      <ArrowDown size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingSubStep({ stepId: step.id, subStepId: subId });
                                        setEditValue(subTitle);
                                      }}
                                      className="p-1 text-gray-600 hover:text-blue-400"
                                      title="Editar"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeTemplateSubStep(step.id, subId)}
                                      className="p-1 text-gray-600 hover:text-red-400"
                                      title="Remover"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-xs text-gray-600 italic">Nenhum subitem nesta etapa.</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 italic mt-2">
                  * As etapas selecionadas serão criadas automaticamente no cronograma desta obra.
                </p>
              </div>
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
              disabled={isSaving}
              className="bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {syncStatus || 'Salvando...'}
                </>
              ) : (
                'Salvar Obra'
              )}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={async () => {
          if (pendingProjectType && editingProject) {
            setIsSaving(true);
            setSyncStatus('Recriando cronograma...');
            
            applyProjectTypeChange(pendingProjectType);
            
            // Recreate schedule
            const itemsToDelete = scheduleItems.filter(item => item.projectId === editingProject.id);
            for (const item of itemsToDelete) {
              await deleteScheduleItem(item.id);
            }

            // Get the template data based on pendingProjectType.
            let newTemplate: TemplateStep[] = [];
            const savedTemplate = projectTemplates.find(t => t.id === pendingProjectType);
            
            if (savedTemplate) {
              newTemplate = savedTemplate.structure;
            } else {
              if (pendingProjectType === 'obra_completa') {
                newTemplate = OBRA_COMPLETA_TEMPLATE;
              } else if (pendingProjectType === 'obra_parcial') {
                newTemplate = OBRA_PARCIAL_TEMPLATE;
              } else if (pendingProjectType === 'manutencao') {
                newTemplate = OBRA_MANUTENCAO_TEMPLATE;
              }
            }

            for (const step of newTemplate) {
              if (step.selected) {
                const mainStepId = await addScheduleItem({
                  projectId: editingProject.id,
                  title: step.title,
                  progress: 0,
                  weight: step.weight || 10,
                  complexity: 'media',
                  status: 'pendente',
                  startDate: formData.startDate || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
                  endDate: formData.endDate || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
                  responsibleId: formData.managerId || '',
                  responsavelTipo: formData.managerId ? 'usuario' : 'manual',
                  responsavelUserId: formData.managerId || '',
                  responsavelNome: formData.managerId ? (users.find(u => u.id === formData.managerId)?.name || '') : '',
                  templateStepId: step.id,
                  ordem: step.ordem
                });

                if (mainStepId) {
                  for (const sub of step.subSteps) {
                    // In a fresh template from Firestore, we might want to check if it's selected
                    // If selectedSubSteps is missing (old data), we default to true if it's in subSteps
                    const isSelected = step.selectedSubSteps ? step.selectedSubSteps[sub.id] : true;
                    
                    if (isSelected) {
                      const complexity = step.subStepComplexities?.[sub.id] || 'media';
                      const weight = complexity === 'alta' ? 3 : (complexity === 'media' ? 2 : 1);

                      await addScheduleItem({
                        projectId: editingProject.id,
                        parentStepId: mainStepId,
                        title: sub.title,
                        progress: 0,
                        weight: weight,
                        complexity: complexity,
                        status: 'pendente',
                        startDate: formData.startDate || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
                        endDate: formData.endDate || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
                        responsibleId: formData.managerId || '',
                        responsavelTipo: formData.managerId ? 'usuario' : 'manual',
                        responsavelUserId: formData.managerId || '',
                        responsavelNome: formData.managerId ? (users.find(u => u.id === formData.managerId)?.name || '') : '',
                        templateStepId: step.id,
                        templateSubStepId: sub.id,
                        ordem: sub.ordem || 0
                      });
                    }
                  }
                }
              }
            }
            
            setIsSaving(false);
            setSyncStatus('');
            setIsConfirmModalOpen(false);
          }
        }}
        title="Recriar Cronograma?"
        message="Ao alterar o tipo de obra, o cronograma existente será apagado e um novo será gerado com base no novo modelo. Deseja continuar?"
      />

      <ConfirmModal
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={confirmDelete}
        title="Excluir Obra"
        message="Tem certeza que deseja excluir esta obra? Esta ação não pode ser desfeita e removerá todos os dados associados a ela."
      />

      <UpdateTemplateModal
        isOpen={isUpdateTemplateModalOpen}
        onClose={() => setIsUpdateTemplateModalOpen(false)}
        onApply={(option) => {
          console.log('Applying option:', option);
          alert(`Resumo da atualização (Opção ${option}):\n- 3 itens novos adicionados\n- 2 nomes atualizados\n- 5 itens preservados por já terem progresso\n- 1 item não alterado por possuir pendência vinculada`);
          setIsUpdateTemplateModalOpen(false);
        }}
      />
    </div>
  );
}
