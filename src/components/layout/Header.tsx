import { Bell, LogOut, Database, Cloud, AlertTriangle, RefreshCw } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Header() {
  const { currentUser, logout, settings, loading, dataStatus, isMigrated, isMigrating } = useData();

  if (loading) {
    return (
      <header className="h-16 bg-[#161B22] border-b border-white/10 px-8 flex items-center justify-between sticky top-0 z-40">
        <div className="animate-pulse bg-white/5 h-6 w-48 rounded"></div>
        <div className="flex items-center gap-4">
          <div className="animate-pulse bg-white/5 h-8 w-8 rounded-full"></div>
          <div className="animate-pulse bg-white/5 h-4 w-24 rounded"></div>
        </div>
      </header>
    );
  }
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!currentUser) return null;

  const initials = currentUser.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return (
    <header className="h-16 bg-[#161B22] border-b border-white/10 flex items-center justify-between px-8 fixed top-0 left-64 right-0 z-20">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-white">{settings.companyName}</h2>
        
        {/* Data Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 ml-4">
          {dataStatus.source === 'firestore' ? (
            <>
              <Cloud size={14} className="text-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Sincronizado</span>
            </>
          ) : (
            <>
              <Database size={14} className="text-orange-500" />
              <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Modo Local</span>
            </>
          )}
        </div>

        {/* Migration Progress Indicator */}
        {isMigrating && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 animate-pulse">
            <RefreshCw size={14} className="text-blue-500 animate-spin" />
            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Migrando Dados...</span>
          </div>
        )}

        {/* Migration Warning for Admin */}
        {!isMigrated && !isMigrating && currentUser.role === 'administrador' && dataStatus.counts.projects > 0 && (
          <Link 
            to="/configuracoes"
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-colors"
          >
            <AlertTriangle size={14} className="text-orange-500" />
            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Migração Pendente</span>
          </Link>
        )}
      </div>

      <div className="flex items-center gap-6">
        <button className="text-gray-400 hover:text-white transition-colors">
          <Bell size={20} />
        </button>
        
        <div className="flex items-center gap-4 pl-6 border-l border-white/10">
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold text-white leading-tight">{currentUser.name}</span>
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{currentUser.role}</span>
          </div>
          
          <div className="group relative">
            <div className="w-9 h-9 rounded-full bg-[#F97316] flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-orange-500/20 cursor-pointer">
              {initials}
            </div>
            
            <div className="absolute right-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="bg-[#161B22] border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[160px]">
                <div className="p-3 border-b border-white/5 bg-[#0B0E14]/50">
                  <p className="text-xs text-gray-400 truncate">{currentUser.email}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
                >
                  <LogOut size={16} />
                  <span>Sair do Sistema</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
