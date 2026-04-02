import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import { useData } from '../../contexts/DataContext';

export default function Layout() {
  const { currentUser, loading } = useData();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0E14] flex items-center justify-center">
        <div className="text-white text-xl animate-pulse font-bold">A&R <span className="text-[#F97316]">Engenharia</span></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#0B0E14] pb-20 lg:pb-0">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <Header />
      <main className="lg:pl-64 pt-16 px-4 lg:px-0">
        <div className="max-w-7xl mx-auto py-6 lg:px-8">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
