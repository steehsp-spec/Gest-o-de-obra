import { LayoutDashboard, Calendar, Building2, ClipboardList, AlertTriangle, FileText, Menu } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { icon: LayoutDashboard, label: 'Dash', path: '/dashboard' },
  { icon: Calendar, label: 'Cronograma', path: '/cronograma' },
  { icon: AlertTriangle, label: 'Pendências', path: '/pendencias' },
  { icon: FileText, label: 'Relatórios', path: '/relatorios' },
  { icon: Menu, label: 'Mais', path: '/mais' },
];

export default function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-white/10 px-2 py-3 flex justify-around items-center z-50 pb-safe">
      {navItems.map((item) => (
        <NavLink
          key={item.label}
          to={item.path}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 transition-colors ${
              isActive ? 'text-[#F97316]' : 'text-gray-500 hover:text-white'
            }`
          }
        >
          <item.icon size={20} />
          <span className="text-[10px] font-medium uppercase tracking-wider">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
