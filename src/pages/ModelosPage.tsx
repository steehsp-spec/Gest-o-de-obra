import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Copy, 
  Search, 
  Layers, 
  ChevronRight, 
  Save, 
  X, 
  GripVertical, 
  CheckCircle2, 
  AlertCircle,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  Clock
} from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { ProjectTemplate, TemplateStep } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmModal from '../components/ui/ConfirmModal';

export default function ModelosPage() {
  const { projectTemplates, addProjectTemplate, updateProjectTemplate, deleteProjectTemplate, currentUser } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProjectTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<{ id: string, name: string } | null>(null);

  // State for the template being edited/created
  const [formData, setFormData] = useState<Partial<ProjectTemplate>>({
    name: '',
    type: 'personalizado',
    structure: []
  });

  const filteredTemplates = useMemo(() => {
    return projectTemplates.filter(t => 
      t.name.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));
  }, [projectTemplates, searchTerm]);

  const handleOpenModal = (template?: ProjectTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({ ...template });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        type: 'personalizado',
        structure: []
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      type: 'personalizado',
      structure: []
    });
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      setMessage({ type: 'error', text: 'O nome do modelo é obrigatório.' });
      return;
    }

    // Add ordem before saving
    const structureWithOrder = formData.structure?.map((step, stepIndex) => ({
      ...step,
      ordem: stepIndex + 1,
      subSteps: step.subSteps.map((sub, subIndex) => ({
        ...sub,
        ordem: subIndex + 1
      }))
    }));
    
    const dataToSave = { ...formData, structure: structureWithOrder };

    setIsSaving(true);
    try {
      if (editingTemplate) {
        await updateProjectTemplate(editingTemplate.id, dataToSave);
        setMessage({ type: 'success', text: 'Modelo atualizado com sucesso!' });
      } else {
        await addProjectTemplate(dataToSave as Omit<ProjectTemplate, 'id'>);
        setMessage({ type: 'success', text: 'Modelo criado com sucesso!' });
      }
      handleCloseModal();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Erro ao salvar modelo:', error);
      setMessage({ type: 'error', text: 'Erro ao salvar modelo.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicate = async (template: ProjectTemplate) => {
    try {
      const { id, ...rest } = template;
      await addProjectTemplate({
        ...rest,
        name: `${template.name} (Cópia)`,
        updatedAt: new Date().toISOString()
      });
      setMessage({ type: 'success', text: 'Modelo duplicado com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao duplicar modelo.' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const protectedIds = ['obra_completa', 'obra_parcial', 'manutencao', 'em_branco'];
    if (protectedIds.includes(id)) {
      setMessage({ type: 'error', text: 'Este modelo padrão não pode ser excluído.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setTemplateToDelete({ id, name });
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    
    try {
      await deleteProjectTemplate(templateToDelete.id);
      setMessage({ type: 'success', text: 'Modelo excluído com sucesso!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao excluir modelo.' });
    } finally {
      setTemplateToDelete(null);
    }
  };

  // Template Structure Editing Helpers
  const addStep = () => {
    const newStep: TemplateStep = {
      id: `step_${Date.now()}`,
      title: 'Nova Etapa',
      weight: 0,
      selected: true,
      ordem: editingTemplate ? editingTemplate.structure.length + 1 : 1,
      subSteps: [],
      selectedSubSteps: {},
      subStepComplexities: {}
    };
    setFormData(prev => ({
      ...prev,
      structure: [...(prev.structure || []), newStep]
    }));
  };

  const updateStep = (stepId: string, updates: Partial<TemplateStep>) => {
    setFormData(prev => ({
      ...prev,
      structure: prev.structure?.map(s => s.id === stepId ? { ...s, ...updates } : s)
    }));
  };

  const removeStep = (stepId: string) => {
    setFormData(prev => ({
      ...prev,
      structure: prev.structure?.filter(s => s.id !== stepId)
    }));
  };

  const addSubStep = (stepId: string) => {
    const subId = `sub_${Date.now()}`;
    setFormData(prev => ({
      ...prev,
      structure: prev.structure?.map(step => {
        if (step.id === stepId) {
          const newSubStep = { id: subId, title: 'Novo Subitem' };
          return {
            ...step,
            subSteps: [...step.subSteps, newSubStep],
            selectedSubSteps: { ...step.selectedSubSteps, [subId]: true },
            subStepComplexities: { ...step.subStepComplexities, [subId]: 'media' }
          };
        }
        return step;
      })
    }));
  };

  const updateSubStep = (stepId: string, subId: string, title: string) => {
    setFormData(prev => ({
      ...prev,
      structure: prev.structure?.map(step => {
        if (step.id === stepId) {
          return {
            ...step,
            subSteps: step.subSteps.map(sub => sub.id === subId ? { ...sub, title } : sub)
          };
        }
        return step;
      })
    }));
  };

  const removeSubStep = (stepId: string, subId: string) => {
    setFormData(prev => ({
      ...prev,
      structure: prev.structure?.map(step => {
        if (step.id === stepId) {
          const newSelectedSubSteps = { ...step.selectedSubSteps };
          delete newSelectedSubSteps[subId];
          const newComplexities = { ...step.subStepComplexities };
          delete newComplexities[subId];
          return {
            ...step,
            subSteps: step.subSteps.filter(sub => sub.id !== subId),
            selectedSubSteps: newSelectedSubSteps,
            subStepComplexities: newComplexities
          };
        }
        return step;
      })
    }));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    setFormData(prev => {
      const structure = [...(prev.structure || [])];
      if (direction === 'up' && index > 0) {
        [structure[index - 1], structure[index]] = [structure[index], structure[index - 1]];
      } else if (direction === 'down' && index < structure.length - 1) {
        [structure[index + 1], structure[index]] = [structure[index], structure[index + 1]];
      }
      return { ...prev, structure };
    });
  };

  const moveSubStep = (stepId: string, subIndex: number, direction: 'up' | 'down') => {
    setFormData(prev => ({
      ...prev,
      structure: prev.structure?.map(step => {
        if (step.id === stepId) {
          const subSteps = [...step.subSteps];
          if (direction === 'up' && subIndex > 0) {
            [subSteps[subIndex - 1], subSteps[subIndex]] = [subSteps[subIndex], subSteps[subIndex - 1]];
          } else if (direction === 'down' && subIndex < subSteps.length - 1) {
            [subSteps[subIndex + 1], subSteps[subIndex]] = [subSteps[subIndex], subSteps[subIndex + 1]];
          }
          return { ...step, subSteps };
        }
        return step;
      })
    }));
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTemplateStats = (template: ProjectTemplate) => {
    const steps = template.structure.length;
    const subItems = template.structure.reduce((acc, step) => acc + step.subSteps.length, 0);
    return { steps, subItems };
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Layers className="text-[#F97316]" />
            Modelos de Obra
          </h1>
          <p className="text-gray-400 mt-1">Gerencie os modelos de cronograma padrão da empresa</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-[#F97316] hover:bg-[#EA580C] text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#F97316]/20"
        >
          <Plus size={20} />
          Novo Modelo
        </button>
      </div>

      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl mb-6 flex items-center gap-3 ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
              : 'bg-red-500/10 text-red-500 border border-red-500/20'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          {message.text}
        </motion.div>
      )}

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
        <input
          type="text"
          placeholder="Buscar modelos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[#161B22] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-[#F97316] transition-colors"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => {
          const stats = getTemplateStats(template);
          return (
            <motion.div
              key={template.id}
              layoutId={template.id}
              className="bg-[#161B22] border border-white/10 rounded-2xl p-6 hover:border-[#F97316]/50 transition-all group relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="bg-[#F97316]/10 p-3 rounded-xl">
                  <Layers className="text-[#F97316]" size={24} />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDuplicate(template)}
                    className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
                    title="Duplicar"
                  >
                    <Copy size={18} />
                  </button>
                  <button
                    onClick={() => handleOpenModal(template)}
                    className="p-2 text-gray-400 hover:text-[#F97316] transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id, template.name)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-bold text-white mb-2">{template.name}</h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Etapas:</span>
                  <span className="text-white font-medium">{stats.steps}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Subitens:</span>
                  <span className="text-white font-medium">{stats.subItems}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Atualizado em:</span>
                  <span className="text-white font-medium flex items-center gap-1">
                    <Clock size={12} />
                    {formatDate(template.updatedAt)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleOpenModal(template)}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                Visualizar Estrutura
                <ChevronRight size={18} />
              </button>
            </motion.div>
          );
        })}

        {filteredTemplates.length === 0 && (
          <div className="col-span-full py-20 text-center">
            <Layers className="mx-auto text-gray-600 mb-4" size={48} />
            <p className="text-gray-400 text-lg">Nenhum modelo encontrado.</p>
          </div>
        )}
      </div>

      {/* Modal de Edição de Modelo */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0B0E14] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {editingTemplate ? 'Editar Modelo' : 'Novo Modelo'}
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">Defina a estrutura padrão para este modelo</p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-8">
                {/* Nome do Modelo */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Nome do Modelo</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Obra de Alto Padrão"
                    className="w-full bg-[#161B22] border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#F97316] transition-colors"
                  />
                </div>

                {/* Estrutura */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      Estrutura do Cronograma
                      <span className="text-xs font-normal text-gray-500 bg-white/5 px-2 py-1 rounded-full">
                        {formData.structure?.length || 0} Etapas
                      </span>
                    </h3>
                    <button
                      onClick={addStep}
                      className="text-[#F97316] hover:text-[#EA580C] text-sm font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-[#F97316]/10 transition-colors"
                    >
                      <Plus size={16} />
                      Adicionar Etapa
                    </button>
                  </div>

                  <div className="space-y-4">
                    {formData.structure?.map((step, index) => (
                      <div key={step.id} className="bg-[#161B22] border border-white/10 rounded-xl overflow-hidden">
                        <div className="p-4 flex items-center gap-4 bg-white/5 border-b border-white/5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => moveStep(index, 'up')}
                              disabled={index === 0}
                              className="p-1 text-gray-500 hover:text-white disabled:opacity-20"
                            >
                              <ArrowUp size={16} />
                            </button>
                            <button
                              onClick={() => moveStep(index, 'down')}
                              disabled={index === (formData.structure?.length || 0) - 1}
                              className="p-1 text-gray-500 hover:text-white disabled:opacity-20"
                            >
                              <ArrowDown size={16} />
                            </button>
                          </div>
                          
                          <input
                            type="text"
                            value={step.title}
                            onChange={(e) => updateStep(step.id, { title: e.target.value })}
                            className="flex-1 bg-transparent border-none text-white font-bold focus:ring-0 p-0 text-lg"
                            placeholder="Nome da Etapa"
                          />

                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] uppercase text-gray-500 font-bold">Peso (%)</span>
                              <input
                                type="number"
                                value={step.weight}
                                onChange={(e) => updateStep(step.id, { weight: Number(e.target.value) })}
                                className="w-16 bg-[#0B0E14] border border-white/10 rounded px-2 py-1 text-white text-sm text-center"
                              />
                            </div>
                            <button
                              onClick={() => removeStep(step.id)}
                              className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="p-4 space-y-2">
                          {step.subSteps.map((sub, subIndex) => (
                            <div key={sub.id} className="flex items-center gap-3 pl-8 group">
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => moveSubStep(step.id, subIndex, 'up')}
                                  disabled={subIndex === 0}
                                  className="p-1 text-gray-600 hover:text-white disabled:opacity-20"
                                >
                                  <ArrowUp size={14} />
                                </button>
                                <button
                                  onClick={() => moveSubStep(step.id, subIndex, 'down')}
                                  disabled={subIndex === step.subSteps.length - 1}
                                  className="p-1 text-gray-600 hover:text-white disabled:opacity-20"
                                >
                                  <ArrowDown size={14} />
                                </button>
                              </div>

                              <input
                                type="text"
                                value={sub.title}
                                onChange={(e) => updateSubStep(step.id, sub.id, e.target.value)}
                                className="flex-1 bg-transparent border-b border-white/5 text-gray-300 text-sm focus:border-[#F97316] focus:outline-none py-1"
                                placeholder="Nome do Subitem"
                              />

                              <select
                                value={step.subStepComplexities?.[sub.id] || 'media'}
                                onChange={(e) => {
                                  const newComplexities = { ...step.subStepComplexities, [sub.id]: e.target.value as 'baixa' | 'media' | 'alta' };
                                  updateStep(step.id, { subStepComplexities: newComplexities });
                                }}
                                className="bg-[#0B0E14] border border-white/10 rounded px-2 py-1 text-xs text-gray-400"
                              >
                                <option value="baixa">Baixa</option>
                                <option value="media">Média</option>
                                <option value="alta">Alta</option>
                              </select>

                              <button
                                onClick={() => removeSubStep(step.id, sub.id)}
                                className="p-1 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addSubStep(step.id)}
                            className="flex items-center gap-2 text-xs text-gray-500 hover:text-[#F97316] transition-colors pl-8 mt-2"
                          >
                            <Plus size={14} />
                            Adicionar Subitem
                          </button>
                        </div>
                      </div>
                    ))}

                    {(!formData.structure || formData.structure.length === 0) && (
                      <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-2xl">
                        <Layers className="mx-auto text-gray-700 mb-3" size={32} />
                        <p className="text-gray-500">Nenhuma etapa definida. Comece adicionando uma etapa principal.</p>
                        <button
                          onClick={addStep}
                          className="mt-4 text-[#F97316] hover:underline font-bold text-sm"
                        >
                          Adicionar Primeira Etapa
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-white/10 flex items-center justify-end gap-4 bg-white/5 rounded-b-2xl">
                <button
                  onClick={handleCloseModal}
                  className="px-6 py-2.5 text-gray-400 hover:text-white font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-50 text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-[#F97316]/20"
                >
                  <Save size={20} />
                  {isSaving ? 'Salvando...' : 'Salvar Modelo'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ConfirmModal
        isOpen={!!templateToDelete}
        onClose={() => setTemplateToDelete(null)}
        onConfirm={confirmDelete}
        title="Excluir Modelo"
        message={`Tem certeza que deseja excluir o modelo "${templateToDelete?.name}"? Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}
