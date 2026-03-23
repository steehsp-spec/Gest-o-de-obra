import { LayoutDashboard, Calendar, Building2, ClipboardList, AlertTriangle, DollarSign, FileText, Settings, Users, Layers, UserCircle } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useData } from '../../contexts/DataContext';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Calendar, label: 'Cronograma', path: '/cronograma' },
  { icon: Building2, label: 'Cadastro de Obras', path: '/cadastro-obras' },
  { icon: Layers, label: 'Modelos de Obra', path: '/modelos-obra' },
  { icon: AlertTriangle, label: 'Pendências', path: '/pendencias' },
  { icon: DollarSign, label: 'Financeiro', path: '/financeiro' },
  { icon: FileText, label: 'Relatórios', path: '/relatorios' },
  { icon: UserCircle, label: 'Responsáveis', path: '/responsaveis' },
  { icon: Users, label: 'Usuários', path: '/usuarios' },
  { icon: Settings, label: 'Configurações', path: '/configuracoes' },
];

export default function Sidebar() {
  const { settings } = useData();
  
  return (
    <div className="w-64 bg-[#161B22] border-r border-white/10 h-screen flex flex-col fixed left-0 top-0">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white">
          {settings.companyName.split(' ').map((word, i) => (
            <span key={i} className={i === 1 ? 'text-[#F97316]' : ''}>
              {word}{' '}
            </span>
          ))}
        </h1>
      </div>
      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive ? 'bg-[#F97316] text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
