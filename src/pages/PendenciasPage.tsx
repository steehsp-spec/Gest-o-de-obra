import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2, AlertCircle, Filter, CheckCircle2, Clock, Download } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { Pendency, PendencyStatus, Priority } from '../types';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import { exportToPdf } from '../utils/pdfExport';

export default function PendenciasPage() {
  const { pendencies, addPendency, updatePendency, deletePendency, projects, users, scheduleItems, currentUser } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPendency, setEditingPendency] = useState<Pendency | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [filterProject, setFilterProject] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterScheduleItem, setFilterScheduleItem] = useState('');
  const [pendencyToDelete, setPendencyToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState<Omit<Pendency, 'id'>>({
    title: '',
    description: '',
    projectId: '',
    stage: '',
    scheduleItemId: '',
    origin: 'outro',
    responsibleId: '',
    priority: 'media',
    deadline: '',
    status: 'aberta',
    finalObservation: ''
  });

  const handleOpenModal = (pendency?: Pendency) => {
    if (pendency) {
      setEditingPendency(pendency);
      setFormData({ ...pendency });
    } else {
      setEditingPendency(null);
      setFormData({
        title: '',
        description: '',
        projectId: '',
        stage: '',
        scheduleItemId: '',
        origin: 'outro',
        responsibleId: '',
        priority: 'media',
        deadline: '',
        status: 'aberta',
        finalObservation: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPendency) {
      updatePendency(editingPendency.id, formData);
    } else {
      addPendency(formData);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setPendencyToDelete(id);
  };

  const confirmDelete = () => {
    if (pendencyToDelete) {
      deletePendency(pendencyToDelete);
      setPendencyToDelete(null);
    }
  };

  const filteredPendencies = pendencies.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProject = filterProject === '' || p.projectId === filterProject;
    const matchesScheduleItem = filterScheduleItem === '' || p.scheduleItemId === filterScheduleItem;
    const matchesPriority = filterPriority === '' || p.priority === filterPriority;
    const matchesStatus = filterStatus === '' || p.status === filterStatus;
    
    return matchesSearch && matchesProject && matchesScheduleItem && matchesPriority && matchesStatus;
  });

  const getPriorityBadge = (priority: Priority) => {
    const styles = {
      baixa: 'text-blue-400',
      media: 'text-yellow-400',
      alta: 'text-orange-500',
      critica: 'text-red-500'
    };
    return <span className={`font-semibold capitalize ${styles[priority]}`}>{priority}</span>;
  };

  const getStatusIcon = (status: PendencyStatus) => {
    switch (status) {
      case 'aberta': return <AlertCircle size={18} className="text-red-500" />;
      case 'em_andamento': return <Clock size={18} className="text-yellow-500" />;
      case 'resolvida': return <CheckCircle2 size={18} className="text-emerald-500" />;
      case 'cancelada': return <Trash2 size={18} className="text-gray-500" />;
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
    
    const head = [['Obra', 'Item Vinculado', 'Título', 'Prioridade', 'Responsável', 'Status', 'Prazo']];
    const body: any[][] = [];

    filteredPendencies.forEach(p => {
      const proj = projects.find(proj => proj.id === p.projectId);
      const scheduleItem = scheduleItems.find(s => s.id === p.scheduleItemId);
      const responsible = users.find(u => u.id === p.responsibleId);
      
      let statusText = '';
      switch (p.status) {
        case 'aberta': statusText = 'Aberta'; break;
        case 'em_andamento': statusText = 'Em andamento'; break;
        case 'resolvida': statusText = 'Resolvida'; break;
        case 'cancelada': statusText = 'Cancelada'; break;
      }

      body.push([
        proj?.name || '-',
        scheduleItem?.title || '-',
        p.title,
        p.priority.charAt(0).toUpperCase() + p.priority.slice(1),
        responsible?.name || '-',
        statusText,
        p.deadline ? formatDateToBR(p.deadline) : '-'
      ]);
    });

    exportToPdf({
      title: 'Relatório de Pendências',
      projectName,
      userName: currentUser?.name,
      filename: `pendencias-${projectName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`,
      head,
      body,
      summary: [
        { label: 'Total de Pendências', value: filteredPendencies.length.toString() },
        { label: 'Abertas', value: filteredPendencies.filter(p => p.status === 'aberta').length.toString() },
        { label: 'Críticas', value: filteredPendencies.filter(p => p.priority === 'critica').length.toString() }
      ]
    });
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white">Pendências</h1>
          <p className="text-gray-400 text-xs lg:text-sm">Acompanhe e resolva impedimentos das obras</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportPdf}
            className="flex-1 sm:flex-none bg-[#161B22] hover:bg-white/5 border border-white/10 text-white px-3 py-2 lg:px-4 lg:py-2 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs lg:text-sm font-semibold"
          >
            <Download size={16} className="lg:w-5 lg:h-5" />
            <span className="sm:inline">Exportar PDF</span>
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="flex-1 sm:flex-none bg-[#F97316] hover:bg-[#EA580C] text-white px-3 py-2 lg:px-4 lg:py-2 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs lg:text-sm font-semibold"
          >
            <Plus size={16} className="lg:w-5 lg:h-5" />
            <span>Nova Pendência</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4 mb-6">
        <div className="bg-[#161B22] p-3 lg:p-4 rounded-xl border border-white/10">
          <label className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 block">Filtrar por Obra</label>
          <select 
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2 text-white text-xs lg:text-sm focus:outline-none focus:border-[#F97316]"
          >
            <option value="">Todas as Obras</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="bg-[#161B22] p-3 lg:p-4 rounded-xl border border-white/10">
          <label className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 block">Prioridade</label>
          <select 
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2 text-white text-xs lg:text-sm focus:outline-none focus:border-[#F97316]"
          >
            <option value="">Todas</option>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="critica">Crítica</option>
          </select>
        </div>
        <div className="bg-[#161B22] p-3 lg:p-4 rounded-xl border border-white/10">
          <label className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 block">Status</label>
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2 text-white text-xs lg:text-sm focus:outline-none focus:border-[#F97316]"
          >
            <option value="">Todos</option>
            <option value="aberta">Aberta</option>
            <option value="em_andamento">Em Andamento</option>
            <option value="resolvida">Resolvida</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
        <div className="bg-[#161B22] p-3 lg:p-4 rounded-xl border border-white/10">
          <label className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 block">Item do Cronograma</label>
          <select 
            value={filterScheduleItem}
            onChange={(e) => setFilterScheduleItem(e.target.value)}
            className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2 text-white text-xs lg:text-sm focus:outline-none focus:border-[#F97316]"
            disabled={!filterProject}
          >
            <option value="">Todos os Itens</option>
            {scheduleItems.filter(s => s.projectId === filterProject).map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>
        <div className="bg-[#161B22] p-3 lg:p-4 rounded-xl border border-white/10">
          <label className="text-[10px] text-gray-500 uppercase font-bold mb-1.5 block">Busca</label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
            <input 
              type="text" 
              placeholder="Pesquisar..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0B0E14] border border-white/10 rounded-lg pl-8 pr-2 py-2 text-white text-xs lg:text-sm focus:outline-none focus:border-[#F97316]"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredPendencies.map((pendency) => (
          <div key={pendency.id} className="bg-[#161B22] p-4 lg:p-6 rounded-2xl border border-white/10 hover:border-[#F97316]/50 transition-all group">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div className="flex gap-3 lg:gap-4">
                <div className="mt-1 shrink-0">{getStatusIcon(pendency.status)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 lg:gap-3 mb-1">
                    <h3 className="text-base lg:text-lg font-semibold text-white truncate">{pendency.title}</h3>
                    {getPriorityBadge(pendency.priority)}
                  </div>
                  <p className="text-gray-400 text-xs lg:text-sm mb-4 line-clamp-2 lg:line-clamp-none">{pendency.description}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-x-6 gap-y-2 text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Obra:</span>
                      <span className="text-gray-300 truncate">{projects.find(p => p.id === pendency.projectId)?.name}</span>
                    </div>
                    {pendency.scheduleItemId && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Item:</span>
                        <span className="text-gray-300 truncate">{scheduleItems.find(s => s.id === pendency.scheduleItemId)?.title}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Responsável:</span>
                      <span className="text-gray-300 truncate">{users.find(u => u.id === pendency.responsibleId)?.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Prazo:</span>
                      <span className="text-gray-300">{formatDateToBR(pendency.deadline)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity border-t border-white/5 pt-3 lg:pt-0 lg:border-none">
                <button 
                  onClick={() => handleOpenModal(pendency)}
                  className="p-2 text-gray-400 hover:text-[#F97316] transition-colors flex items-center gap-2 lg:block"
                >
                  <Edit2 size={18} />
                  <span className="lg:hidden text-xs font-bold uppercase">Editar</span>
                </button>
                <button 
                  onClick={() => handleDelete(pendency.id)}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors flex items-center gap-2 lg:block"
                >
                  <Trash2 size={18} />
                  <span className="lg:hidden text-xs font-bold uppercase">Excluir</span>
                </button>
              </div>
            </div>
          </div>
        ))}
        {filteredPendencies.length === 0 && (
          <div className="text-center py-12 lg:py-20 bg-[#161B22] rounded-2xl border border-dashed border-white/10">
            <p className="text-gray-500 text-sm">Nenhuma pendência encontrada com os filtros aplicados.</p>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingPendency ? 'Editar Pendência' : 'Nova Pendência'}
      >
        <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-6">
          <div className="space-y-1.5">
            <label className="text-xs lg:text-sm text-gray-400">Título da Pendência *</label>
            <input 
              required
              type="text" 
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
            />
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs lg:text-sm text-gray-400">Obra *</label>
              <select 
                required
                value={formData.projectId || ''}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value, scheduleItemId: '' })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
              >
                <option value="">Selecione a obra</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs lg:text-sm text-gray-400">Item do Cronograma</label>
              <select 
                value={formData.scheduleItemId || ''}
                onChange={(e) => setFormData({ ...formData, scheduleItemId: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
                disabled={!formData.projectId}
              >
                <option value="">Nenhum item vinculado</option>
                {scheduleItems.filter(s => s.projectId === formData.projectId).map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs lg:text-sm text-gray-400">Responsável *</label>
              <select 
                required
                value={formData.responsibleId || ''}
                onChange={(e) => setFormData({ ...formData, responsibleId: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
              >
                <option value="">Selecione o responsável</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs lg:text-sm text-gray-400">Prioridade *</label>
              <select 
                required
                value={formData.priority || 'media'}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs lg:text-sm text-gray-400">Prazo *</label>
              <input 
                required
                type="date" 
                value={formData.deadline || ''}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs lg:text-sm text-gray-400">Status *</label>
              <select 
                required
                value={formData.status || 'aberta'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as PendencyStatus })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
              >
                <option value="aberta">Aberta</option>
                <option value="em_analise">Em Análise</option>
                <option value="resolvida">Resolvida</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs lg:text-sm text-gray-400">Observação Final</label>
            <textarea 
              rows={2}
              value={formData.finalObservation || ''}
              onChange={(e) => setFormData({ ...formData, finalObservation: e.target.value })}
              className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
            />
          </div>

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
              Salvar Pendência
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!pendencyToDelete}
        onClose={() => setPendencyToDelete(null)}
        onConfirm={confirmDelete}
        title="Excluir Pendência"
        message="Tem certeza que deseja excluir esta pendência? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
