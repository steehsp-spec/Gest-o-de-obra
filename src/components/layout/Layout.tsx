import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
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
    <div className="min-h-screen bg-[#0B0E14]">
      <Sidebar />
      <Header />
      <main className="pl-64 pt-16">
        <Outlet />
      </main>
    </div>
  );
}
