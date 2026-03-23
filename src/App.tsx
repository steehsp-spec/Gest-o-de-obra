import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Layout from './components/layout/Layout';
import { DataProvider } from './contexts/DataContext';
import DashboardPage from './pages/DashboardPage';
import CronogramaPage from './pages/CronogramaPage';
import CadastroObrasPage from './pages/CadastroObrasPage';
import PendenciasPage from './pages/PendenciasPage';
import FinanceiroPage from './pages/FinanceiroPage';
import RelatoriosPage from './pages/RelatoriosPage';
import ResponsaveisPage from './pages/ResponsaveisPage';
import UsuariosPage from './pages/UsuariosPage';
import ConfiguracoesPage from './pages/ConfiguracoesPage';
import ModelosPage from './pages/ModelosPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="cronograma" element={<CronogramaPage />} />
            <Route path="cadastro-obras" element={<CadastroObrasPage />} />
            <Route path="pendencias" element={<PendenciasPage />} />
            <Route path="financeiro" element={<FinanceiroPage />} />
            <Route path="relatorios" element={<RelatoriosPage />} />
            <Route path="responsaveis" element={<ResponsaveisPage />} />
            <Route path="usuarios" element={<UsuariosPage />} />
            <Route path="modelos-obra" element={<ModelosPage />} />
            <Route path="configuracoes" element={<ConfiguracoesPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DataProvider>
  );
}
