import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, 
  LayoutGrid, 
  Users, 
  DollarSign, 
  UserCircle, 
  Settings, 
  LogOut,
  ChevronRight
} from 'lucide-react';

export default function MorePage() {
  const navigate = useNavigate();

  const menuItems = [
    {
      title: 'Gestão de Obras',
      items: [
        { icon: <Building2 size={20} />, label: 'Cadastro de Obras', path: '/cadastro-obras' },
        { icon: <LayoutGrid size={20} />, label: 'Modelos de Obra', path: '/modelos-obra' },
      ]
    },
    {
      title: 'Administrativo',
      items: [
        { icon: <Users size={20} />, label: 'Responsáveis', path: '/responsaveis' },
        { icon: <DollarSign size={20} />, label: 'Financeiro', path: '/financeiro' },
        { icon: <UserCircle size={20} />, label: 'Usuários', path: '/usuarios' },
      ]
    },
    {
      title: 'Sistema',
      items: [
        { icon: <Settings size={20} />, label: 'Configurações', path: '/configuracoes' },
      ]
    }
  ];

  const handleLogout = () => {
    // Implement logout logic if needed
    navigate('/login');
  };

  return (
    <div className="p-4 pb-24 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Mais Opções</h1>
        <p className="text-gray-400 text-sm">Acesse outras áreas do sistema</p>
      </div>

      <div className="space-y-6">
        {menuItems.map((section, idx) => (
          <div key={idx} className="space-y-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2">
              {section.title}
            </h2>
            <div className="bg-[#161B22] rounded-xl border border-white/10 overflow-hidden">
              {section.items.map((item, itemIdx) => (
                <button
                  key={itemIdx}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors ${
                    itemIdx !== section.items.length - 1 ? 'border-b border-white/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-[#F97316]">
                      {item.icon}
                    </div>
                    <span className="text-gray-200 font-medium">{item.label}</span>
                  </div>
                  <ChevronRight size={18} className="text-gray-600" />
                </button>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 p-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl border border-red-500/20 transition-colors mt-8"
        >
          <LogOut size={20} />
          <span className="font-semibold">Sair do Sistema</span>
        </button>
      </div>
    </div>
  );
}
