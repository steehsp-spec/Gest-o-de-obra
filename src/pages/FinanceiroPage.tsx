import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, TrendingUp, TrendingDown, DollarSign, Filter, Calendar, Download } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { Transaction, TransactionType, TransactionCategory } from '../types';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';
import { exportToPdf } from '../utils/pdfExport';

export default function FinanceiroPage() {
  const { transactions, addTransaction, updateTransaction, deleteTransaction, projects, currentUser } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [filterProject, setFilterProject] = useState('');
  const [filterType, setFilterType] = useState('');
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState<Omit<Transaction, 'id'>>({
    projectId: '',
    description: '',
    amount: 0,
    type: 'saida',
    category: 'materiais',
    date: new Date().toISOString().split('T')[0],
    status: 'pago'
  });

  const handleOpenModal = (transaction?: Transaction) => {
    if (transaction) {
      setEditingTransaction(transaction);
      setFormData({ ...transaction });
    } else {
      setEditingTransaction(null);
      setFormData({
        projectId: filterProject || '',
        description: '',
        amount: 0,
        type: 'saida',
        category: 'materiais',
        date: new Date().toISOString().split('T')[0],
        status: 'pago'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTransaction) {
      updateTransaction(editingTransaction.id, formData);
    } else {
      addTransaction(formData);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    setTransactionToDelete(id);
  };

  const confirmDelete = () => {
    if (transactionToDelete) {
      deleteTransaction(transactionToDelete);
      setTransactionToDelete(null);
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesProject = filterProject === '' || t.projectId === filterProject;
    const matchesType = filterType === '' || t.type === filterType;
    return matchesProject && matchesType;
  });

  const totals = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => {
      if (t.type === 'entrada') acc.income += t.amount;
      else acc.expense += t.amount;
      acc.balance = acc.income - acc.expense;
      return acc;
    }, { income: 0, expense: 0, balance: 0 });
  }, [filteredTransactions]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDateToBR = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleExportPdf = () => {
    const project = projects.find(p => p.id === filterProject);
    const projectName = project ? project.name : 'Todas as Obras';
    
    const head = [['Data', 'Obra', 'Categoria', 'Descrição', 'Tipo', 'Valor']];
    const body: any[][] = [];

    filteredTransactions.forEach(t => {
      const proj = projects.find(proj => proj.id === t.projectId);
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <div className="bg-[#161B22] p-4 lg:p-6 rounded-xl lg:rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-[10px] lg:text-sm font-semibold uppercase tracking-wider">Total Entradas</span>
            <TrendingUp size={18} className="text-emerald-500 lg:w-5 lg:h-5" />
          </div>
          <p className="text-xl lg:text-2xl font-bold text-emerald-500">{formatCurrency(totals.income)}</p>
        </div>
        <div className="bg-[#161B22] p-4 lg:p-6 rounded-xl lg:rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-[10px] lg:text-sm font-semibold uppercase tracking-wider">Total Saídas</span>
            <TrendingDown size={18} className="text-red-500 lg:w-5 lg:h-5" />
          </div>
          <p className="text-xl lg:text-2xl font-bold text-red-500">{formatCurrency(totals.expense)}</p>
        </div>
        <div className="bg-[#161B22] p-4 lg:p-6 rounded-xl lg:rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-[10px] lg:text-sm font-semibold uppercase tracking-wider">Saldo Líquido</span>
            <DollarSign size={18} className="text-[#F97316] lg:w-5 lg:h-5" />
          </div>
          <p className={`text-xl lg:text-2xl font-bold ${totals.balance >= 0 ? 'text-white' : 'text-red-500'}`}>
            {formatCurrency(totals.balance)}
          </p>
        </div>
      </div>

      <div className="bg-[#161B22] p-4 rounded-xl border border-white/10 mb-6 flex flex-col md:flex-row items-center gap-4">
        <div className="w-full md:flex-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold mb-1 block">Filtrar por Obra</label>
          <select 
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-[#F97316]"
          >
            <option value="">Todas as Obras</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                    {projects.find(p => p.id === t.projectId)?.name || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-gray-500 uppercase font-bold tracking-wider bg-white/5 px-2 py-1 rounded">
                      {t.category}
                    </span>
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
                      {projects.find(p => p.id === t.projectId)?.name || '-'}
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
                  <span className="text-xs text-gray-300">{t.category}</span>
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
                value={formData.projectId || ''}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
              >
                <option value="">Selecione a obra</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                value={formData.category || 'materiais'}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as TransactionCategory })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-2.5 lg:p-3 text-white text-sm lg:text-base focus:outline-none focus:border-[#F97316]"
              >
                <option value="materiais">Materiais</option>
                <option value="mao_de_obra">Mão de Obra</option>
                <option value="equipamentos">Equipamentos</option>
                <option value="administrativo">Administrativo</option>
                <option value="impostos">Impostos</option>
                <option value="recebimento">Recebimento (Entrada)</option>
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
