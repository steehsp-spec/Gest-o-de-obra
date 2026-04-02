import React, { useState } from 'react';
import { Plus, Search, Edit2, Trash2, UserPlus, Mail, Phone, Shield, Power } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { User, UserRole } from '../types';
import Modal from '../components/ui/Modal';
import ConfirmModal from '../components/ui/ConfirmModal';

export default function UsuariosPage() {
  const { users, addUser, updateUser, deleteUser } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<Omit<User, 'id'>>({
    name: '',
    email: '',
    phone: '',
    role: 'encarregado',
    status: 'ativo',
    password: ''
  });

  const [loading, setLoading] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({ ...user, password: '' });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        role: 'encarregado',
        status: 'ativo',
        password: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificação prévia na lista local (Firestore)
    if (!editingUser && users.some(u => u.email.toLowerCase() === formData.email.toLowerCase())) {
      alert('Este e-mail já está cadastrado no sistema.');
      return;
    }

    setLoading(true);
    try {
      if (editingUser) {
        const { password, ...rest } = formData;
        const dataToUpdate = password ? formData : rest;
        await updateUser(editingUser.id, dataToUpdate);
      } else {
        const result = await addUser(formData);
        // The profile is now created automatically in addUser, so no alert needed.
        console.log('Usuário criado/vinculado com UID:', result);
      }
      setIsModalOpen(false);
      setEditingUser(null);
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error);
      alert('Erro ao salvar usuário: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setUserToDelete(id);
  };

  const confirmDelete = async () => {
    if (userToDelete) {
      try {
        await deleteUser(userToDelete);
      } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        alert('Erro ao excluir usuário.');
      } finally {
        setUserToDelete(null);
      }
    }
  };

  const toggleStatus = async (user: User) => {
    try {
      await updateUser(user.id, { status: user.status === 'ativo' ? 'inativo' : 'ativo' });
    } catch (error) {
      console.error('Erro ao alternar status:', error);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role: UserRole) => {
    const styles = {
      administrador: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      engenheiro: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      encarregado: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      financeiro: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      cliente: 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border capitalize ${styles[role]}`}>
        {role}
      </span>
    );
  };

  return (
    <div className="p-4 lg:p-8 pb-24 lg:pb-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white">Gestão de Usuários</h1>
          <p className="text-gray-400 text-xs lg:text-sm">Controle de acessos e perfis do sistema</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-[#F97316] hover:bg-[#EA580C] text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors font-semibold w-full lg:w-auto"
        >
          <UserPlus size={20} />
          Novo Usuário
        </button>
      </div>

      <div className="bg-[#161B22] rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-4 lg:p-6 border-b border-white/10">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou e-mail..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0B0E14] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-[#F97316] text-sm"
            />
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#0B0E14] text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Usuário</th>
                <th className="px-6 py-4 font-semibold">Contato</th>
                <th className="px-6 py-4 font-semibold">Perfil</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#F97316]/20 flex items-center justify-center text-[#F97316] font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white font-medium">{user.name}</span>
                        <span className="text-gray-500 text-xs">{user.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col text-sm text-gray-300">
                      <div className="flex items-center gap-2"><Mail size={14} className="text-gray-500" /> {user.email}</div>
                      <div className="flex items-center gap-2"><Phone size={14} className="text-gray-500" /> {user.phone}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                      user.status === 'ativo' 
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                        : 'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}>
                      {user.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => toggleStatus(user)}
                        className={`p-2 transition-colors ${user.status === 'ativo' ? 'text-gray-400 hover:text-red-500' : 'text-gray-400 hover:text-emerald-500'}`}
                        title={user.status === 'ativo' ? 'Desativar' : 'Ativar'}
                      >
                        <Power size={18} />
                      </button>
                      <button 
                        onClick={() => handleOpenModal(user)}
                        className="p-2 text-gray-400 hover:text-[#F97316] transition-colors" 
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(user.id)}
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

        {/* Mobile Card View */}
        <div className="lg:hidden divide-y divide-white/5">
          {filteredUsers.map((user) => (
            <div key={user.id} className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#F97316]/20 flex items-center justify-center text-[#F97316] font-bold">
                    {user.name.charAt(0)}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white font-medium">{user.name}</span>
                    <span className="text-gray-500 text-xs">{user.email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => toggleStatus(user)}
                    className={`p-2 transition-colors ${user.status === 'ativo' ? 'text-gray-400' : 'text-emerald-500'}`}
                  >
                    <Power size={18} />
                  </button>
                  <button 
                    onClick={() => handleOpenModal(user)}
                    className="p-2 text-gray-400" 
                  >
                    <Edit2 size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(user.id)}
                    className="p-2 text-gray-400" 
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Perfil</span>
                  {getRoleBadge(user.role)}
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider block">Status</span>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-medium border inline-block ${
                    user.status === 'ativo' 
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                      : 'bg-red-500/10 text-red-500 border-red-500/20'
                  }`}>
                    {user.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>

              <div className="bg-[#0B0E14] rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-300">
                  <Mail size={14} className="text-gray-500" />
                  {user.email}
                </div>
                {user.phone && (
                  <div className="flex items-center gap-2 text-xs text-gray-300">
                    <Phone size={14} className="text-gray-500" />
                    {user.phone}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingUser ? 'Editar Usuário' : 'Novo Usuário'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Nome Completo *</label>
            <input 
              required
              type="text" 
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">E-mail *</label>
              <input 
                required
                type="email" 
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Telefone</label>
              <input 
                type="text" 
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Perfil de Acesso *</label>
              <select 
                required
                value={formData.role || 'encarregado'}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316]"
              >
                <option value="administrador">Administrador</option>
                <option value="engenheiro">Engenheiro</option>
                <option value="encarregado">Encarregado</option>
                <option value="financeiro">Financeiro</option>
                <option value="cliente">Cliente</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-400">Status</label>
              <select 
                value={formData.status || 'ativo'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'ativo' | 'inativo' })}
                className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316]"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Senha {editingUser ? '(Deixe em branco para manter)' : '*'}</label>
            <input 
              required={!editingUser}
              type="password" 
              value={formData.password || ''}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-[#0B0E14] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-[#F97316]"
            />
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
              disabled={loading}
              className="bg-[#F97316] hover:bg-[#EA580C] text-white px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : 'Salvar Usuário'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={confirmDelete}
        title="Excluir Usuário"
        message="Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita."
      />
    </div>
  );
}
